import { db, costCapNotificationsTable } from "@workspace/db";
import { sendCostCapThresholdAlert } from "@workspace/email";
import { logger } from "./logger";
import { safeFire } from "./notifications";

/**
 * Ascending thresholds (percent of STAFF_MONTHLY_COST_CAP_USD) at which admins
 * are emailed. Matches the command-centre spend-meter warn levels (80% warn,
 * 95% critical, 100% blocked).
 */
export const COST_CAP_ALERT_THRESHOLDS = [80, 95, 100] as const;

/** Parse the comma-separated ADMIN_EMAILS allowlist into a clean list. */
export function adminAlertEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

let warnedNoAdminEmails = false;

/**
 * Core dispatcher: given the current company-wide month spend and cap, send a
 * one-time email to every ADMIN_EMAILS address for each threshold (80/95/100%)
 * that spend has crossed this UTC month and that has not been notified yet.
 *
 * Exactly-once semantics survive restarts and concurrent requests: the
 * `cost_cap_notifications` table has a UNIQUE (month, threshold_percent)
 * index and we INSERT ... ON CONFLICT DO NOTHING *before* sending — only the
 * request whose insert landed sends the email. When ADMIN_EMAILS is empty we
 * do NOT stamp the row, so configuring it later still triggers the alert.
 *
 * Never throws — an alerting failure must not affect the request that
 * triggered the check.
 */
export async function dispatchCostCapAlerts(
  usedUsd: number,
  capUsd: number,
  now: Date = new Date(),
): Promise<void> {
  try {
    if (!Number.isFinite(usedUsd) || !Number.isFinite(capUsd) || capUsd <= 0) return;
    const percentUsed = (usedUsd / capUsd) * 100;
    const crossed = COST_CAP_ALERT_THRESHOLDS.filter((t) => percentUsed >= t);
    if (crossed.length === 0) return;

    const recipients = adminAlertEmails();
    if (recipients.length === 0) {
      if (!warnedNoAdminEmails) {
        warnedNoAdminEmails = true;
        logger.warn(
          { percentUsed: Math.round(percentUsed) },
          "Company LLM spend crossed an alert threshold but ADMIN_EMAILS is empty — no cost-cap alert emails can be sent",
        );
      }
      return;
    }

    const month = now.toISOString().slice(0, 7); // YYYY-MM (UTC)
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    for (const thresholdPercent of crossed) {
      const inserted = await db
        .insert(costCapNotificationsTable)
        .values({
          month,
          thresholdPercent,
          usedUsd: usedUsd.toFixed(6),
          capUsd: capUsd.toFixed(2),
        })
        .onConflictDoNothing()
        .returning({ id: costCapNotificationsTable.id });
      if (!inserted[0]) continue; // already notified this month (or race lost)

      logger.info(
        { month, thresholdPercent, usedUsd, capUsd, recipients: recipients.length },
        "Dispatching company cost-cap threshold alert to admins",
      );
      for (const to of recipients) {
        void safeFire(
          "cost-cap-threshold-alert",
          sendCostCapThresholdAlert({
            to,
            thresholdPercent,
            usedUsd,
            capUsd,
            percentUsed,
            resetsAt,
          }),
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "dispatchCostCapAlerts failed");
  }
}

/**
 * Fire-and-forget wrapper used from the `requireCostBudget` hot path. Skips
 * entirely under vitest (the suites deliberately shrink the cap to force 402s
 * against the shared dev DB — stamping the real month there would suppress a
 * genuine production alert). Tests exercise {@link dispatchCostCapAlerts}
 * directly.
 */
export function maybeDispatchCostCapAlerts(usedUsd: number, capUsd: number): void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  void dispatchCostCapAlerts(usedUsd, capUsd);
}
