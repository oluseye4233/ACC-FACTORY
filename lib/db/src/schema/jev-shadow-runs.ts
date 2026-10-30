import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";

/** Advisory evidence only. Never consumed as a stage/release verdict. */
export const jevShadowRunsTable = pgTable("jev_shadow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  requestKey: uuid("request_key").notNull(),
  kind: text("kind").notNull(),
  featureId: integer("feature_id").notNull(),
  status: text("status").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  modelId: text("model_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  request: uniqueIndex("jev_shadow_runs_user_request_idx").on(t.userId, t.requestKey),
  session: index("jev_shadow_runs_session_idx").on(t.userId, t.sessionId, t.kind, t.featureId),
}));
