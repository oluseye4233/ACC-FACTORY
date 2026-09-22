import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { harnessArtifactsTable } from "./harness-artifacts";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";

export const f9RunStatus = pgEnum("f9_run_status", ["RUNNING", "EMITTED", "REFUSED"]);

export const f9MechaRunsTable = pgTable("f9_mecha_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  mechaRunId: text("mecha_run_id").notNull().unique(),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceArtifactId: uuid("source_artifact_id").notNull().references(() => harnessArtifactsTable.id, { onDelete: "restrict" }),
  evidenceHash: text("evidence_hash"),
  idempotencyKey: text("idempotency_key"),
  status: f9RunStatus("status").notNull().default("RUNNING"),
  deviceClass: text("device_class").notNull(),
  artifactVersion: text("artifact_version").notNull().default("1.0.0"),
  phase: integer("phase").notNull().default(0),
  evidence: jsonb("evidence").notNull().default({}),
  refusal: jsonb("refusal"),
  payloadHash: text("payload_hash"),
  artifactSignature: text("artifact_signature"),
  artifactContent: jsonb("artifact_content"),
  osirisCustody: boolean("osiris_custody").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("f9_mecha_runs_session_idx").on(table.sessionId, table.createdAt),
  uniqueIndex("f9_mecha_runs_idempotency_key_unique").on(table.idempotencyKey),
]);
