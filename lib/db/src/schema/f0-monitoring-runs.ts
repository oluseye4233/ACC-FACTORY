import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { f0RetainersTable } from "./f0-retainers";

/**
 * F0 · Retainer weekly CAPI monitoring runs.
 *
 * Persists each monitoring brief produced for a retainer — whether triggered
 * on-demand from the F0 dashboard (`source = 'manual'`) or by the weekly cron
 * sweep (`source = 'cron'`). A run is a "breach" when it carries at least one
 * event alert with urgency ACT_SOON / ACT_NOW; breaches surface as OPEN alerts
 * on the dashboard until acknowledged, and cron-sourced breaches also email the
 * retainer owner. `notifiedAt` records when that alert email fired.
 */
export const F0_MONITORING_SOURCES = ["manual", "cron"] as const;
export type F0MonitoringSource = (typeof F0_MONITORING_SOURCES)[number];

export const F0_MONITORING_URGENCIES = ["WATCH", "ACT_SOON", "ACT_NOW"] as const;
export type F0MonitoringUrgency = (typeof F0_MONITORING_URGENCIES)[number];

export const f0MonitoringRunsTable = pgTable(
  "f0_monitoring_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    retainerId: uuid("retainer_id")
      .notNull()
      .references(() => f0RetainersTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** The full MonitoringSchema payload (capiPosture, movements, eventAlerts, weeklyCounsel). */
    content: jsonb("content").notNull(),
    source: text("source").notNull().$type<F0MonitoringSource>().default("manual"),
    breached: boolean("breached").notNull().default(false),
    /** Highest urgency across eventAlerts, or null when none. */
    highestUrgency: text("highest_urgency").$type<F0MonitoringUrgency>(),
    /** Set when a breach alert email has been dispatched for this run. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /** Set when a staff member acknowledges (clears) the open alert. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    retainerIdx: index("f0_monitoring_runs_retainer_id_idx").on(t.retainerId),
    userIdx: index("f0_monitoring_runs_user_id_idx").on(t.userId),
  }),
);

export type F0MonitoringRun = typeof f0MonitoringRunsTable.$inferSelect;
