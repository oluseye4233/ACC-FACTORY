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
 * driven by the in-process monitor started in src/index.ts).
 *
 * Caveat (documented, acceptable): the stale-alert email is dispatched by an
 * in-process timer, so a fully-asleep autoscale instance cannot email until
 * it next wakes. The admin dashboard indicator computes staleness live on
 * every read, so any admin visit surfaces a dead schedule immediately.
 */
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  cronTickStatusTable,
  cronStaleNotificationsTable,
} from "@workspace/db";
import { sendCronTargetStaleAlert } from "@workspace/email";
import { adminAlertEmails } from "./cost-cap-alerts";
import { logger } from "./logger";
import { publicBaseUrl, safeFire } from "./notifications";

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
  } catch (err) {
    logger.warn({ err, target }, "[cron-heartbeat] failed to record cron tick");
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
}

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

  return CRON_TARGET_CONFIGS.map((cfg) => {
    const row = byTarget.get(cfg.target);
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
            opsUrl: publicBaseUrl() ? `${publicBaseUrl()}/admin/ops` : undefined,
          }),
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "[cron-heartbeat] dispatchCronStaleAlerts failed");
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
    await dispatchCronStaleAlerts();
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
