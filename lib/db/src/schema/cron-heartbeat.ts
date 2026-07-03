import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Dead-man's-switch heartbeat for the external Scheduled-Deployment cron
 * ticks. One row per cron target (e.g. "sweep-cost-cap-alerts"); every
 * successful `POST /api/cron/<target>` upserts `last_tick_at`. If a target
 * stops ticking (Scheduled Deployment never created, CRON_SECRET or
 * PUBLIC_BASE_URL drifted, deployment re-published Private and the tick
 * 307-walls) the row goes stale and the admin dashboard / stale-alert email
 * surfaces it instead of the schedule silently dying.
 *
 * `first_seen_at` is the baseline for "never ticked at all": rows are seeded
 * (with a NULL last_tick_at) when the server first observes a known target,
 * so a Scheduled Deployment that was never created still trips the switch
 * once the grace window from first_seen_at has passed.
 */
export const cronTickStatusTable = pgTable(
  "cron_tick_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Cron target name — matches scripts/src/cron-tick.ts TARGETS keys. */
    target: text("target").notNull(),
    /** When this target was first seeded/observed (baseline for never-ticked). */
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last successful external cron tick; NULL = never ticked. */
    lastTickAt: timestamp("last_tick_at", { withTimezone: true }),
    /** Total successful external ticks recorded (audit / sanity signal). */
    tickCount: integer("tick_count").notNull().default(0),
  },
  (t) => ({
    targetIdx: uniqueIndex("cron_tick_status_target_idx").on(t.target),
  }),
);

/**
 * Exactly-once stamps for stale-cron-target alert emails — same pattern as
 * `cost_cap_notifications`. One row per (target, stale episode); the episode
 * key is the ISO timestamp of the reference tick that went stale (the last
 * successful tick, or first_seen_at when the target never ticked). Dispatchers
 * INSERT ... ON CONFLICT DO NOTHING and only email when the insert landed, so
 * a stale episode is emailed once even across restarts, concurrent sweeps and
 * multiple server instances. A recovery (new tick) starts a new episode key.
 */
export const cronStaleNotificationsTable = pgTable(
  "cron_stale_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target").notNull(),
    /** ISO timestamp of the reference tick this stale episode is anchored to. */
    staleSinceKey: text("stale_since_key").notNull(),
    /** Minutes overdue at dispatch time (audit trail). */
    overdueMinutes: integer("overdue_minutes").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetEpisodeIdx: uniqueIndex("cron_stale_notifications_target_episode_idx").on(
      t.target,
      t.staleSinceKey,
    ),
  }),
);

export const insertCronTickStatusSchema = createInsertSchema(cronTickStatusTable).omit({
  id: true,
  firstSeenAt: true,
});
export type InsertCronTickStatus = z.infer<typeof insertCronTickStatusSchema>;
export type CronTickStatus = typeof cronTickStatusTable.$inferSelect;

export const insertCronStaleNotificationSchema = createInsertSchema(
  cronStaleNotificationsTable,
).omit({ id: true, sentAt: true });
export type InsertCronStaleNotification = z.infer<typeof insertCronStaleNotificationSchema>;
export type CronStaleNotification = typeof cronStaleNotificationsTable.$inferSelect;
