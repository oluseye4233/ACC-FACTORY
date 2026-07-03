/**
 * Dev-only periodic sweep of stale test fixtures in the shared dev database.
 *
 * The test-data janitor already runs at test bootstrap (vitest globalSetup)
 * and after merges (post-merge.sh), but between a crashed test run and the
 * NEXT test run or merge, orphaned `@example.test` cost rows sit in the
 * shared dev DB inflating the live dev app's company-wide spend SUM —
 * potentially 402-blocking real staff usage during that window. This
 * lightweight interval inside the dev API server closes that gap: stale
 * fixtures are swept periodically without any human action.
 *
 * Safety:
 *  - NEVER runs in production: the interval is only started when
 *    `NODE_ENV !== "production"` (checked here, defence-in-depth with the
 *    caller's gate in index.ts). Production data has no `@example.test`
 *    fixtures anyway, but the sweep simply does not run there.
 *  - Reuses the janitor's identity + age + cascade safety model verbatim via
 *    `sweepStaleTestFixtures` from `@workspace/db` — only `@example.test`
 *    users (IETF-reserved TLD, never a real person) older than 60 minutes
 *    are deleted, cascade through the `users` row. A mid-flight test suite
 *    is never raced.
 *  - Failures are log-and-continue: a sweep error must never crash the
 *    server, and overlapping ticks are skipped rather than stacked.
 */
import { pool, sweepStaleTestFixtures } from "@workspace/db";

import { logger } from "./logger";

/** Sweep every 15 minutes — well under the 60-minute age threshold, so the
 * spend meter is corrected quickly after a crashed run without ever racing a
 * live suite. */
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/** First sweep shortly after boot so a restart also reclaims stale spend
 * promptly, but after the server is up and serving. */
const INITIAL_DELAY_MS = 30 * 1000;

let sweepInFlight = false;

export async function runTestFixtureSweepOnce(): Promise<void> {
  if (sweepInFlight) {
    logger.warn("[test-fixture-sweeper] previous sweep still running; skipping this tick");
    return;
  }
  sweepInFlight = true;
  try {
    const result = await sweepStaleTestFixtures(pool);
    if (result.deletedUserCount > 0) {
      logger.info(
        {
          deletedUsers: result.deletedUserCount,
          engineRuns: result.runCount,
          reclaimedCurrentMonthUsd: result.currentMonthCostUsd,
        },
        "[test-fixture-sweeper] swept stale @example.test fixtures from the shared dev DB",
      );
    } else {
      logger.debug("[test-fixture-sweeper] no stale test fixtures to sweep");
    }
  } catch (err) {
    // Log-and-continue: a broken sweep (or briefly unreachable DB) must never
    // take the dev server down. The next tick will try again.
    logger.warn({ err }, "[test-fixture-sweeper] sweep failed (continuing; will retry next tick)");
  } finally {
    sweepInFlight = false;
  }
}

/**
 * Start the periodic sweep. No-op in production. Returns a stop function
 * (used by tests; the dev server just lets it run for the process lifetime).
 */
export function startTestFixtureSweeper(): () => void {
  if (process.env.NODE_ENV === "production") {
    return () => {};
  }

  const initial = setTimeout(() => {
    void runTestFixtureSweepOnce();
  }, INITIAL_DELAY_MS);
  const interval = setInterval(() => {
    void runTestFixtureSweepOnce();
  }, SWEEP_INTERVAL_MS);

  // Never hold the process open on account of the sweeper.
  initial.unref();
  interval.unref();

  logger.info(
    { intervalMinutes: SWEEP_INTERVAL_MS / 60_000 },
    "[test-fixture-sweeper] dev-only periodic test-fixture sweep started",
  );

  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
