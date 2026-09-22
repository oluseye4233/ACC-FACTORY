import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  db,
  f10BundleDeploymentReceiptsTable,
  f10BundleDeploymentsTable,
  f10ProviderConnectionsTable,
  usersTable,
} from "@workspace/db";

const { sendF10ReconciliationPaused } = vi.hoisted(() => ({
  sendF10ReconciliationPaused: vi.fn(),
}));

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendF10ReconciliationPaused,
  };
});

import {
  pauseF10Reconciliation,
  reconcileF10BundleDeployment,
  retryF10PauseNotifications,
  settleF10ReconciliationCandidates,
} from "./f10-reconciliation";
import { notifyF10ReconciliationPaused } from "./notifications";

describe("pauseF10Reconciliation", () => {
  it("notifies the owner only for the first successful pause claim", async () => {
    const claimPause = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const notifyOwner = vi.fn().mockResolvedValue(true);
    const deployment = {
      id: "deployment-1",
      tenantId: "owner-1",
      provider: "AWS",
      target: "production",
    };

    await pauseF10Reconciliation(
      deployment,
      "provider connection is missing or revoked",
      true,
      { claimPause, notifyOwner },
    );
    await pauseF10Reconciliation(
      deployment,
      "provider connection is missing or revoked",
      true,
      { claimPause, notifyOwner },
    );

    expect(claimPause).toHaveBeenCalledTimes(2);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      deploymentId: "deployment-1",
      ownerUserId: "owner-1",
      provider: "AWS",
      target: "production",
      reason: "provider connection is missing or revoked",
    }));
  });

  it("does not notify for pauses that reconnecting cannot resolve", async () => {
    const claimPause = vi.fn().mockResolvedValue(true);
    const notifyOwner = vi.fn().mockResolvedValue(true);

    await pauseF10Reconciliation(
      { id: "deployment-2", tenantId: "owner-2", provider: "AZURE", target: "prod" },
      "accepted receipt has no provider operation ID",
      false,
      { claimPause, notifyOwner },
    );

    expect(claimPause).toHaveBeenCalledOnce();
    expect(notifyOwner).not.toHaveBeenCalled();
  });
});

describe("settleF10ReconciliationCandidates", () => {
  it("records every failed check so a full failed batch cannot starve later deployments", async () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({ id: `failed-${index}` }));
    const reconcile = vi.fn(async () => {
      throw new Error("provider temporarily unavailable");
    });
    const recordFailedAttempt = vi.fn(async (_id: string, _checkedAt: Date) => undefined);

    const settled = await settleF10ReconciliationCandidates(candidates, reconcile, recordFailedAttempt);

    expect(settled).toHaveLength(8);
    expect(settled.every(result => result.status === "rejected")).toBe(true);
    expect(recordFailedAttempt).toHaveBeenCalledTimes(8);
    expect(recordFailedAttempt.mock.calls.map(([id]) => id)).toEqual(candidates.map(candidate => candidate.id));
  });

  it("does not back off successful or explicitly paused checks", async () => {
    const recordFailedAttempt = vi.fn(async (_id: string, _checkedAt: Date) => undefined);
    const settled = await settleF10ReconciliationCandidates(
      [{ id: "checked" }, { id: "paused" }],
      async id => id === "checked"
        ? {
            outcome: "CHECKED",
            acceptance: "ACCEPTED",
            executionStatus: "RUNNING",
            checkedAt: new Date(),
            providerUpdatedAt: null,
            changed: false,
          }
        : {
            outcome: "PAUSED",
            executionStatus: "UNAVAILABLE",
            reason: "provider connection is missing or revoked",
          },
      recordFailedAttempt,
    );

    expect(settled.every(result => result.status === "fulfilled")).toBe(true);
    expect(recordFailedAttempt).not.toHaveBeenCalled();
  });
});

describe("paused deployment owner notifications", () => {
  let ownerId = "";
  let revokedConnectionId = "";
  const deploymentIds: string[] = [];
  const ownerEmail = `f10-paused-owner-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const [owner] = await db.insert(usersTable).values({
      clerkUserId: `f10-paused-owner-${randomUUID()}`,
      email: ownerEmail,
    }).returning();
    ownerId = owner!.id;

    const [connection] = await db.insert(f10ProviderConnectionsTable).values({
      tenantId: ownerId,
      provider: "GEMINI_AGENTS",
      name: `revoked-gemini-${randomUUID()}`,
      authorizationRef: "revoked-provider-authorization",
      scopes: [],
      active: false,
      revokedAt: new Date(),
    }).returning();
    revokedConnectionId = connection!.id;
  });

  beforeEach(() => {
    sendF10ReconciliationPaused.mockReset();
  });

  afterEach(async () => {
    if (deploymentIds.length === 0) return;
    await db.delete(f10BundleDeploymentReceiptsTable)
      .where(inArray(f10BundleDeploymentReceiptsTable.deploymentId, deploymentIds));
    await db.delete(f10BundleDeploymentsTable)
      .where(inArray(f10BundleDeploymentsTable.id, deploymentIds));
    deploymentIds.length = 0;
  });

  afterAll(async () => {
    if (revokedConnectionId) {
      await db.delete(f10ProviderConnectionsTable)
        .where(eq(f10ProviderConnectionsTable.id, revokedConnectionId));
    }
    if (ownerId) {
      await db.delete(usersTable).where(eq(usersTable.id, ownerId));
    }
  });

  async function createDeployment(): Promise<string> {
    const [deployment] = await db.insert(f10BundleDeploymentsTable).values({
      tenantId: ownerId,
      actorId: ownerId,
      sourceArtifactId: randomUUID(),
      provider: "GEMINI_AGENTS",
      target: "GEMINI_AGENTS_API",
      connectionRef: revokedConnectionId,
      outputKind: "PDD",
      bundleHash: `bundle-${randomUUID()}`,
      idempotencyKey: randomUUID(),
      policySnapshot: { schemaVersion: "f10-native-v1" },
      state: "ACKNOWLEDGED",
      executionStatus: "ACCEPTED",
    }).returning();
    deploymentIds.push(deployment!.id);

    await db.insert(f10BundleDeploymentReceiptsTable).values({
      deploymentId: deployment!.id,
      bundleHash: deployment!.bundleHash,
      provider: "GEMINI_AGENTS",
      target: "GEMINI_AGENTS_API",
      accepted: true,
      providerReceiptId: `operation-${randomUUID()}`,
      receiptSignature: `signed-${randomUUID()}`,
      payload: { immutable: true },
    });
    return deployment!.id;
  }

  it("emails the deployment owner once with the provider-specific reconnect alert", async () => {
    sendF10ReconciliationPaused.mockResolvedValue({ ok: true, id: "email-1" });
    const deploymentId = await createDeployment();

    await reconcileF10BundleDeployment(deploymentId);
    await reconcileF10BundleDeployment(deploymentId);

    expect(sendF10ReconciliationPaused).toHaveBeenCalledOnce();
    expect(sendF10ReconciliationPaused).toHaveBeenCalledWith({
      to: ownerEmail,
      provider: "GEMINI_AGENTS",
      target: "GEMINI_AGENTS_API",
      reason: "provider connection is missing or revoked",
      reconnectUrl: "/f10",
    });
    const [deployment] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(deployment!.reconciliationPauseNotifiedAt).toBeInstanceOf(Date);
    expect(deployment!.reconciliationPauseNotificationClaimedAt).toBeNull();
  });

  it("lets only one overlapping retry claim and send the reconnect alert", async () => {
    let releaseEmail!: (result: { ok: true; id: string }) => void;
    const emailPending = new Promise<{ ok: true; id: string }>((resolve) => {
      releaseEmail = resolve;
    });
    sendF10ReconciliationPaused.mockReturnValue(emailPending);
    const deploymentId = await createDeployment();
    const pausedAt = new Date();

    await db.update(f10BundleDeploymentsTable).set({
      reconciliationPausedAt: pausedAt,
      reconciliationPauseReason: "provider connection is missing or revoked",
      reconciliationPauseNotificationRequired: true,
    }).where(eq(f10BundleDeploymentsTable.id, deploymentId));

    const winningRetry = retryF10PauseNotifications();
    await vi.waitFor(() => {
      expect(sendF10ReconciliationPaused).toHaveBeenCalledOnce();
    });
    const losingRetry = retryF10PauseNotifications();

    await expect(losingRetry).resolves.toBe(0);
    expect(sendF10ReconciliationPaused).toHaveBeenCalledOnce();
    releaseEmail({ ok: true, id: "email-overlap" });
    await expect(winningRetry).resolves.toBe(1);

    expect(sendF10ReconciliationPaused).toHaveBeenCalledWith({
      to: ownerEmail,
      provider: "GEMINI_AGENTS",
      target: "GEMINI_AGENTS_API",
      reason: "provider connection is missing or revoked",
      reconnectUrl: "/f10",
    });
    const [deployment] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(deployment!.reconciliationPauseNotifiedAt).toBeInstanceOf(Date);
    expect(deployment!.reconciliationPauseNotificationClaimedAt).toBeNull();
  });

  it.each([
    {
      stalePath: "completion",
      staleResult: { ok: true as const, id: "email-stale-success" },
      staleReturn: true,
    },
    {
      stalePath: "release",
      staleResult: { ok: false as const, error: "stale provider failure" },
      staleReturn: false,
    },
  ])("takes over an expired claim without letting the stale worker's $stalePath mutate it", async ({
    staleResult,
    staleReturn,
  }) => {
    type EmailResult =
      | { ok: true; id: string }
      | { ok: false; error: string };
    let releaseStaleEmail!: (result: EmailResult) => void;
    let releaseRetryEmail!: (result: EmailResult) => void;
    const staleEmailPending = new Promise<EmailResult>((resolve) => {
      releaseStaleEmail = resolve;
    });
    const retryEmailPending = new Promise<EmailResult>((resolve) => {
      releaseRetryEmail = resolve;
    });
    sendF10ReconciliationPaused
      .mockReturnValueOnce(staleEmailPending)
      .mockReturnValueOnce(retryEmailPending);
    const deploymentId = await createDeployment();
    const pausedAt = new Date();
    const notificationArgs = {
      deploymentId,
      ownerUserId: ownerId,
      provider: "GEMINI_AGENTS",
      target: "GEMINI_AGENTS_API",
      reason: "provider connection is missing or revoked",
      pausedAt,
    };
    await db.update(f10BundleDeploymentsTable).set({
      reconciliationPausedAt: pausedAt,
      reconciliationPauseReason: notificationArgs.reason,
      reconciliationPauseNotificationRequired: true,
    }).where(eq(f10BundleDeploymentsTable.id, deploymentId));

    const staleWorker = notifyF10ReconciliationPaused(notificationArgs);
    await vi.waitFor(() => {
      expect(sendF10ReconciliationPaused).toHaveBeenCalledTimes(1);
    });

    const expiredClaimedAt = new Date(Date.now() - 11 * 60_000);
    await db.update(f10BundleDeploymentsTable).set({
      reconciliationPauseNotificationClaimedAt: expiredClaimedAt,
    }).where(eq(f10BundleDeploymentsTable.id, deploymentId));

    const retry = retryF10PauseNotifications();
    await vi.waitFor(() => {
      expect(sendF10ReconciliationPaused).toHaveBeenCalledTimes(2);
    });

    const [claimedDeployment] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(claimedDeployment!.reconciliationPauseNotificationClaimedAt).toBeInstanceOf(Date);
    expect(claimedDeployment!.reconciliationPauseNotificationClaimedAt).not.toEqual(expiredClaimedAt);

    releaseStaleEmail(staleResult);
    await expect(staleWorker).resolves.toBe(staleReturn);
    const [stillClaimed] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(stillClaimed!.reconciliationPauseNotificationClaimedAt)
      .toEqual(claimedDeployment!.reconciliationPauseNotificationClaimedAt);
    expect(stillClaimed!.reconciliationPauseNotifiedAt).toBeNull();

    releaseRetryEmail({ ok: true, id: "email-expired-claim-retry" });
    await expect(retry).resolves.toBe(1);

    expect(sendF10ReconciliationPaused).toHaveBeenCalledTimes(2);
    expect(sendF10ReconciliationPaused).toHaveBeenNthCalledWith(2, {
      to: ownerEmail,
      provider: "GEMINI_AGENTS",
      target: "GEMINI_AGENTS_API",
      reason: "provider connection is missing or revoked",
      reconnectUrl: "/f10",
    });
    const [deliveredDeployment] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(deliveredDeployment!.reconciliationPauseNotifiedAt).toBeInstanceOf(Date);
    expect(deliveredDeployment!.reconciliationPauseNotificationClaimedAt).toBeNull();
  });

  it("retries a failed email dispatch, stamps the successful retry, and does not send duplicates", async () => {
    sendF10ReconciliationPaused
      .mockResolvedValueOnce({
        ok: false,
        error: "provider rejected the message",
      })
      .mockResolvedValueOnce({ ok: true, id: "email-retry" });
    const deploymentId = await createDeployment();

    await reconcileF10BundleDeployment(deploymentId);

    expect(sendF10ReconciliationPaused).toHaveBeenCalledOnce();
    expect(sendF10ReconciliationPaused).toHaveBeenCalledWith(
      expect.objectContaining({ to: ownerEmail, provider: "GEMINI_AGENTS" }),
    );
    const [deployment] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(deployment!.reconciliationPauseNotifiedAt).toBeNull();
    expect(deployment!.reconciliationPauseNotificationClaimedAt).toBeNull();

    expect(await retryF10PauseNotifications()).toBe(1);
    const [retriedDeployment] = await db.select().from(f10BundleDeploymentsTable)
      .where(eq(f10BundleDeploymentsTable.id, deploymentId)).limit(1);
    expect(retriedDeployment!.reconciliationPauseNotifiedAt).toBeInstanceOf(Date);
    expect(retriedDeployment!.reconciliationPauseNotificationClaimedAt).toBeNull();

    expect(await retryF10PauseNotifications()).toBe(0);
    expect(sendF10ReconciliationPaused).toHaveBeenCalledTimes(2);
  });
});
