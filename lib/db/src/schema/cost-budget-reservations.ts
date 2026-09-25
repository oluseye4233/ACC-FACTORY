import { index, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * In-flight model-call spend reserved against the company-wide monthly cap.
 * Rows are removed when a provider call is recorded or fails; expiresAt bounds
 * the impact of a process crash while a request is in flight.
 */
export const costBudgetReservationsTable = pgTable(
  "cost_budget_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    amountUsd: numeric("amount_usd", { precision: 12, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    createdExpiresIdx: index("cost_budget_reservations_created_expires_idx").on(
      t.createdAt,
      t.expiresAt,
    ),
  }),
);