import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, commandDeckTracesTable, harnessSessionsTable, type HarnessArtifact } from "@workspace/db";
import { createTraceEventSchema, traceIdempotencyKey } from "./command-deck-trace-contract";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const schema = createTraceEventSchema(["artifact_persisted", "document_published", "sc_gate_decision", "sc_pack_result", "sc_promotion"]);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function artifactOutputHash(content: unknown) {
  // Normalize exactly as JSON storage does before sorting object keys.
  return createHash("sha256").update(canonical(JSON.parse(JSON.stringify(content)))).digest("hex");
}

/** Called inside the artifact transaction. No corpus record is created here. */
export async function captureArtifactPersisted(tx: Transaction, artifact: HarnessArtifact) {
  const [session] = await tx.select({ id: harnessSessionsTable.id }).from(harnessSessionsTable)
    .where(and(eq(harnessSessionsTable.id, artifact.sessionId), eq(harnessSessionsTable.userId, artifact.userId)))
    .for("share");
  if (!session) throw new Error("Trace capture requires an owned session");
  const hash = artifactOutputHash(artifact.artifactContent);
  const key = traceIdempotencyKey("NONE", artifact.id, hash);
  const envelope = schema.parse({
    trace_id: session.id,
    parent_trace_id: null,
    stage: `F${artifact.featureId}`,
    stream: "NONE",
    event_type: "artifact_persisted",
    artifact_ref: `${artifact.id}@${hash}`,
    exemplar_id: null,
    actor_ref: createHash("sha256").update(`${session.id}:${artifact.userId}`).digest("hex"),
    occurred_at: artifact.createdAt.toISOString(),
    payload_hash: hash,
    eligibility: "NOT_ELIGIBLE",
    eligibility_reason: "CORPUS_CAPTURE_DISABLED_PENDING_CONSENT_AND_ETHICS_GATE",
    idempotency_key: key,
    processing_status: "DONE",
  });
  await tx.insert(commandDeckTracesTable).values({
    ownerUserId: artifact.userId, sessionId: artifact.sessionId, idempotencyKey: key, envelope,
  }).onConflictDoNothing({ target: commandDeckTracesTable.idempotencyKey });
}

/** Private owner-scoped read primitive; no public/admin cross-owner bypass. */
export async function listOwnedSessionTraces(userId: string, sessionId: string) {
  return db.select().from(commandDeckTracesTable)
    .where(and(eq(commandDeckTracesTable.ownerUserId, userId), eq(commandDeckTracesTable.sessionId, sessionId)))
    .orderBy(commandDeckTracesTable.createdAt, commandDeckTracesTable.id).limit(200);
}
