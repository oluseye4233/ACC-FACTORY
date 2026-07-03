import { integer, numeric, pgTable, timestamp, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per (UTC month, threshold) the company-wide LLM spend cap alert has
 * been dispatched for. The unique index makes threshold-crossing emails
 * exactly-once per month even across restarts and concurrent requests:
 * dispatchers INSERT ... ON CONFLICT DO NOTHING and only send when the insert
 * actually landed.
 */
export const costCapNotificationsTable = pgTable(
  "cost_cap_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** UTC calendar month the alert belongs to, formatted `YYYY-MM`. */
    month: text("month").notNull(),
    /** Threshold crossed: 80, 95, or 100 (percent of the monthly cap). */
    thresholdPercent: integer("threshold_percent").notNull(),
    /** Spend observed at dispatch time (audit trail). */
    usedUsd: numeric("used_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    /** Cap in force at dispatch time (audit trail). */
    capUsd: numeric("cap_usd", { precision: 12, scale: 2 }).notNull().default("0"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    monthThresholdIdx: uniqueIndex("cost_cap_notifications_month_threshold_idx").on(
      t.month,
      t.thresholdPercent,
    ),
  }),
);

export const insertCostCapNotificationSchema = createInsertSchema(costCapNotificationsTable).omit({
  id: true,
  sentAt: true,
});
export type InsertCostCapNotification = z.infer<typeof insertCostCapNotificationSchema>;
export type CostCapNotification = typeof costCapNotificationsTable.$inferSelect;
