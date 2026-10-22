import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";

/** Mutable recovery bookkeeping, separate from immutable generated evidence. */
export const f8RemediationAttemptsTable = pgTable("f8_remediation_attempts", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  sourceHash: text("source_hash").notNull(),
  phase: text("phase").notNull().default("READY"),
  data: jsonb("data").notNull().$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertF8RemediationAttemptSchema = createInsertSchema(f8RemediationAttemptsTable).omit({ updatedAt: true });
export type F8RemediationAttempt = typeof f8RemediationAttemptsTable.$inferSelect;
