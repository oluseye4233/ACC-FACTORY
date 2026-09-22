import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const f10ReleaseState = pgEnum("f10_release_state", [
  "REQUESTED", "VERIFYING", "AUTHORIZED", "QUEUED", "DISPATCHING",
  "ACKNOWLEDGED", "BLOCKED", "FAILED_PERMANENT", "DEAD_LETTERED", "CANCELLED",
]);
export const f10AttemptState = pgEnum("f10_attempt_state", ["CLAIMED", "ACKNOWLEDGED", "SUCCEEDED", "RETRYABLE", "PERMANENT", "FENCED"]);
export const f10Verdict = pgEnum("f10_verdict", ["PASS", "THRESHOLD_PASS", "MATH_VERIFIED", "FIT", "CLUSTER", "FAIL"]);

export const f10DestinationsTable = pgTable("f10_destinations", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull(), name: text("name").notNull(),
  adapterId: text("adapter_id").notNull(), adapterVersion: text("adapter_version").notNull(), endpoint: text("endpoint").notNull(),
  secretRef: text("secret_ref").notNull(), authorizationScopes: jsonb("authorization_scopes").notNull(),
  active: boolean("active").notNull().default(true), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ destinationTenantUniq: uniqueIndex("f10_destination_tenant_name_uniq").on(t.tenantId, t.name) }));

/** Metadata only: bytes remain in OSIRIS custody and are never persisted here. */
export const f10ReleaseRequestsTable = pgTable("f10_release_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  machineArtifactId: text("machine_artifact_id").notNull(),
  mechaRunId: text("mecha_run_id").notNull(),
  spkId: text("spk_id").notNull(),
  artifactVersion: text("artifact_version").notNull(),
  mediaType: text("media_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  artifactSignature: text("artifact_signature").notNull(),
  custodyAttestation: jsonb("custody_attestation").notNull(),
  destinationRef: text("destination_ref").notNull(),
  destinationIdentity: text("destination_identity").notNull(),
  policyVersion: text("policy_version").notNull(),
  policyHash: text("policy_hash").notNull(),
  policySnapshot: jsonb("policy_snapshot").notNull(),
  state: f10ReleaseState("state").notNull().default("REQUESTED"),
  idempotencyKey: text("idempotency_key").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idempotencyUniq: uniqueIndex("f10_release_idempotency_uniq").on(t.tenantId, t.idempotencyKey),
  tenantIdx: index("f10_release_tenant_idx").on(t.tenantId),
}));

export const f10ReleaseTransitionsTable = pgTable("f10_release_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => f10ReleaseRequestsTable.id),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  actorId: uuid("actor_id"),
  attemptToken: text("attempt_token"),
  reason: text("reason").notNull(),
  policyVersion: text("policy_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ releaseIdx: index("f10_release_transition_release_idx").on(t.releaseId) }));

export const f10ReceiptsTable = pgTable("f10_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => f10ReleaseRequestsTable.id),
  payloadHash: text("payload_hash").notNull(),
  destinationIdentity: text("destination_identity").notNull(),
  adapterId: text("adapter_id").notNull(),
  adapterVersion: text("adapter_version").notNull(),
  attempt: integer("attempt").notNull(),
  downstreamReceiptId: text("downstream_receipt_id"),
  policyHash: text("policy_hash").notNull(),
  receiptSignature: text("receipt_signature").notNull(),
  receiptPayload: jsonb("receipt_payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ releaseUniq: uniqueIndex("f10_receipt_release_uniq").on(t.releaseId) }));

export const f10AttemptsTable = pgTable("f10_attempts", {
  id: uuid("id").primaryKey().defaultRandom(), releaseId: uuid("release_id").notNull().references(() => f10ReleaseRequestsTable.id),
  attempt: integer("attempt").notNull(), fenceToken: text("fence_token").notNull(), state: f10AttemptState("state").notNull().default("CLAIMED"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull(), deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  resultClass: text("result_class"), maxAttempts: integer("max_attempts").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ fenceUniq: uniqueIndex("f10_attempt_fence_uniq").on(t.releaseId, t.fenceToken), attemptUniq: uniqueIndex("f10_attempt_number_uniq").on(t.releaseId, t.attempt) }));
export const f10DlqTable = pgTable("f10_dlq", {
  id: uuid("id").primaryKey().defaultRandom(), releaseId: uuid("release_id").notNull().references(() => f10ReleaseRequestsTable.id),
  reason: text("reason").notNull(), attempts: integer("attempts").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ releaseUniq: uniqueIndex("f10_dlq_release_uniq").on(t.releaseId) }));

export type F10ReleaseRequest = typeof f10ReleaseRequestsTable.$inferSelect;