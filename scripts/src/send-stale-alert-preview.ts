/**
 * One-off manual sender for the cron stale-schedule alert email
 * (sendCronTargetStaleAlert) so the HTML can be verified in a real inbox
 * with a real RESEND_API_KEY before production relies on it.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run send-stale-alert-preview
 *     → sends to every ADMIN_EMAILS address
 *   pnpm --filter @workspace/scripts run send-stale-alert-preview -- --to=me@example.com
 *     → sends to a specific address
 *   Add --never to preview the "never ticked" variant instead.
 *
 * Requires RESEND_API_KEY (otherwise the email lib dry-runs to console and
 * nothing lands in an inbox — the script exits non-zero in that case so a
 * "successful" dry-run is never mistaken for a real send).
 */
import { sendCronTargetStaleAlert } from "@workspace/email";

const args = process.argv.slice(2);
const toFlag = args.find((a) => a.startsWith("--to="))?.slice("--to=".length);
const neverTicked = args.includes("--never");

const recipients = toFlag
  ? [toFlag]
  : (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

if (recipients.length === 0) {
  console.error("No recipients: set ADMIN_EMAILS or pass --to=<email>.");
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error(
    "RESEND_API_KEY is not set — the email lib would dry-run to console and nothing would land in an inbox. Aborting.",
  );
  process.exit(1);
}

const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
const opsUrl = base ? `${base}/admin/ops` : undefined;

// Realistic sample: the 15-minute cost-cap sweep went quiet ~2h ago.
const lastTickAt = neverTicked ? null : new Date(Date.now() - 3 * 60 * 60_000);

async function main(): Promise<void> {
  for (const to of recipients) {
    const result = await sendCronTargetStaleAlert({
      to,
      target: "sweep-cost-cap-alerts",
      label: "Cost-cap alert sweep",
      schedule: "every 15 minutes (*/15 * * * *)",
      lastTickAt,
      staleAfterMinutes: 60,
      overdueMinutes: 120,
      opsUrl,
    });
    if (!result.ok) {
      console.error(`FAILED -> ${to}: ${result.error}`);
      process.exitCode = 1;
    } else {
      console.log(`sent -> ${to} (id: ${result.id}${result.dryRun ? ", DRY-RUN" : ""})`);
    }
  }
  if (!opsUrl) {
    console.warn(
      "note: PUBLIC_BASE_URL is unset — the email was sent WITHOUT the /admin/ops link.",
    );
  }
}

void main();
