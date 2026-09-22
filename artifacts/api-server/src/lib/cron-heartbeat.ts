/**
 * Dead-man's-switch for the external Scheduled-Deployment cron ticks.
 *
 * The company cost-cap threshold emails (and the other cron-driven jobs)
 * depend on an EXTERNAL Scheduled Deployment hitting `POST /api/cron/*` on a
 * schedule. Nothing used to notice when that tick stopped — the Scheduled
 * Deployment was never created, CRON_SECRET / PUBLIC_BASE_URL drifted, or the
 * deployment was re-published Private and the tick started 307-walling.
 * Detection then silently degraded back to traffic-bounded on an idle
 * autoscale app.
 *
 * This module records a heartbeat per cron target on every successful
 * external tick (`recordCronTick`, called from routes/cron.ts), surfaces
 * per-target last-tick times + a stale flag to admins
 * (`getCronTargetStatuses`, served by GET /api/admin/cron-status), and emails
 * ADMIN_EMAILS exactly once per stale episode (`dispatchCronStaleAlerts`,
 * driven by the in-process monitor started in src/index.ts). When a target
 * with an open stale episode ticks again, a one-time "all clear" recovery
 * email closes the loop (`dispatchCronRecoveryAlerts`, driven by
 * `recordCronTick`).
 *
 * Caveat (documented, acceptable): the stale-alert email is dispatched by an
 * in-process timer, so a fully-asleep autoscale instance cannot email until
 * it next wakes. The admin dashboard indicator computes staleness live on
 * every read, so any admin visit surfaces a dead schedule immediately.
 */
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  notInArray,
  sql,
} from "drizzle-orm";
import {
  db,
  cronTickStatusTable,
  cronTickEventsTable,
  cronStaleNotificationsTable,
  cronFlakyNotificationsTable,
  cronFlakyEpisodeStateTable,
  CRON_TICK_HISTORY_LIMIT,
} from "@workspace/db";
import {
  sendCronTargetFlakyAlert,
  sendCronTargetRecoveredAlert,
  sendCronTargetStaleAlert,
} from "@workspace/email";
import { adminAlertEmails } from "./cost-cap-alerts";
import { logger } from "./logger";
import { safeFire } from "./notifications";

export interface CronTargetConfig {
  target: string;
  label: string;
  /** Human-readable schedule (matches the Scheduled Deployment cron docs). */
  schedule: string;
  expectedIntervalMinutes: number;
  /**
   * Overdue threshold: minutes since the last tick (or since first seen when
   * the target never ticked) after which the target is considered stale.
   * Roughly 2× the schedule; the 15-minute sweep gets a wider window (4
   * missed ticks) so a single slow/missed tick never flaps an alert.
   */
  staleAfterMinutes: number;
}

/**
 * Single source of truth for the known cron targets and their schedules.
 * Keep in sync with scripts/src/cron-tick.ts TARGETS and the Scheduled
 * Deployments described in replit.md.
 */
export const CRON_TARGET_CONFIGS: readonly CronTargetConfig[] = [
  {
    target: "reconcile-f10-deployments",
    label: "F10 deployment reconciliation",
    schedule: "every 5 minutes (*/5 * * * *)",
    expectedIntervalMinutes: 5,
    staleAfterMinutes: 20,
  },
  {
    target: "sweep-cost-cap-alerts",
    label: "Cost-cap alert sweep",
    schedule: "every 15 minutes (*/15 * * * *)",
    expectedIntervalMinutes: 15,
    staleAfterMinutes: 60,
  },
  {
    target: "reset-harness-limits",
    label: "Daily harness limit reset",
    schedule: "daily 00:00 UTC (0 0 * * *)",
    expectedIntervalMinutes: 24 * 60,
    staleAfterMinutes: 2 * 24 * 60,
  },
  {
    target: "weekly-digest",
    label: "Weekly digest",
    schedule: "Mondays 09:00 UTC (0 9 * * 1)",
    expectedIntervalMinutes: 7 * 24 * 60,
    staleAfterMinutes: 2 * 7 * 24 * 60,
  },
  {
    target: "run-f0-monitoring",
    label: "F0 monitoring sweep",
    schedule: "Mondays 08:00 UTC (0 8 * * 1)",
    expectedIntervalMinutes: 7 * 24 * 60,
    staleAfterMinutes: 2 * 7 * 24 * 60,
  },
] as const;

const KNOWN_TARGETS = CRON_TARGET_CONFIGS.map((c) => c.target);

/**
 * Record a successful external cron tick. Called from routes/cron.ts after
 * the target's handler completed without throwing. Never throws — a
 * heartbeat-recording failure must not fail the cron response (the job
 * itself already ran).
 */
export async function recordCronTick(target: string, now: Date = new Date()): Promise<void> {
  try {
    await db
      .insert(cronTickStatusTable)
      .values({ target, lastTickAt: now, tickCount: 1 })
      .onConflictDoUpdate({
        target: cronTickStatusTable.target,
        set: {
          lastTickAt: now,
          tickCount: sql`${cronTickStatusTable.tickCount} + 1`,
        },
      });

    // Rolling tick history (flakiness signal): append this tick, then prune
    // the target's history down to the newest CRON_TICK_HISTORY_LIMIT rows so
    // the table stays bounded no matter how long the schedule runs. Pruning
    // keys off (ticked_at, id) rather than age so a paused-then-resumed
    // schedule keeps its most recent window intact.
    await db.insert(cronTickEventsTable).values({ target, tickedAt: now });
    const keep = db
      .select({ id: cronTickEventsTable.id })
      .from(cronTickEventsTable)
      .where(eq(cronTickEventsTable.target, target))
      .orderBy(desc(cronTickEventsTable.tickedAt), desc(cronTickEventsTable.id))
      .limit(CRON_TICK_HISTORY_LIMIT);
    await db
      .delete(cronTickEventsTable)
      .where(
        and(eq(cronTickEventsTable.target, target), notInArray(cronTickEventsTable.id, keep)),
      );
  } catch (err) {
    logger.warn({ err, target }, "[cron-heartbeat] failed to record cron tick");
    return;
  }

  // Close the loop on any open stale episode for this target. Skipped under
  // vitest: suites call recordCronTick against REAL targets on the shared dev
  // DB, and an automatic recovery dispatch here could claim (and thereby
  // silence) a genuine open stale stamp. Tests exercise the dispatcher
  // directly with synthetic targets instead.
  if (!(process.env.NODE_ENV === "test" || process.env.VITEST)) {
    await dispatchCronRecoveryAlerts(target, now);
  }
}

/**
 * Email ADMIN_EMAILS a one-time "all clear" when a target that had an open
 * stale episode records a fresh tick. Exactly-once per episode: the existing
 * stamp row is atomically claimed via UPDATE ... WHERE recovered_notified_at
 * IS NULL, so restarts, concurrent ticks, and multiple instances send one
 * email per episode.
 *
 * If the stale alert itself was never sent there is no stamp to recover from.
 * If ADMIN_EMAILS is empty now, the stamp is not claimed, allowing a later
 * configured recipient to receive the all-clear on a subsequent tick.
 */
export async function dispatchCronRecoveryAlerts(
  target: string,
  tickAt: Date,
): Promise<void> {
  try {
    const recipients = adminAlertEmails();
    if (recipients.length === 0) return;

    const claimed = await db
      .update(cronStaleNotificationsTable)
      .set({ recoveredNotifiedAt: tickAt })
      .where(
        and(
          eq(cronStaleNotificationsTable.target, target),
          isNull(cronStaleNotificationsTable.recoveredNotifiedAt),
          lt(cronStaleNotificationsTable.staleSinceKey, tickAt.toISOString()),
        ),
      )
      .returning({ staleSinceKey: cronStaleNotificationsTable.staleSinceKey });
    if (claimed.length === 0) return;

    const cfg = CRON_TARGET_CONFIGS.find((candidate) => candidate.target === target);
    const latestKey = claimed
      .map((candidate) => candidate.staleSinceKey)
      .sort()
      .at(-1)!;

    logger.info(
      {
        target,
        staleSinceKey: latestKey,
        recoveredAt: tickAt.toISOString(),
        recipients: recipients.length,
      },
      "[cron-heartbeat] stale cron target recovered — dispatching all-clear email",
    );
    for (const to of recipients) {
      void safeFire(
        "cron-target-recovered-alert",
        sendCronTargetRecoveredAlert({
          to,
          target,
          label: cfg?.label ?? target,
          schedule: cfg?.schedule ?? "unknown schedule",
          recoveredAt: tickAt,
          staleSince: Number.isNaN(new Date(latestKey).getTime())
            ? null
            : new Date(latestKey),
        }),
      );
    }
  } catch (err) {
    logger.warn({ err, target }, "[cron-heartbeat] dispatchCronRecoveryAlerts failed");
  }
}

/**
 * Seed a status row (last_tick_at NULL) for every known target that has none
 * yet, so "the Scheduled Deployment was never created" still trips the
 * dead-man's-switch once the grace window from first_seen_at passes.
 * Idempotent and race-safe (ON CONFLICT DO NOTHING on the unique target).
 */
export async function ensureCronTargetsSeeded(): Promise<void> {
  await db
    .insert(cronTickStatusTable)
    .values(KNOWN_TARGETS.map((target) => ({ target })))
    .onConflictDoNothing();
}

export interface CronTargetStatus {
  target: string;
  label: string;
  schedule: string;
  expectedIntervalMinutes: number;
  staleAfterMinutes: number;
  firstSeenAt: string | null;
  lastTickAt: string | null;
  tickCount: number;
  neverTicked: boolean;
  minutesSinceLastTick: number | null;
  stale: boolean;
  /** Most recent tick timestamps (newest first), capped at RECENT_TICKS_SHOWN. */
  recentTicks: string[];
  /** Ticks observed in the trailing 24h window (from the rolling history). */
  ticksLast24h: number;
  /**
   * Ticks the schedule should have produced in 24h (floor(1440/interval)).
   * 0 for schedules coarser than daily — the 24h flakiness line does not
   * apply to them.
   */
  expectedTicksLast24h: number;
}

/** Recent tick timestamps returned per target (UI payload cap). */
const RECENT_TICKS_SHOWN = 20;

/**
 * Live per-target health, computed on every read (so the admin dashboard
 * never shows a cached verdict). A target is stale when the time since its
 * reference point (last successful tick, or first_seen_at when it never
 * ticked) exceeds its staleAfterMinutes. Unknown/stray rows (e.g. test
 * fixtures) are ignored — only configured targets are reported.
 */
export async function getCronTargetStatuses(now: Date = new Date()): Promise<CronTargetStatus[]> {
  const rows = await db
    .select()
    .from(cronTickStatusTable)
    .where(inArray(cronTickStatusTable.target, KNOWN_TARGETS));
  const byTarget = new Map(rows.map((r) => [r.target, r]));

  // Rolling history: only the trailing 24h matters for the flakiness line,
  // and recentTicks is capped per target below. Bounded by the per-target
  // prune in recordCronTick, so this stays a small read.
  const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);
  const events = await db
    .select({
      target: cronTickEventsTable.target,
      tickedAt: cronTickEventsTable.tickedAt,
    })
    .from(cronTickEventsTable)
    .where(
      and(
        inArray(cronTickEventsTable.target, KNOWN_TARGETS),
        gt(cronTickEventsTable.tickedAt, windowStart),
      ),
    )
    .orderBy(desc(cronTickEventsTable.tickedAt));
  const eventsByTarget = new Map<string, Date[]>();
  for (const e of events) {
    if (e.tickedAt.getTime() > now.getTime()) continue; // ignore clock-skewed future rows
    const list = eventsByTarget.get(e.target);
    if (list) list.push(e.tickedAt);
    else eventsByTarget.set(e.target, [e.tickedAt]);
  }

  return CRON_TARGET_CONFIGS.map((cfg) => {
    const row = byTarget.get(cfg.target);
    const targetEvents = eventsByTarget.get(cfg.target) ?? [];
    const lastTickAt = row?.lastTickAt ?? null;
    const firstSeenAt = row?.firstSeenAt ?? null;
    const reference = lastTickAt ?? firstSeenAt;
    const minutesSinceReference = reference
      ? Math.floor((now.getTime() - reference.getTime()) / 60_000)
      : null;
    return {
      target: cfg.target,
      label: cfg.label,
      schedule: cfg.schedule,
      expectedIntervalMinutes: cfg.expectedIntervalMinutes,
      staleAfterMinutes: cfg.staleAfterMinutes,
      firstSeenAt: firstSeenAt ? firstSeenAt.toISOString() : null,
      lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
      tickCount: row?.tickCount ?? 0,
      neverTicked: lastTickAt === null,
      minutesSinceLastTick: lastTickAt
        ? Math.floor((now.getTime() - lastTickAt.getTime()) / 60_000)
        : null,
      // No row yet (server booted but seeding hasn't run) → not stale: there
      // is no baseline to be overdue against until first_seen_at exists.
      stale:
        minutesSinceReference !== null && minutesSinceReference > cfg.staleAfterMinutes,
      recentTicks: targetEvents
        .slice(0, RECENT_TICKS_SHOWN)
        .map((d) => d.toISOString()),
      ticksLast24h: targetEvents.length,
      expectedTicksLast24h: Math.floor((24 * 60) / cfg.expectedIntervalMinutes),
    };
  });
}

/**
 * Email ADMIN_EMAILS exactly once per stale episode. The episode key is the
 * ISO timestamp of the reference tick that went stale (last successful tick,
 * or first_seen_at when the target never ticked), so:
 *  - restarts / concurrent sweeps / multiple instances send one email per
 *    episode (UNIQUE (target, stale_since_key) + INSERT ... ON CONFLICT DO
 *    NOTHING before sending — same pattern as cost_cap_notifications);
 *  - a recovery followed by a new outage is a NEW episode and alerts again.
 * When ADMIN_EMAILS is empty we do NOT stamp, so configuring it later still
 * alerts for an ongoing episode. Never throws.
 *
 * `statusesOverride` exists for tests only: it lets suites exercise the
 * stamping logic with synthetic target names instead of stamping real
 * targets in the shared dev DB.
 */
export async function dispatchCronStaleAlerts(
  now: Date = new Date(),
  statusesOverride?: CronTargetStatus[],
): Promise<void> {
  try {
    const statuses = statusesOverride ?? (await getCronTargetStatuses(now));
    const staleTargets = statuses.filter((s) => s.stale);
    if (staleTargets.length === 0) return;

    const recipients = adminAlertEmails();
    if (recipients.length === 0) {
      logger.warn(
        { staleTargets: staleTargets.map((s) => s.target) },
        "[cron-heartbeat] cron targets are stale but ADMIN_EMAILS is empty — no stale-schedule alert emails can be sent",
      );
      return;
    }

    for (const status of staleTargets) {
      const referenceIso = status.lastTickAt ?? status.firstSeenAt;
      if (!referenceIso) continue; // no baseline yet — nothing to anchor an episode to
      const overdueMinutes = Math.max(
        0,
        Math.floor((now.getTime() - new Date(referenceIso).getTime()) / 60_000) -
          status.staleAfterMinutes,
      );
      const inserted = await db
        .insert(cronStaleNotificationsTable)
        .values({
          target: status.target,
          staleSinceKey: referenceIso,
          overdueMinutes,
        })
        .onConflictDoNothing()
        .returning({ id: cronStaleNotificationsTable.id });
      if (!inserted[0]) continue; // this episode already alerted (or race lost)

      logger.warn(
        {
          target: status.target,
          lastTickAt: status.lastTickAt,
          neverTicked: status.neverTicked,
          overdueMinutes,
          recipients: recipients.length,
        },
        "[cron-heartbeat] cron target went stale — dispatching admin alert",
      );
      for (const to of recipients) {
        void safeFire(
          "cron-target-stale-alert",
          sendCronTargetStaleAlert({
            to,
            target: status.target,
            label: status.label,
            schedule: status.schedule,
            lastTickAt: status.lastTickAt ? new Date(status.lastTickAt) : null,
            staleAfterMinutes: status.staleAfterMinutes,
            overdueMinutes,
          }),
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "[cron-heartbeat] dispatchCronStaleAlerts failed");
  }
}

/**
 * Flakiness threshold: a target is "flaky" when its trailing-24h tick count
 * fell below this fraction of expected (and the target is not outright
 * stale — stale has its own alert).
 */
const FLAKY_RATIO_THRESHOLD = 0.75;
/**
 * Consecutive monitor checks that must observe the shortfall before an alert
 * is dispatched, so a single transient dip never fires an email.
 */
const FLAKY_CONSECUTIVE_CHECKS = 2;

/**
 * Email ADMIN_EMAILS once per FLAKY episode: the target is still ticking but
 * its trailing-24h tick count fell below FLAKY_RATIO_THRESHOLD of expected
 * for FLAKY_CONSECUTIVE_CHECKS consecutive monitor checks. Complements
 * dispatchCronStaleAlerts (dead schedules): flaky targets are excluded there
 * and stale targets are excluded here, so one degradation never produces both
 * emails at once.
 *
 * Eligibility guards:
 *  - expectedTicksLast24h >= 1 (sub-daily schedules only; the 24h flakiness
 *    line does not apply to coarser schedules);
 *  - not stale (the dead-man's-switch alert owns that state);
 *  - firstSeenAt at least 24h ago (a freshly-seeded target has a short
 *    history window and would false-positive on the 24h count).
 *
 * Episode tracking is DURABLE and shared across restarts / concurrent
 * instances: the first check that observes a shortfall INSERTs a
 * cron_flaky_episode_state row (UNIQUE target), fixing the episode key;
 * every later shortfall check — from any instance — increments its
 * shortfall_checks via ON CONFLICT DO UPDATE and reads back the SAME key.
 * Recovery deletes the row, ending the episode. The alert itself is
 * exactly-once per episode via cron_flaky_notifications (UNIQUE (target,
 * flaky_since_key) + INSERT ... ON CONFLICT DO NOTHING before sending) —
 * a continuing shortfall after a restart converges on the same key and the
 * stamp blocks a duplicate email. When ADMIN_EMAILS is empty we do NOT
 * stamp (episode state is still tracked), so configuring it later still
 * alerts for an ongoing episode. Never throws.
 *
 * `statusesOverride` exists for tests only (same seam as
 * dispatchCronStaleAlerts): synthetic target names keep test stamps away from
 * real targets in the shared dev DB.
 */
export async function dispatchCronFlakyAlerts(
  now: Date = new Date(),
  statusesOverride?: CronTargetStatus[],
): Promise<void> {
  try {
    const statuses = statusesOverride ?? (await getCronTargetStatuses(now));
    for (const status of statuses) {
      if (status.expectedTicksLast24h < 1) continue;
      if (status.stale) {
        // Dead, not flaky — the stale alert owns this. Keep any episode state
        // so a recovery straight out of an outage doesn't immediately re-arm.
        continue;
      }
      const seenAt = status.firstSeenAt ? new Date(status.firstSeenAt) : null;
      const matureBaseline =
        seenAt !== null && now.getTime() - seenAt.getTime() >= 24 * 60 * 60_000;
      const flaky =
        matureBaseline &&
        status.ticksLast24h < status.expectedTicksLast24h * FLAKY_RATIO_THRESHOLD;

      if (!flaky) {
        // Healthy (or not yet evaluable) → recovery ends the episode.
        await db
          .delete(cronFlakyEpisodeStateTable)
          .where(eq(cronFlakyEpisodeStateTable.target, status.target));
        continue;
      }

      // Durable episode upsert: the first observer fixes the episode key;
      // later shortfall checks (any instance, any restart) increment the
      // counter and read back the same key. The increment is deduped by an
      // ABSOLUTE monitor-interval bucket (floor(epoch_ms / interval_ms)):
      // no matter how many instances observe the shortfall inside one
      // 15-minute bucket — including phase-shifted timers — the consecutive
      // counter advances at most once per bucket.
      const bucket = Math.floor(now.getTime() / MONITOR_INTERVAL_MS);
      const [state] = await db
        .insert(cronFlakyEpisodeStateTable)
        .values({
          target: status.target,
          episodeKey: now.toISOString(),
          shortfallChecks: 1,
          lastCountedBucket: bucket,
          startedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: cronFlakyEpisodeStateTable.target,
          set: {
            shortfallChecks: sql`CASE WHEN ${cronFlakyEpisodeStateTable.lastCountedBucket} < ${bucket} THEN ${cronFlakyEpisodeStateTable.shortfallChecks} + 1 ELSE ${cronFlakyEpisodeStateTable.shortfallChecks} END`,
            lastCountedBucket: sql`GREATEST(${cronFlakyEpisodeStateTable.lastCountedBucket}, ${bucket})`,
            updatedAt: sql`${now.toISOString()}::timestamptz`,
          },
        })
        .returning({
          episodeKey: cronFlakyEpisodeStateTable.episodeKey,
          shortfallChecks: cronFlakyEpisodeStateTable.shortfallChecks,
        });
      if (!state) continue;
      if (state.shortfallChecks < FLAKY_CONSECUTIVE_CHECKS) continue;

      const recipients = adminAlertEmails();
      if (recipients.length === 0) {
        // Do NOT stamp: configuring ADMIN_EMAILS later must still alert for
        // this ongoing episode.
        logger.warn(
          {
            target: status.target,
            observedTicks: status.ticksLast24h,
            expectedTicks: status.expectedTicksLast24h,
          },
          "[cron-heartbeat] cron target is flaky but ADMIN_EMAILS is empty — no flaky-schedule alert emails can be sent",
        );
        continue;
      }

      const inserted = await db
        .insert(cronFlakyNotificationsTable)
        .values({
          target: status.target,
          flakySinceKey: state.episodeKey,
          expectedTicks: status.expectedTicksLast24h,
          observedTicks: status.ticksLast24h,
        })
        .onConflictDoNothing()
        .returning({ id: cronFlakyNotificationsTable.id });
      if (!inserted[0]) continue; // this episode already alerted (or race lost)

      logger.warn(
        {
          target: status.target,
          observedTicks: status.ticksLast24h,
          expectedTicks: status.expectedTicksLast24h,
          episodeKey: state.episodeKey,
          recipients: recipients.length,
        },
        "[cron-heartbeat] cron target turned flaky — dispatching admin alert",
      );
      for (const to of recipients) {
        void safeFire(
          "cron-target-flaky-alert",
          sendCronTargetFlakyAlert({
            to,
            target: status.target,
            label: status.label,
            schedule: status.schedule,
            expectedTicks: status.expectedTicksLast24h,
            observedTicks: status.ticksLast24h,
            lastTickAt: status.lastTickAt ? new Date(status.lastTickAt) : null,
          }),
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "[cron-heartbeat] dispatchCronFlakyAlerts failed");
  }
}

/** Check every 15 minutes — same cadence as the cost-cap sweeper. */
const MONITOR_INTERVAL_MS = 15 * 60 * 1000;
/** First check shortly after boot, once the server is up and serving. */
const INITIAL_DELAY_MS = 45 * 1000;

let monitorInFlight = false;

async function runCronHeartbeatCheckOnce(): Promise<void> {
  if (monitorInFlight) return;
  monitorInFlight = true;
  try {
    const now = new Date();
    const statuses = await getCronTargetStatuses(now);
    await dispatchCronStaleAlerts(now, statuses);
    await dispatchCronFlakyAlerts(now, statuses);
  } catch (err) {
    logger.warn({ err }, "[cron-heartbeat] monitor check failed (will retry next tick)");
  } finally {
    monitorInFlight = false;
  }
}

/**
 * Start the periodic stale-check monitor. No-op under vitest (suites must
 * never stamp real targets in the shared dev DB). Seeds baseline rows for
 * all known targets at start so never-created schedules become detectable.
 * Returns a stop function (used by tests; the server lets it run for the
 * process lifetime).
 */
export function startCronHeartbeatMonitor(): () => void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return () => {};
  }

  void ensureCronTargetsSeeded().catch((err) => {
    logger.warn({ err }, "[cron-heartbeat] failed to seed cron target baselines");
  });

  const initial = setTimeout(() => {
    void runCronHeartbeatCheckOnce();
  }, INITIAL_DELAY_MS);
  const interval = setInterval(() => {
    void runCronHeartbeatCheckOnce();
  }, MONITOR_INTERVAL_MS);

  initial.unref();
  interval.unref();

  logger.info(
    { intervalMinutes: MONITOR_INTERVAL_MS / 60_000, targets: KNOWN_TARGETS },
    "[cron-heartbeat] cron dead-man's-switch monitor started",
  );

  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
