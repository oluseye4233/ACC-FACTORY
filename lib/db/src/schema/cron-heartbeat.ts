import {
  bigint,
  index,
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
 * Rolling per-tick history for each cron target — one row per successful
 * external tick. The single-row `cron_tick_status` upsert only keeps the
 * LATEST tick, so a schedule that fires intermittently (e.g. every other
 * 15-minute sweep fails) looks healthy whenever the last tick happened to
 * land recently. This bounded history (pruned to the most recent
 * CRON_TICK_HISTORY_LIMIT rows per target on every write) lets the Ops
 * Health page compare "ticks observed in the last 24h" against the number
 * the schedule should have produced, surfacing flaky schedules — not just
 * dead ones.
 */
export const cronTickEventsTable = pgTable(
  "cron_tick_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Cron target name — matches scripts/src/cron-tick.ts TARGETS keys. */
    target: text("target").notNull(),
    /** When the successful external tick was recorded. */
    tickedAt: timestamp("ticked_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    targetTickedAtIdx: index("cron_tick_events_target_ticked_at_idx").on(
      t.target,
      t.tickedAt,
    ),
  }),
);

/**
 * Rows kept per target in `cron_tick_events`. Must comfortably exceed the
 * densest schedule's 24h tick volume (the 15-minute sweep produces 96/day)
 * so a full day of history is always available for the flakiness line.
 */
export const CRON_TICK_HISTORY_LIMIT = 200;

/**
 * Exactly-once stamps for stale-cron-target alert emails — same pattern as
 * `cost_cap_notifications`. One row per (target, stale episode); the episode
 * key is the ISO timestamp of the reference tick that went stale (the last
 * successful tick, or first_seen_at when the target never ticked). Dispatchers
 * INSERT ... ON CONFLICT DO NOTHING and only email when the insert landed, so
 * a stale episode is emailed once even across restarts, concurrent sweeps and
 * multiple server instances. A recovery (new tick) starts a new episode key.
 *
 * `recovered_notified_at` closes the loop: when a target with an open stale
 * episode records a fresh tick, the recovery dispatcher atomically claims the
 * stamp (UPDATE ... WHERE recovered_notified_at IS NULL) and emails a one-time
 * "all clear" to ADMIN_EMAILS. NULL = stale alert sent, recovery not yet
 * notified. Episodes that never had a stale alert (no stamp row) never get a
 * recovery email.
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
    /**
     * When the one-time recovery ("all clear") email for this episode was
     * dispatched; NULL = episode still open (or recovery not yet noticed).
     */
    recoveredNotifiedAt: timestamp("recovered_notified_at", { withTimezone: true }),
  },
  (t) => ({
    targetEpisodeIdx: uniqueIndex("cron_stale_notifications_target_episode_idx").on(
      t.target,
      t.staleSinceKey,
    ),
  }),
);

/**
 * Durable per-target flaky-episode state — one row per target CURRENTLY in a
 * shortfall (trailing-24h tick count below the flaky threshold). The monitor
 * upserts on every check: first shortfall INSERTs the row (fixing the
 * episode key = that check's ISO timestamp), later shortfalls increment
 * `shortfall_checks`. Recovery DELETEs the row, ending the episode. Because
 * the key is fixed by whichever instance/process observed the shortfall
 * first (UNIQUE target + ON CONFLICT), restarts and concurrent instances all
 * converge on the SAME episode key, so the notification stamp's UNIQUE
 * constraint gives true once-per-episode delivery.
 */
export const cronFlakyEpisodeStateTable = pgTable(
  "cron_flaky_episode_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target").notNull(),
    /** ISO timestamp of the check that first observed the shortfall (episode key). */
    episodeKey: text("episode_key").notNull(),
    /**
     * Distinct monitor intervals (across all instances) that observed the
     * shortfall. Incremented at most once per absolute monitor-interval
     * bucket (see last_counted_bucket), so phase-shifted replicas cannot
     * double-count one interval.
     */
    shortfallChecks: integer("shortfall_checks").notNull().default(1),
    /**
     * Absolute monitor-interval bucket (floor(epoch_ms / interval_ms)) of the
     * last COUNTED shortfall observation; observations in the same bucket do
     * not increment shortfall_checks again.
     */
    lastCountedBucket: bigint("last_counted_bucket", { mode: "number" }).notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: uniqueIndex("cron_flaky_episode_state_target_idx").on(t.target),
  }),
);

/**
 * Exactly-once stamps for FLAKY-cron-target alert emails — same pattern as
 * `cron_stale_notifications`, but for degradation rather than death: a target
 * whose trailing-24h tick count fell materially below expected (< 75%) for
 * two consecutive monitor checks. One row per (target, flaky episode); the
 * episode key comes from the durable `cron_flaky_episode_state` row, so all
 * instances/restarts share one key per episode. Dispatchers INSERT ... ON
 * CONFLICT DO NOTHING and only email when the insert landed. A recovery
 * (24h count back above the threshold) deletes the state row, ending the
 * episode, so a later degradation alerts again under a new key.
 */
export const cronFlakyNotificationsTable = pgTable(
  "cron_flaky_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target").notNull(),
    /** ISO timestamp of the monitor check that first observed the shortfall. */
    flakySinceKey: text("flaky_since_key").notNull(),
    /** Ticks the schedule should have produced in the trailing 24h. */
    expectedTicks: integer("expected_ticks").notNull().default(0),
    /** Ticks actually observed in the trailing 24h at dispatch time. */
    observedTicks: integer("observed_ticks").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetEpisodeIdx: uniqueIndex("cron_flaky_notifications_target_episode_idx").on(
      t.target,
      t.flakySinceKey,
    ),
  }),
);

export const insertCronTickStatusSchema = createInsertSchema(cronTickStatusTable).omit({
  id: true,
  firstSeenAt: true,
});
export type InsertCronTickStatus = z.infer<typeof insertCronTickStatusSchema>;
export type CronTickStatus = typeof cronTickStatusTable.$inferSelect;

export const insertCronTickEventSchema = createInsertSchema(cronTickEventsTable).omit({
  id: true,
});
export type InsertCronTickEvent = z.infer<typeof insertCronTickEventSchema>;
export type CronTickEvent = typeof cronTickEventsTable.$inferSelect;

export const insertCronStaleNotificationSchema = createInsertSchema(
  cronStaleNotificationsTable,
).omit({ id: true, sentAt: true });
export type InsertCronStaleNotification = z.infer<typeof insertCronStaleNotificationSchema>;
export type CronStaleNotification = typeof cronStaleNotificationsTable.$inferSelect;

export const insertCronFlakyNotificationSchema = createInsertSchema(
  cronFlakyNotificationsTable,
).omit({ id: true, sentAt: true });
export type InsertCronFlakyNotification = z.infer<typeof insertCronFlakyNotificationSchema>;
export type CronFlakyNotification = typeof cronFlakyNotificationsTable.$inferSelect;

export type CronFlakyEpisodeState = typeof cronFlakyEpisodeStateTable.$inferSelect;
