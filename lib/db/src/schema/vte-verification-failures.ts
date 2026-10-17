import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";
import { xvlVerificationRunsTable } from "./xvl-verification-runs";
import { shortSprintRunsTable } from "./artifact-operations";

/** Metadata-only failure intake. Repair approval/export is deliberately absent. */
export const vteVerificationFailuresTable = pgTable("vte_verification_failures", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  runId: uuid("run_id").unique().references(() => xvlVerificationRunsTable.id, { onDelete: "cascade" }),
  sprintRunId: uuid("sprint_run_id").references(() => shortSprintRunsTable.id, { onDelete: "cascade" }),
  sourceEvidenceHash: text("source_evidence_hash"),
  stage: text("stage").notNull(),
  state: text("state").notNull().default("OPEN"),
  rejectedOutputOrigin: text("rejected_output_origin").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerSessionIdx: index("vte_failures_owner_session_idx").on(t.ownerUserId, t.sessionId),
  sprintPackUnique: uniqueIndex("vte_sprint_pack_unique").on(t.sprintRunId, t.sourceEvidenceHash),
  sourceExclusive: check("vte_failure_one_source", sql`(${t.runId} IS NOT NULL AND ${t.sprintRunId} IS NULL) OR (${t.runId} IS NULL AND ${t.sprintRunId} IS NOT NULL AND ${t.sourceEvidenceHash} IS NOT NULL)`),
}));
export const insertVteFailureSchema = createInsertSchema(vteVerificationFailuresTable).omit({ id: true, createdAt: true });
