import { check, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const SPC_PLAYER_PROFILES = ["full", "rapid"] as const;
export type SpcPlayerProfile = (typeof SPC_PLAYER_PROFILES)[number];

export const SPC_PLAYER_RUN_STATUSES = ["running", "completed", "failed"] as const;
export type SpcPlayerRunStatus = (typeof SPC_PLAYER_RUN_STATUSES)[number];

/**
 * Standalone SPC Player executions deliberately do not reference a harness
 * session.  An exemplar's identity and prompt snapshot are retained in the
 * run so deleting the source harness session cannot change history.
 */
export const spcPlayerRunsTable = pgTable(
  "spc_player_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    selectedExemplar: jsonb("selected_exemplar").notNull(),
    profile: text("profile").notNull().$type<SpcPlayerProfile>(),
    structuredBrief: jsonb("structured_brief").notNull(),
    status: text("status").notNull().$type<SpcPlayerRunStatus>(),
    stageResults: jsonb("stage_results").notNull().default([]),
    governanceEvaluation: jsonb("governance_evaluation"),
    attemptToken: uuid("attempt_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    transitions: jsonb("transitions").notNull().default([]),
    outputPackage: jsonb("output_package"),
    clarityScore: integer("clarity_score"),
    truthfulnessScore: integer("truthfulness_score"),
    detectabilityScore: integer("detectability_score"),
    executionAdvisory: jsonb("execution_advisory").notNull(),
    distributionPlan: jsonb("distribution_plan").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("spc_player_runs_attempt_token_unique").on(table.attemptToken),
    check(
      "spc_player_runs_no_composite_score",
      sql`"output_package" IS NULL OR (
        NOT ("output_package" ? 'composite')
        AND NOT ("output_package" ? 'compositeScore')
        AND NOT (("output_package" -> 'scores') ? 'composite')
        AND NOT (("output_package" -> 'scores') ? 'compositeScore')
      )`,
    ),
    check(
      "spc_player_runs_scores_0_100",
      sql`("clarity_score" IS NULL OR ("clarity_score" BETWEEN 0 AND 100))
        AND ("truthfulness_score" IS NULL OR ("truthfulness_score" BETWEEN 0 AND 100))
        AND ("detectability_score" IS NULL OR ("detectability_score" BETWEEN 0 AND 100))`,
    ),
  ],
);

export type SpcPlayerRun = typeof spcPlayerRunsTable.$inferSelect;