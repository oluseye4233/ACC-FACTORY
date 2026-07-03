/**
 * Periodic company cost-cap alert sweep.
 *
 * The 80/95/100% threshold emails (`dispatchCostCapAlerts`) are normally
 * triggered from the `requireCostBudget` request path, which means a
 * threshold crossing is only *detected* on the NEXT engine request. If spend
 * crosses a line late in the day and nobody runs another engine, the email
 * waits until the next request — detection is traffic-bounded. This sweep
 * makes it time-bounded instead: every 15 minutes the server re-reads the
 * company-wide month spend and runs the dispatcher, so a crossing is emailed
 * within ~15 minutes even with zero portal traffic.
 *
 * Safety:
 *  - Exactly-once is untouched: the dispatcher's INSERT ... ON CONFLICT
 *    DO NOTHING against the UNIQUE (month, threshold_percent) stamp in
 *    `cost_cap_notifications` already makes it safe to call from any number
 *    of concurrent paths (request hot path, this sweep, multiple server
 *    instances, restarts) — only the caller whose insert lands sends email.
 *  - Never runs under vitest: the suites deliberately shrink the cap to
 *    force 402s against the shared dev DB; a sweep tick there could stamp
 *    the REAL current month and suppress a genuine production alert. Same
 *    rule as `maybeDispatchCostCapAlerts`.
 *  - Runs in BOTH dev and production — unlike the test-fixture sweeper this
 *    guard matters most on the deployed server.
 *  - Failures are log-and-continue and overlapping ticks are skipped, never
 *    stacked. Timers are unref'd so the sweep never holds the process open.
 */
import { dispatchCostCapAlerts } from "./cost-cap-alerts";
import { currentMonthCostGlobal, globalMonthlyCostCapUsd } from "./cost-budget";
import { logger } from "./logger";

/** Sweep every 15 minutes — the detection bound promised to admins. */
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/** First sweep shortly after boot so a restart that missed a crossing (e.g.
 * a deploy right after spend crossed 95%) still alerts promptly, but after
 * the server is up and serving. */
const INITIAL_DELAY_MS = 30 * 1000;

let sweepInFlight = false;

/**
 * One sweep tick: read the live company-wide month spend + cap and run the
 * exactly-once alert dispatcher. Never throws.
 */
export async function runCostCapAlertSweepOnce(): Promise<void> {
  if (sweepInFlight) {
    logger.warn("[cost-cap-sweeper] previous sweep still running; skipping this tick");
    return;
  }
  sweepInFlight = true;
  try {
    const usedUsd = await currentMonthCostGlobal();
    const capUsd = globalMonthlyCostCapUsd();
    // dispatchCostCapAlerts never throws and is a no-op below 80% or when
    // every crossed threshold is already stamped for this UTC month.
    await dispatchCostCapAlerts(usedUsd, capUsd);
  } catch (err) {
    // Log-and-continue: a failed spend lookup (DB blip) must never take the
    // server down. The next tick will try again.
    logger.warn({ err }, "[cost-cap-sweeper] sweep failed (continuing; will retry next tick)");
  } finally {
    sweepInFlight = false;
  }
}

/**
 * Start the periodic sweep. No-op under vitest (see module doc). Returns a
 * stop function (used by tests; the server lets it run for the process
 * lifetime).
 */
export function startCostCapAlertSweeper(): () => void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return () => {};
  }

  const initial = setTimeout(() => {
    void runCostCapAlertSweepOnce();
  }, INITIAL_DELAY_MS);
  const interval = setInterval(() => {
    void runCostCapAlertSweepOnce();
  }, SWEEP_INTERVAL_MS);

  // Never hold the process open on account of the sweeper.
  initial.unref();
  interval.unref();

  logger.info(
    { intervalMinutes: SWEEP_INTERVAL_MS / 60_000 },
    "[cost-cap-sweeper] periodic cost-cap alert sweep started",
  );

  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
