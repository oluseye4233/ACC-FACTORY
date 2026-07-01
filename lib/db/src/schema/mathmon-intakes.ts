import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";

/**
 * MATHMON intake report (D26 · F0.5 — the MATHMON Applicability Layer).
 *
 * The first step of the mathematical-verification chain. F0.5 profiles a
 * session's concept for mathematical applicability and persists a MATHMON
 * Intake Report against the session: the measurable variables, constraint
 * categories, and optimisation targets that the downstream MAP (Mathematical
 * Applicability Profile) is built from. One row per intake run; the latest row
 * is the one the MAP engine consumes.
 */
export const mathmonIntakesTable = pgTable(
  "mathmon_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // { measurableVariables, constraintCategories, optimisationTargets, summary }
    report: jsonb("report").notNull(),
    provider: text("provider"),
    modelId: text("model_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("mathmon_intakes_session_id_idx").on(t.sessionId),
  }),
);

export const insertMathmonIntakeSchema = createInsertSchema(mathmonIntakesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMathmonIntake = z.infer<typeof insertMathmonIntakeSchema>;
export type MathmonIntake = typeof mathmonIntakesTable.$inferSelect;
