import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";
import { harnessArtifactsTable } from "./harness-artifacts";
import { xvlEvalsetsTable } from "./xvl-evalsets";

/** Immutable evidence snapshots, not an external WORM archive or certificate. */
export const xvlVerificationRunsTable = pgTable("xvl_verification_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  artifactId: uuid("artifact_id").notNull().references(() => harnessArtifactsTable.id, { onDelete: "cascade" }),
  evalsetId: uuid("evalset_id").notNull().references(() => xvlEvalsetsTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  track: text("track").notNull(),
  adapterId: text("adapter_id").notNull(),
  adapterVersion: text("adapter_version").notNull(),
  independence: text("independence").notNull(),
  outcome: text("outcome").notNull(),
  artifactHash: text("artifact_hash").notNull(),
  evalsetHash: text("evalset_hash").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  evidence: jsonb("evidence").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  replayIdx: uniqueIndex("xvl_runs_replay_idx").on(t.artifactId, t.evalsetId, t.adapterId, t.adapterVersion),
  ownerSessionIdx: index("xvl_runs_owner_session_idx").on(t.ownerUserId, t.sessionId),
  hashesRequired: check("xvl_runs_sha256_required", sql`${t.evidenceHash} ~ '^[a-f0-9]{64}$' AND ${t.artifactHash} ~ '^[a-f0-9]{64}$' AND ${t.evalsetHash} ~ '^[a-f0-9]{64}$'`),
}));
export const insertXvlRunSchema = createInsertSchema(xvlVerificationRunsTable).omit({ id: true, createdAt: true });
