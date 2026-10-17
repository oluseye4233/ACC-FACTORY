import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  db, harnessSessionsTable, harnessArtifactsTable, xvlEvalsetsTable,
  xvlVerificationRunsTable, vteVerificationFailuresTable, commandDeckTracesTable,
} from "@workspace/db";
import { artifactOutputHash } from "./command-deck-capture";
import { createTraceEventSchema, traceIdempotencyKey } from "./command-deck-trace-contract";
import {
  ADAPTER_ID, ADAPTER_VERSION, VERIFICATION_SCOPE, evalsetInputSchema,
  evaluateJsonContract, evalsetDigest, trackCatalog,
} from "./xvl-contract";
import type { z } from "zod/v4";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Run = typeof xvlVerificationRunsTable.$inferSelect;
const eventSchema = createTraceEventSchema(["xvl_verdict", "failure_case_opened"]);
export class XvlError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function ownedSession(tx: Tx, owner: string, sessionId: string) {
  const [session] = await tx.select().from(harnessSessionsTable).where(and(
    eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, owner),
  )).for("update").limit(1);
  if (!session) throw new XvlError(404, "Owned session not found");
  return session;
}
function evalsetView(row: typeof xvlEvalsetsTable.$inferSelect) {
  return {
    id: row.id, stage: row.stage, title: row.title, rules: row.rules,
    contentHash: row.contentHash, registeredAt: row.registeredAt.toISOString(),
  };
}
function runView(row: Run) {
  return {
    id: row.id, artifactId: row.artifactId, evalsetId: row.evalsetId, stage: row.stage,
    track: row.track, adapterId: row.adapterId, adapterVersion: row.adapterVersion,
    independence: row.independence, outcome: row.outcome,
    artifactHash: row.artifactHash, evalsetHash: row.evalsetHash,
    evidenceHash: row.evidenceHash, evidence: row.evidence, createdAt: row.createdAt.toISOString(),
  };
}
async function recordTrace(tx: Tx, run: Run, eventType: "xvl_verdict" | "failure_case_opened", sourceId: string) {
  const key = traceIdempotencyKey("E", `${eventType}:${sourceId}`, run.evidenceHash);
  const envelope = eventSchema.parse({
    trace_id: run.sessionId, parent_trace_id: null, stage: run.stage, stream: "E", event_type: eventType,
    artifact_ref: `${run.artifactId}@${run.artifactHash}`, exemplar_id: null,
    actor_ref: createHash("sha256").update(`${run.sessionId}:${run.ownerUserId}`).digest("hex"),
    occurred_at: run.createdAt.toISOString(), payload_hash: run.evidenceHash,
    verification: {
      run_id: run.id, track: run.track, verdict: run.outcome,
      independence: run.independence, evidence_hash: run.evidenceHash,
    },
    eligibility: "NOT_ELIGIBLE", eligibility_reason: "CORPUS_CAPTURE_DISABLED_PENDING_CONSENT_AND_ETHICS_GATE",
    idempotency_key: key, processing_status: "DONE",
  });
  await tx.insert(commandDeckTracesTable).values({
    ownerUserId: run.ownerUserId, sessionId: run.sessionId, idempotencyKey: key, envelope,
  }).onConflictDoNothing({ target: commandDeckTracesTable.idempotencyKey });
}

export async function registerEvalset(owner: string, sessionId: string, input: z.infer<typeof evalsetInputSchema>) {
  const parsed = evalsetInputSchema.parse(input);
  return db.transaction(async (tx) => {
    await ownedSession(tx, owner, sessionId);
    const [saved] = await tx.insert(xvlEvalsetsTable).values({
      ownerUserId: owner, sessionId, ...parsed, contentHash: evalsetDigest(parsed.stage, parsed.rules),
      // Transaction-start timestamps can backdate a contract while waiting on
      // another writer. Use actual DB time after acquiring the session lock.
      registeredAt: sql`clock_timestamp()`,
    }).returning();
    return evalsetView(saved!);
  });
}

export async function runVerification(owner: string, sessionId: string, artifactId: string, evalsetId: string) {
  return db.transaction(async (tx) => {
    await ownedSession(tx, owner, sessionId);
    const [artifact] = await tx.select().from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.id, artifactId), eq(harnessArtifactsTable.sessionId, sessionId),
      eq(harnessArtifactsTable.userId, owner),
    )).for("share").limit(1);
    const [evalset] = await tx.select().from(xvlEvalsetsTable).where(and(
      eq(xvlEvalsetsTable.id, evalsetId), eq(xvlEvalsetsTable.sessionId, sessionId),
      eq(xvlEvalsetsTable.ownerUserId, owner),
    )).for("share").limit(1);
    if (!artifact || !evalset) throw new XvlError(404, "Owned artifact or contract not found");
    if (`F${artifact.featureId}` !== evalset.stage) throw new XvlError(409, "Artifact and contract must belong to the same stage");
    if (artifact.createdAt <= evalset.registeredAt) {
      throw new XvlError(409, "Verification-first: register the contract, then generate a new artifact. Existing older artifacts cannot earn a verdict under this contract.");
    }
    const digest = evalsetDigest(evalset.stage, evalset.rules);
    if (digest !== evalset.contentHash) throw new XvlError(409, "The registered contract has changed; evidence cannot be issued");
    const artifactHash = artifactOutputHash(artifact.artifactContent);
    const [existing] = await tx.select().from(xvlVerificationRunsTable).where(and(
      eq(xvlVerificationRunsTable.artifactId, artifactId), eq(xvlVerificationRunsTable.evalsetId, evalsetId),
      eq(xvlVerificationRunsTable.adapterId, ADAPTER_ID), eq(xvlVerificationRunsTable.adapterVersion, ADAPTER_VERSION),
    )).limit(1);
    if (existing) {
      if (existing.artifactHash !== artifactHash || existing.evalsetHash !== digest) {
        throw new XvlError(409, "The evidence snapshot no longer matches the artifact or contract");
      }
      return runView(existing);
    }
    const result = evaluateJsonContract(artifact.artifactContent, evalset.rules);
    const evidence = {
      schemaVersion: 1, scope: VERIFICATION_SCOPE, track: "E",
      adapterId: ADAPTER_ID, adapterVersion: ADAPTER_VERSION, independence: "I2",
      artifactId, artifactHash, evalsetId, evalsetHash: digest, stage: evalset.stage,
      ...result,
      // No token/cost estimates masquerading as measurements.
      modelCalls: 0, tokenUsage: null, monetaryCost: null, producingModel: artifact.modelId,
    };
    const [saved] = await tx.insert(xvlVerificationRunsTable).values({
      ownerUserId: owner, sessionId, artifactId, evalsetId, stage: evalset.stage,
      track: "E", adapterId: ADAPTER_ID, adapterVersion: ADAPTER_VERSION, independence: "I2",
      outcome: result.outcome, artifactHash, evalsetHash: digest,
      evidenceHash: artifactOutputHash(evidence), evidence,
    }).returning();
    await recordTrace(tx, saved!, "xvl_verdict", saved!.id);
    if (result.outcome !== "PASS") {
      const [failure] = await tx.insert(vteVerificationFailuresTable).values({
        ownerUserId: owner, sessionId, runId: saved!.id, stage: saved!.stage,
      }).returning();
      await recordTrace(tx, saved!, "failure_case_opened", failure!.id);
    }
    return runView(saved!);
  });
}

export async function verificationWorkspace(owner: string, sessionId: string) {
  const [session] = await db.select().from(harnessSessionsTable).where(and(
    eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, owner),
  )).limit(1);
  if (!session) throw new XvlError(404, "Owned session not found");
  const owned = (t: { ownerUserId: AnyPgColumn; sessionId: AnyPgColumn }) =>
    and(eq(t.ownerUserId, owner), eq(t.sessionId, sessionId));
  const [artifacts, evalsets, runs, failures] = await Promise.all([
    db.select({
      id: harnessArtifactsTable.id, name: harnessArtifactsTable.name,
      featureId: harnessArtifactsTable.featureId, createdAt: harnessArtifactsTable.createdAt,
    }).from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.userId, owner), eq(harnessArtifactsTable.sessionId, sessionId),
    )).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(200),
    db.select().from(xvlEvalsetsTable).where(owned(xvlEvalsetsTable))
      .orderBy(desc(xvlEvalsetsTable.registeredAt), desc(xvlEvalsetsTable.id)).limit(200),
    db.select().from(xvlVerificationRunsTable).where(owned(xvlVerificationRunsTable))
      .orderBy(desc(xvlVerificationRunsTable.createdAt), desc(xvlVerificationRunsTable.id)).limit(200),
    db.select().from(vteVerificationFailuresTable).where(owned(vteVerificationFailuresTable))
      .orderBy(desc(vteVerificationFailuresTable.createdAt), desc(vteVerificationFailuresTable.id)).limit(200),
  ]);
  return {
    session: { id: session.id, name: session.sessionName }, scope: VERIFICATION_SCOPE,
    historyLimit: 200, tracks: trackCatalog,
    artifacts: artifacts.map((r) => ({ id: r.id, name: r.name, stage: `F${r.featureId}`, createdAt: r.createdAt.toISOString() })),
    evalsets: evalsets.map(evalsetView), runs: runs.map(runView),
    failureCases: failures.map((r) => ({
      id: r.id, runId: r.runId ?? r.sprintRunId!, sourceKind: r.sprintRunId ? "SHORT_SPRINTS" : "XVL", stage: r.stage, state: r.state,
      rejectedOutputOrigin: r.rejectedOutputOrigin, createdAt: r.createdAt.toISOString(),
    })),
  };
}
