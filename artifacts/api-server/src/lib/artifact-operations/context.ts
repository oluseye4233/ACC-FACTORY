import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, artifactOperationEventsTable, commandDeckTracesTable, imprimaJobsTable, shortSprintRunsTable } from "@workspace/db";
import { createTraceEventSchema } from "../command-deck-trace-contract";
import { databaseProtection } from "./database-protection";

export type OperationsActor = { id: string; role: string; displayName: string | null };
export type OperationsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class OperationsError extends Error {
  constructor(public status: number, message: string, public code = "OPERATIONS_ERROR") { super(message); }
}
export function withOperationsActor<T>(actor: OperationsActor, fn: (tx: OperationsTx) => Promise<T>) {
  return db.transaction(async tx => {
    // Publish must carry the actual guards, not merely empty policy names.
    // Never downgrade to the superuser connection when a guard is missing.
    if (!(await databaseProtection(tx)).ready) throw new OperationsError(503, "Private artifact operations are unavailable until the deployment's database isolation and immutable-version guards are verified.", "DATABASE_GUARDS_MISSING");
    try { await tx.execute(sql`SET LOCAL ROLE atanda_artifact_operations`); }
    catch { throw new OperationsError(503, "Private artifact operations require the approved restricted database role.", "DATABASE_ROLE_UNAVAILABLE"); }
    await tx.execute(sql`select set_config('app.operations_actor', ${actor.id}, true), set_config('app.operations_admin', ${String(actor.role === "ADMIN")}, true)`);
    return fn(tx);
  });
}
export async function operationEvent(tx: OperationsTx, actor: OperationsActor, owner: string, workflowId: string, kind: string, action: string, revision: number, data: Record<string, unknown>) {
  await tx.insert(artifactOperationEventsTable).values({ userId: owner, actorId: actor.id, workflowId, kind, action, revision, data });
  const eventType = action.endsWith("_published") ? "document_published" : action;
  if (!["document_published", "sc_gate_decision", "sc_pack_result", "sc_promotion"].includes(eventType)) return;
  const [workflow] = kind === "imprima"
    ? await tx.select({ sessionId: imprimaJobsTable.sessionId, sourceHash: imprimaJobsTable.sourceHash, scope: imprimaJobsTable.sourceKind }).from(imprimaJobsTable).where(eq(imprimaJobsTable.id, workflowId))
    : await tx.select({ sessionId: shortSprintRunsTable.sessionId, sourceHash: shortSprintRunsTable.sourceHash, scope: shortSprintRunsTable.circuit }).from(shortSprintRunsTable).where(eq(shortSprintRunsTable.id, workflowId));
  if (!workflow?.sessionId) return; // Sessionless sources retain their private operation audit.
  const digest = (v: string) => createHash("sha256").update(v).digest("hex");
  const payloadHash = digest(JSON.stringify({ workflowId, action, revision, data }));
  const idempotencyKey = digest(`${kind}:${workflowId}:${action}:${revision}:${payloadHash}`);
  const sourceStages: Record<string, string> = { F3_MA: "F3", F4_MICRO_PDD: "F4", F5_SPC: "F5", F6_PDD: "F6", F7_MVP_PDD: "F7", F95_LIVING_PDD: "F9.5", F0_SERVICE: "F0", SPC_PLAYER: "F5", SC_ONE: "F4", SC_TWO: "F5" };
  const envelope = createTraceEventSchema(["document_published", "sc_gate_decision", "sc_pack_result", "sc_promotion"]).parse({
    trace_id: workflowId, parent_trace_id: workflow.sessionId,
    stage: sourceStages[workflow.scope] ?? "F0", stream: "NONE",
    event_type: eventType, artifact_ref: `${workflowId}@${workflow.sourceHash}`,
    exemplar_id: null, actor_ref: digest(`${workflow.sessionId}:${actor.id}`),
    occurred_at: new Date().toISOString(), payload_hash: payloadHash,
    eligibility: "NOT_ELIGIBLE", eligibility_reason: "CORPUS_CAPTURE_DISABLED_PENDING_CONSENT_AND_ETHICS_GATE",
    idempotency_key: idempotencyKey, processing_status: "DONE",
  });
  await tx.insert(commandDeckTracesTable).values({ ownerUserId: owner, sessionId: workflow.sessionId, idempotencyKey, envelope }).onConflictDoNothing();
}
export function humanName(actor: OperationsActor) {
  const name = actor.displayName?.trim();
  if (!name || name.length < 2) throw new OperationsError(400, "A named human profile is required for this action.");
  return name;
}
