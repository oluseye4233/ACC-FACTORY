import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";

/**
 * MAP — Mathematical Applicability Profile (D26 · the second step of the
 * MATHMON chain, generated from a session's MATHMON Intake Report).
 *
 * The MAP holds the governing equations, simulations, optimisation goals, risk
 * models, RANGE-ONLY economic projections, and performance metrics for the
 * session's concept, plus the three MATHMON sub-scores (0–100 each). The
 * FORGE VERIFIED gate at F7 recomputes the composite MATHMON score from these
 * three sub-scores server-side — it never trusts a model-reported composite.
 *
 * `disclaimer` is the mandatory embedded FORGE VERIFIED disclaimer: mathematical
 * verification of a specification is NOT a runtime safety certification, and
 * economic projections are modelled ranges, not guarantees.
 */
export const mathmonMapsTable = pgTable(
  "mathmon_maps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    intakeId: uuid("intake_id"),
    // { sections: [{ key, title, body }] } — governing_equations, simulations,
    // optimisation_goals, risk_models, economic_projections, performance_metrics
    map: jsonb("map").notNull(),
    // MATHMON sub-scores, 0–100. The composite is derived, never stored here.
    mathCoherence: integer("math_coherence").notNull(),
    applicability: integer("applicability").notNull(),
    predictiveReliability: integer("predictive_reliability").notNull(),
    disclaimer: text("disclaimer").notNull(),
    provider: text("provider"),
    modelId: text("model_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("mathmon_maps_session_id_idx").on(t.sessionId),
  }),
);

export const insertMathmonMapSchema = createInsertSchema(mathmonMapsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMathmonMap = z.infer<typeof insertMathmonMapSchema>;
export type MathmonMap = typeof mathmonMapsTable.$inferSelect;
