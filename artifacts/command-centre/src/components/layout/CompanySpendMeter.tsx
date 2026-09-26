import { Link } from "wouter";
import {
  useGetCompanySpend,
  getGetCompanySpendQueryKey,
} from "@workspace/api-client-react";
import type { CompanySpend } from "@workspace/api-client-react";

function fmtUsd(n: number): string {
  return `$${n.toFixed(n < 1 && n > 0 ? 4 : 2)}`;
}

function fmtAlertDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtResetDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the start of next month UTC";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const BAR_COLORS: Record<CompanySpend["warnLevel"], string> = {
  ok: "bg-emerald-600",
  warn: "bg-amber-500",
  critical: "bg-red-500",
  blocked: "bg-red-600",
};

const TEXT_COLORS: Record<CompanySpend["warnLevel"], string> = {
  ok: "text-muted-foreground",
  warn: "text-amber-700 dark:text-amber-400",
  critical: "text-red-700 dark:text-red-400",
  blocked: "text-red-700 dark:text-red-400",
};

/**
 * Compact company-wide LLM spend meter for the portal header. Shows the
 * completed charges against the shared cap, with active reservations shown
 * separately so staff can distinguish in-flight estimates from actual spend.
 */
export function CompanySpendMeter() {
  const { data } = useGetCompanySpend({
    query: { queryKey: getGetCompanySpendQueryKey(), refetchInterval: 60_000, staleTime: 30_000, retry: false },
  });
  if (!data) return null;
  const { usedUsd, reservedUsd, remainingUsd, capUsd, percentUsed, warnLevel } = data;
  const visibleReservedUsd = Math.min(reservedUsd, Math.max(0, capUsd - usedUsd));
  return (
    <Link
      href="/me/costs"
      className="hidden md:flex flex-col gap-1 min-w-[150px] max-w-[190px] shrink group"
      title={`Completed charges: ${fmtUsd(usedUsd)}. Temporarily reserved for in-flight calls: ${fmtUsd(reservedUsd)}. Available: ${fmtUsd(remainingUsd)} of ${fmtUsd(capUsd)}. Reservations are replaced by actual charges when calls finish and released when calls fail. Resets ${fmtResetDate(data.monthResetsAt)} UTC.`}
      data-testid="link-company-spend-meter"
    >
      <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          Completed
        </span>
        <span className={`tabular-nums font-semibold ${TEXT_COLORS[warnLevel]}`} data-testid="text-company-spend">
          {fmtUsd(usedUsd)} / {fmtUsd(capUsd)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="flex h-full w-full">
          <div
            className={`h-full ${BAR_COLORS[warnLevel]} transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, (usedUsd / capUsd) * 100)).toFixed(2)}%` }}
          />
          <div
            className="h-full bg-sky-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, (visibleReservedUsd / capUsd) * 100)).toFixed(2)}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between gap-2 text-[9px] leading-none text-muted-foreground">
        <span>In flight: {fmtUsd(reservedUsd)}</span>
        <span>{fmtUsd(remainingUsd)} available</span>
      </div>
    </Link>
  );
}

/**
 * Full-width warning banner shown under the top nav once company-wide spend
 * crosses 80% of the shared monthly cap. Escalates at 95% and again when the
 * cap is reached (engine runs now refuse with 402).
 */
export function CompanySpendBanner() {
  const { data } = useGetCompanySpend({
    query: { queryKey: getGetCompanySpendQueryKey(), refetchInterval: 60_000, staleTime: 30_000, retry: false },
  });
  if (!data || data.warnLevel === "ok") return null;
  const { usedUsd, reservedUsd, remainingUsd, capUsd, percentUsed, warnLevel } = data;
  const resetDate = fmtResetDate(data.monthResetsAt);

  // The one-time admin threshold emails already dispatched this month —
  // telling staff the escalation happened saves a duplicate manual ping.
  const latestAlert =
    data.alertsSent.length > 0
      ? data.alertsSent.reduce((a, b) => (b.thresholdPercent > a.thresholdPercent ? b : a))
      : null;

  const styles =
    warnLevel === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200";

  const headline =
    warnLevel === "blocked"
      ? "Monthly LLM cost cap reached — engine runs are paused."
      : warnLevel === "critical"
        ? `Company LLM budget is at ${percentUsed.toFixed(1)}% of this month's cap.`
        : `Company LLM budget has passed 80% of this month's cap (${percentUsed.toFixed(1)}%).`;

  const detail =
    warnLevel === "blocked"
      ? `Completed charges (${fmtUsd(usedUsd)}) plus temporary reservations (${fmtUsd(reservedUsd)}) have reached the ${fmtUsd(capUsd)} cap. Reservations are not completed charges; they are replaced by actual costs when calls finish and released when calls fail. Runs resume when the counter resets on ${resetDate} UTC, or sooner if an admin raises the cap.`
      : warnLevel === "critical"
        ? `${fmtUsd(usedUsd)} completed and ${fmtUsd(reservedUsd)} reserved; ${fmtUsd(remainingUsd)} remains available. Engine runs will start refusing once the cap is hit.`
        : `${fmtUsd(usedUsd)} completed and ${fmtUsd(reservedUsd)} reserved; ${fmtUsd(remainingUsd)} remains available this month.`;

  return (
    <div
      className={`border-b px-4 py-2 text-sm ${styles}`}
      role="alert"
      data-testid={`banner-company-spend-${warnLevel}`}
    >
      <div className="container mx-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <strong>{headline}</strong>
        <span className="opacity-90">{detail}</span>
        {latestAlert ? (
          <span className="opacity-90" data-testid="text-cost-cap-alert-sent">
            Admins were already emailed the {latestAlert.thresholdPercent}% alert on{" "}
            {fmtAlertDate(latestAlert.sentAt)} — no need to ping them again.
          </span>
        ) : null}
        <Link href="/me/costs" className="underline underline-offset-2 hover:opacity-80 shrink-0">
          View costs
        </Link>
      </div>
    </div>
  );
}
