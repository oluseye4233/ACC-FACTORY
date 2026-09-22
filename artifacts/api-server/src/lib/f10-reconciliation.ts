import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  f10BundleDeploymentAuditTable,
  f10BundleDeploymentReceiptsTable,
  f10BundleDeploymentsTable,
  f10ProviderConnectionsTable,
} from "@workspace/db";
import {
  authorizationKeyringFromEnv,
  AuthorizationKeyUnavailableError,
  openAuthorizationRef,
  providerBrokerStatusTransport,
  sealAuthorizationRef,
  shouldApplyProviderExecutionStatus,
  shouldRefreshProviderExecutionTimestamp,
  type ProviderStatusTransport,
  type StoredExecutionStatus,
} from "./f10-provider";
import type { Family } from "./f10-export";
import { logger } from "./logger";
import { notifyF10ReconciliationPaused } from "./notifications";

const ACTIVE_EXECUTION_STATUSES: StoredExecutionStatus[] = ["NOT_CONFIRMED", "ACCEPTED", "RUNNING"];
const DEFAULT_BATCH_SIZE = 8;
const MAX_BATCH_SIZE = 25;
const DEFAULT_MIN_CHECK_INTERVAL_MS = 5 * 60_000;

const DEFAULT_CLAIM_LEASE_MS = 2 * 60_000;
const INITIAL_SWEEP_DELAY_MS = 30_000;
const SWEEP_INTERVAL_MS = 5 * 60_000;
let sweepInFlight = false;

interface PausedDeployment {
  id: string;
  tenantId: string;
  provider: string;
  target: string;
}

interface PauseReconciliationDependencies {
  claimPause: (deploymentId: string, reason: string, pausedAt: Date, notifyOwner: boolean) => Promise<boolean>;
  notifyOwner: (args: {
    deploymentId: string;
    ownerUserId: string;
    provider: string;
    target: string;
    reason: string;
    pausedAt: Date;
  }) => Promise<boolean>;
}

const defaultPauseDependencies: PauseReconciliationDependencies = {
  claimPause: async (deploymentId, reason, pausedAt, notifyOwner) => {
    const [paused] = await db.update(f10BundleDeploymentsTable)
      .set({
        reconciliationPausedAt: pausedAt,
        reconciliationPauseReason: reason,
        reconciliationPauseNotifiedAt: null,
        reconciliationPauseNotificationClaimedAt: null,
        reconciliationPauseNotificationRequired: notifyOwner,
      })
      .where(and(
        eq(f10BundleDeploymentsTable.id, deploymentId),
        isNull(f10BundleDeploymentsTable.reconciliationPausedAt),
      ))
      .returning({ id: f10BundleDeploymentsTable.id });
    return Boolean(paused);
  },
  notifyOwner: notifyF10ReconciliationPaused,
};

export async function pauseF10Reconciliation(
  deployment: PausedDeployment,
  reason: string,
  notifyOwner: boolean,
  dependencies: PauseReconciliationDependencies = defaultPauseDependencies,
): Promise<void> {
  const pausedAt = new Date();
  const claimed = await dependencies.claimPause(deployment.id, reason, pausedAt, notifyOwner);
  if (!claimed || !notifyOwner) return;

  await dependencies.notifyOwner({
    deploymentId: deployment.id,
    ownerUserId: deployment.tenantId,
    provider: deployment.provider,
    target: deployment.target,
    reason,
    pausedAt,
  });
}

export type ReconciliationResult =
  | {
      outcome: "CHECKED";
      acceptance: "ACCEPTED";
      executionStatus: StoredExecutionStatus;
      checkedAt: Date;
      providerUpdatedAt: Date | null;
      changed: boolean;
    }
  | {
      outcome: "PAUSED";
      executionStatus: "UNAVAILABLE";
      reason: string;
    }
  | {
      outcome: "UNAVAILABLE";
      executionStatus: "UNAVAILABLE";
      reason: string;
    };

export async function reconcileF10BundleDeployment(
  deploymentId: string,
  options: { actorId?: string | null; statusTransport?: ProviderStatusTransport } = {},
): Promise<ReconciliationResult> {
  const [deployment] = await db.select().from(f10BundleDeploymentsTable)
    .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
  if (!deployment) return { outcome: "UNAVAILABLE", executionStatus: "UNAVAILABLE", reason: "deployment not found" };

  if (deployment.executionStatus === "COMPLETED" || deployment.executionStatus === "FAILED") {
    return {
      outcome: "CHECKED",
      acceptance: "ACCEPTED",
      executionStatus: deployment.executionStatus,
      checkedAt: deployment.executionCheckedAt ?? deployment.updatedAt,
      providerUpdatedAt: deployment.providerExecutionUpdatedAt,
      changed: false,
    };
  }

  const [receipt] = await db.select().from(f10BundleDeploymentReceiptsTable)
    .where(eq(f10BundleDeploymentReceiptsTable.deploymentId, deployment.id)).limit(1);
  if (!receipt?.accepted || !receipt.providerReceiptId) {
    const reason = "accepted receipt has no provider operation ID";
    await pauseF10Reconciliation(deployment, reason, false);
    return { outcome: "PAUSED", executionStatus: "UNAVAILABLE", reason };
  }

  const [connection] = await db.select().from(f10ProviderConnectionsTable)
    .where(and(
      eq(f10ProviderConnectionsTable.id, deployment.connectionRef),
      eq(f10ProviderConnectionsTable.tenantId, deployment.tenantId),
    )).limit(1);
  if (!connection?.active || connection.provider !== deployment.provider) {
    const reason = "provider connection is missing or revoked";
    await pauseF10Reconciliation(deployment, reason, true);
    return { outcome: "PAUSED", executionStatus: "UNAVAILABLE", reason };
  }

  const keyring = authorizationKeyringFromEnv();
  let authorizationRef: string;
  try {
    const opened = openAuthorizationRef(connection.authorizationRef, keyring, process.env.SESSION_SECRET);
    authorizationRef = opened.value;
    if (opened.needsReencryption || connection.authorizationKeyVersion !== keyring.current.version) {
      await db.update(f10ProviderConnectionsTable).set({
        authorizationRef: sealAuthorizationRef(opened.value, keyring),
        authorizationKeyVersion: keyring.current.version,
        reconnectRequiredAt: null,
        reconnectReason: null,
      }).where(and(
        eq(f10ProviderConnectionsTable.id, connection.id),
        eq(f10ProviderConnectionsTable.authorizationRef, connection.authorizationRef),
      ));
    }
  } catch (error) {
    if (!(error instanceof AuthorizationKeyUnavailableError)) throw error;
    const reason = error.message;
    await db.update(f10ProviderConnectionsTable).set({
      active: false,
      reconnectRequiredAt: new Date(),
      reconnectReason: reason,
    }).where(eq(f10ProviderConnectionsTable.id, connection.id));
    await pauseF10Reconciliation(deployment, reason, true);
    return { outcome: "PAUSED", executionStatus: "UNAVAILABLE", reason };
  }
  const checkedAt = new Date();
  const providerStatus = await (options.statusTransport ?? providerBrokerStatusTransport())({
    provider: deployment.provider as Family,
    target: deployment.target,
    authorizationRef,
    operationId: receipt.providerReceiptId,
    deadline: new Date(Date.now() + 30_000),
  });
  const providerUpdatedAt = providerStatus.updatedAt ? new Date(providerStatus.updatedAt) : null;
  if (providerUpdatedAt && Number.isNaN(providerUpdatedAt.getTime())) {
    throw Object.assign(new Error("provider returned an invalid status timestamp"), { status: 502 });
  }
  const changed = shouldApplyProviderExecutionStatus(
    deployment.executionStatus as StoredExecutionStatus,
    deployment.providerExecutionUpdatedAt,
    providerStatus.status,
    providerUpdatedAt,
  );
  const refreshProviderTimestamp = shouldRefreshProviderExecutionTimestamp(
    deployment.executionStatus as StoredExecutionStatus,
    deployment.providerExecutionUpdatedAt,
    providerStatus.status,
    providerUpdatedAt,
  );
  const observationFence = deployment.providerExecutionUpdatedAt
    ? eq(f10BundleDeploymentsTable.providerExecutionUpdatedAt, deployment.providerExecutionUpdatedAt)
    : isNull(f10BundleDeploymentsTable.providerExecutionUpdatedAt);
  const statusChanged = await db.transaction(async tx => {
    if (!changed) {
      await tx.update(f10BundleDeploymentsTable)
        .set({
          executionCheckedAt: checkedAt,
          ...(refreshProviderTimestamp ? { providerExecutionUpdatedAt: providerUpdatedAt } : {}),
          updatedAt: checkedAt,
        })
        .where(and(eq(f10BundleDeploymentsTable.id, deployment.id), observationFence));
      return false;
    }
    const [transitioned] = await tx.update(f10BundleDeploymentsTable)
      .set({
        executionStatus: providerStatus.status,
        executionCheckedAt: checkedAt,
        providerExecutionUpdatedAt: providerUpdatedAt,
        updatedAt: checkedAt,
      })
      .where(and(
        eq(f10BundleDeploymentsTable.id, deployment.id),
        eq(f10BundleDeploymentsTable.executionStatus, deployment.executionStatus),
        observationFence,
      ))
      .returning({ id: f10BundleDeploymentsTable.id });
    if (!transitioned) return false;
    await tx.insert(f10BundleDeploymentAuditTable).values({
      deploymentId: deployment.id,
      actorId: options.actorId ?? null,
      fromState: `EXECUTION_${deployment.executionStatus}`,
      toState: `EXECUTION_${providerStatus.status}`,
      reason: `provider operation ${receipt.providerReceiptId} reconciled through connected ${deployment.provider} account`,
    });
    return true;
  });
  const [persisted] = await db.select({
    executionStatus: f10BundleDeploymentsTable.executionStatus,
    executionCheckedAt: f10BundleDeploymentsTable.executionCheckedAt,
    providerExecutionUpdatedAt: f10BundleDeploymentsTable.providerExecutionUpdatedAt,
  }).from(f10BundleDeploymentsTable).where(eq(f10BundleDeploymentsTable.id, deployment.id)).limit(1);
  return {
    outcome: "CHECKED",
    acceptance: "ACCEPTED",
    executionStatus: persisted!.executionStatus as StoredExecutionStatus,
    checkedAt: persisted!.executionCheckedAt ?? checkedAt,
    providerUpdatedAt: persisted!.providerExecutionUpdatedAt,
    changed: statusChanged,
  };
}

export async function runF10ReconciliationSweep(options: {
  batchSize?: number;
  minCheckIntervalMs?: number;
} = {}): Promise<{ selected: number; checked: number; paused: number; unavailable: number; failed: number; skipped: boolean }> {
  if (sweepInFlight) {
    return { selected: 0, checked: 0, paused: 0, unavailable: 0, failed: 0, skipped: true };
  }
  sweepInFlight = true;
  try {
    const result = await runF10ReconciliationWorker(options);
    await retryF10PauseNotifications(options.batchSize ?? DEFAULT_BATCH_SIZE);
    return result;
  } finally {
    sweepInFlight = false;
  }
}

export async function runF10ReconciliationWorker(options: {
  batchSize?: number;
  minCheckIntervalMs?: number;
  claimLeaseMs?: number;
  reconcile?: (id: string) => Promise<ReconciliationResult>;
} = {}): Promise<{ selected: number; checked: number; paused: number; unavailable: number; failed: number; skipped: boolean }> {
  const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, options.batchSize ?? DEFAULT_BATCH_SIZE));
  const now = new Date();
  const dueBefore = new Date(now.getTime() - (options.minCheckIntervalMs ?? DEFAULT_MIN_CHECK_INTERVAL_MS));
  const claimToken = randomUUID();
  const claimExpiresAt = new Date(now.getTime() + Math.max(1, options.claimLeaseMs ?? DEFAULT_CLAIM_LEASE_MS));
  const claimed = await db.execute<{ id: string }>(sql`
    WITH candidates AS (
      SELECT id
      FROM ${f10BundleDeploymentsTable}
      WHERE state = 'ACKNOWLEDGED'
        AND execution_status IN ('NOT_CONFIRMED', 'ACCEPTED', 'RUNNING')
        AND reconciliation_paused_at IS NULL
        AND (execution_checked_at IS NULL OR execution_checked_at < ${dueBefore})
        AND (reconciliation_claim_expires_at IS NULL OR reconciliation_claim_expires_at < ${now})
      ORDER BY execution_checked_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE ${f10BundleDeploymentsTable} AS deployment
    SET reconciliation_claim_token = ${claimToken},
        reconciliation_claim_expires_at = ${claimExpiresAt}
    FROM candidates
    WHERE deployment.id = candidates.id
    RETURNING deployment.id
  `);
  const candidates = claimed.rows.map(row => ({ id: row.id }));

  try {
    const settled = await settleF10ReconciliationCandidates(candidates, options.reconcile);
    const summary = { selected: candidates.length, checked: 0, paused: 0, unavailable: 0, failed: 0, skipped: false };
    for (const result of settled) {
      if (result.status === "rejected") summary.failed += 1;
      else if (result.value.outcome === "CHECKED") summary.checked += 1;
      else if (result.value.outcome === "PAUSED") summary.paused += 1;
      else summary.unavailable += 1;
    }
    return summary;
  } finally {
    if (candidates.length > 0) {
      await db.update(f10BundleDeploymentsTable)
        .set({ reconciliationClaimToken: null, reconciliationClaimExpiresAt: null })
        .where(and(
          inArray(f10BundleDeploymentsTable.id, candidates.map(candidate => candidate.id)),
          eq(f10BundleDeploymentsTable.reconciliationClaimToken, claimToken),
        ));
    }
  }
}

export async function retryF10PauseNotifications(batchSize: number = DEFAULT_BATCH_SIZE): Promise<number> {
  const paused = await db.select({
    id: f10BundleDeploymentsTable.id,
    tenantId: f10BundleDeploymentsTable.tenantId,
    provider: f10BundleDeploymentsTable.provider,
    target: f10BundleDeploymentsTable.target,
    reason: f10BundleDeploymentsTable.reconciliationPauseReason,
    pausedAt: f10BundleDeploymentsTable.reconciliationPausedAt,
  }).from(f10BundleDeploymentsTable)
    .where(and(
      eq(f10BundleDeploymentsTable.reconciliationPauseNotificationRequired, true),
      isNull(f10BundleDeploymentsTable.reconciliationPauseNotifiedAt),
    ))
    .orderBy(asc(f10BundleDeploymentsTable.reconciliationPausedAt))
    .limit(Math.max(1, Math.min(MAX_BATCH_SIZE, batchSize)));

  const results = await Promise.all(paused.map(async deployment => {
    if (!deployment.pausedAt || !deployment.reason) return false;
    return notifyF10ReconciliationPaused({
      deploymentId: deployment.id,
      ownerUserId: deployment.tenantId,
      provider: deployment.provider,
      target: deployment.target,
      reason: deployment.reason,
      pausedAt: deployment.pausedAt,
    });
  }));
  return results.filter(Boolean).length;
}

export async function settleF10ReconciliationCandidates(
  candidates: readonly { id: string }[],
  reconcile: ((id: string) => Promise<ReconciliationResult>) | undefined = reconcileF10BundleDeployment,
  recordFailedAttempt: (id: string, checkedAt: Date) => Promise<void> = async (id, checkedAt) => {
    await db.update(f10BundleDeploymentsTable)
      .set({ executionCheckedAt: checkedAt, updatedAt: checkedAt })
      .where(and(
        eq(f10BundleDeploymentsTable.id, id),
        inArray(f10BundleDeploymentsTable.executionStatus, ACTIVE_EXECUTION_STATUSES),
        isNull(f10BundleDeploymentsTable.reconciliationPausedAt),
      ));
  },
): Promise<PromiseSettledResult<ReconciliationResult>[]> {
  return Promise.allSettled(candidates.map(async candidate => {
    try {
      return await reconcile(candidate.id);
    } catch (error) {
      // A failed provider check still counts as an attempt. Persisting the
      // timestamp moves this row behind never-checked/due rows until the next
      // interval, so a small set of failures cannot monopolize every batch.
      await recordFailedAttempt(candidate.id, new Date());
      throw error;
    }
  }));
}

export function startF10ReconciliationSweeper(): () => void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return () => {};
  const run = (): void => {
    void runF10ReconciliationSweep().then(
      result => logger.info(result, "[f10-reconciliation] bounded sweep completed"),
      err => logger.warn({ err }, "[f10-reconciliation] sweep failed; next tick will retry"),
    );
  };
  const initial = setTimeout(run, INITIAL_SWEEP_DELAY_MS);
  const interval = setInterval(run, SWEEP_INTERVAL_MS);
  initial.unref();
  interval.unref();
  logger.info(
    { intervalMinutes: SWEEP_INTERVAL_MS / 60_000, batchSize: DEFAULT_BATCH_SIZE },
    "[f10-reconciliation] periodic bounded sweep started",
  );
  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
