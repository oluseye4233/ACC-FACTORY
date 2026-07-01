import { index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";

export const harnessEngineRunsTable = pgTable(
  "harness_engine_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: engine runs reference their harness session, but pre-session
    // LLM spend (ingestion / cartridge normalisation, which run before any
    // session exists) records with a null session id so its cost is still
    // tallied by the company-wide monthly cost cap.
    sessionId: uuid("session_id").references(() => harnessSessionsTable.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    engineId: integer("engine_id").notNull(),
    provider: text("provider").notNull().default("claude"),
    modelId: text("model_id").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Backs the live monthly-cost SUM used by the per-user cost cap gate
    // (lib/cost-budget.ts#currentMonthCostForUser) and the /me/cost-summary
    // dashboard. Without this index the cap gate would re-scan the whole
    // engine-runs table on every engine call.
    userCreatedIdx: index("harness_engine_runs_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export type HarnessEngineRun = typeof harnessEngineRunsTable.$inferSelect;
