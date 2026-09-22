import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  f10BundleDeploymentAuditTable,
  f10BundleDeploymentReceiptsTable,
  f10BundleDeploymentsTable,
  f10ProviderConnectionsTable,
  usersTable,
} from "@workspace/db";
import {
  runF10ReconciliationSweep,
  runF10ReconciliationWorker,
  type ReconciliationResult,
} from "../src/lib/f10-reconciliation";

describe("F10 automatic reconciliation sweep", () => {
  let tenantId = "";
  let connectionId = "";
  const deploymentIds: string[] = [];
  const receiptSignatures = new Map<string, string>();
  const ancient = new Date("2000-01-01T00:00:00.000Z");

  beforeAll(async () => {
    const [user] = await db.insert(usersTable).values({
      clerkUserId: `f10-reconciliation-${randomUUID()}`,
      email: `f10-reconciliation-${randomUUID()}@example.test`,
    }).returning();
    tenantId = user!.id;

    const [connection] = await db.insert(f10ProviderConnectionsTable).values({
      tenantId,
      provider: "OPENAI_AGENTS",
      name: `revoked-reconciliation-${randomUUID()}`,
      authorizationRef: "intentionally-unusable-after-revocation",
      scopes: [],
      active: false,
      revokedAt: new Date(),
      createdAt: ancient,
    }).returning();
    connectionId = connection!.id;

    for (const executionStatus of ["ACCEPTED", "RUNNING", "COMPLETED", "FAILED"] as const) {
      const [deployment] = await db.insert(f10BundleDeploymentsTable).values({
        tenantId,
        actorId: tenantId,
        sourceArtifactId: randomUUID(),
        provider: "OPENAI_AGENTS",
        target: "OPENAI_AGENTS_SDK",
        connectionRef: connectionId,
        outputKind: "PDD",
        bundleHash: `bundle-${executionStatus.toLowerCase()}-${randomUUID()}`,
        idempotencyKey: randomUUID(),
        policySnapshot: { schemaVersion: "f10-native-v1" },
        state: "ACKNOWLEDGED",
        executionStatus,
        createdAt: ancient,
        updatedAt: ancient,
      }).returning();
      deploymentIds.push(deployment!.id);

      const signature = `signed-${executionStatus.toLowerCase()}-${randomUUID()}`;
      receiptSignatures.set(deployment!.id, signature);
      await db.insert(f10BundleDeploymentReceiptsTable).values({
        deploymentId: deployment!.id,
        bundleHash: deployment!.bundleHash,
        provider: "OPENAI_AGENTS",
        target: "OPENAI_AGENTS_SDK",
        accepted: true,
        providerReceiptId: `operation-${executionStatus.toLowerCase()}-${randomUUID()}`,
        receiptSignature: signature,
        payload: { executionStatus, immutable: true },
        createdAt: ancient,
      });
    }
  });

  afterAll(async () => {
    if (deploymentIds.length > 0) {
      await db.delete(f10BundleDeploymentAuditTable)
        .where(inArray(f10BundleDeploymentAuditTable.deploymentId, deploymentIds));
      await db.delete(f10BundleDeploymentReceiptsTable)
        .where(inArray(f10BundleDeploymentReceiptsTable.deploymentId, deploymentIds));
      await db.delete(f10BundleDeploymentsTable)
        .where(inArray(f10BundleDeploymentsTable.id, deploymentIds));
    }
    if (connectionId) {
      await db.delete(f10ProviderConnectionsTable)
        .where(eq(f10ProviderConnectionsTable.id, connectionId));
    }
    if (tenantId) {
      await db.delete(usersTable).where(eq(usersTable.id, tenantId));
    }
  });

  it("selects due active operations once, pauses revoked connections, and preserves signed receipts", async () => {
    const firstSweep = runF10ReconciliationSweep({ batchSize: 2, minCheckIntervalMs: 0 });
    const overlappingSweep = runF10ReconciliationSweep({ batchSize: 2, minCheckIntervalMs: 0 });
    const [first, overlapping] = await Promise.all([firstSweep, overlappingSweep]);

    expect(first).toMatchObject({
      selected: 2,
      checked: 0,
      paused: 2,
      unavailable: 0,
      failed: 0,
      skipped: false,
    });
    expect(overlapping).toEqual({
      selected: 0,
      checked: 0,
      paused: 0,
      unavailable: 0,
      failed: 0,
      skipped: true,
    });

    const deployments = await db.select().from(f10BundleDeploymentsTable)
      .where(and(
        eq(f10BundleDeploymentsTable.tenantId, tenantId),
        inArray(f10BundleDeploymentsTable.id, deploymentIds),
      ));
    const byStatus = new Map(deployments.map(row => [row.executionStatus, row]));

    for (const status of ["ACCEPTED", "RUNNING"] as const) {
      expect(byStatus.get(status)).toMatchObject({
        reconciliationPauseReason: "provider connection is missing or revoked",
      });
      expect(byStatus.get(status)!.reconciliationPausedAt).toBeInstanceOf(Date);
    }
    for (const status of ["COMPLETED", "FAILED"] as const) {
      expect(byStatus.get(status)!.reconciliationPausedAt).toBeNull();
      expect(byStatus.get(status)!.reconciliationPauseReason).toBeNull();
    }

    const receipts = await db.select().from(f10BundleDeploymentReceiptsTable)
      .where(inArray(f10BundleDeploymentReceiptsTable.deploymentId, deploymentIds));
    expect(receipts).toHaveLength(4);
    for (const receipt of receipts) {
      expect(receipt.receiptSignature).toBe(receiptSignatures.get(receipt.deploymentId));
      expect(receipt.payload).toMatchObject({ immutable: true });
    }
  });

  it("lets separate workers claim disjoint batches and reclaim expired leases", async () => {
    const workerDeploymentIds: string[] = [];
    try {
      for (let index = 0; index < 3; index += 1) {
        const [deployment] = await db.insert(f10BundleDeploymentsTable).values({
          tenantId,
          actorId: tenantId,
          sourceArtifactId: randomUUID(),
          provider: "OPENAI_AGENTS",
          target: "OPENAI_AGENTS_SDK",
          connectionRef: connectionId,
          outputKind: "PDD",
          bundleHash: `worker-claim-${index}-${randomUUID()}`,
          idempotencyKey: randomUUID(),
          policySnapshot: { schemaVersion: "f10-native-v1" },
          state: "ACKNOWLEDGED",
          executionStatus: "RUNNING",
          createdAt: ancient,
          updatedAt: ancient,
        }).returning();
        workerDeploymentIds.push(deployment!.id);
      }

      const checkedIds: string[] = [];
      const reconcile = async (id: string): Promise<ReconciliationResult> => {
        checkedIds.push(id);
        await new Promise(resolve => setTimeout(resolve, 25));
        return {
          outcome: "CHECKED",
          acceptance: "ACCEPTED",
          executionStatus: "RUNNING",
          checkedAt: new Date(),
          providerUpdatedAt: null,
          changed: false,
        };
      };
      const [first, second] = await Promise.all([
        runF10ReconciliationWorker({ batchSize: 2, minCheckIntervalMs: 0, reconcile }),
        runF10ReconciliationWorker({ batchSize: 2, minCheckIntervalMs: 0, reconcile }),
      ]);

      expect(first.selected + second.selected).toBe(3);
      expect(checkedIds).toHaveLength(3);
      expect(new Set(checkedIds).size).toBe(3);

      const expiredId = workerDeploymentIds[0]!;
      await db.update(f10BundleDeploymentsTable).set({
        executionCheckedAt: new Date(Date.now() + 60_000),
      }).where(inArray(f10BundleDeploymentsTable.id, workerDeploymentIds.slice(1)));
      await db.update(f10BundleDeploymentsTable).set({
        executionCheckedAt: ancient,
        reconciliationClaimToken: randomUUID(),
        reconciliationClaimExpiresAt: new Date(Date.now() - 1_000),
      }).where(eq(f10BundleDeploymentsTable.id, expiredId));
      const reclaimedIds: string[] = [];
      await runF10ReconciliationWorker({
        batchSize: 1,
        minCheckIntervalMs: 0,
        reconcile: async id => {
          reclaimedIds.push(id);
          return reconcile(id);
        },
      });
      expect(reclaimedIds).toEqual([expiredId]);
    } finally {
      if (workerDeploymentIds.length > 0) {
        await db.delete(f10BundleDeploymentsTable)
          .where(inArray(f10BundleDeploymentsTable.id, workerDeploymentIds));
      }
    }
  });
});