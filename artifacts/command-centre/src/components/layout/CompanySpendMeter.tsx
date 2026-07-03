import { Link } from "wouter";
import {
  useGetCompanySpend,
  getGetCompanySpendQueryKey,
} from "@workspace/api-client-react";
import type { CompanySpend } from "@workspace/api-client-react";

function fmtUsd(n: number): string {
  return `$${n.toFixed(n < 1 && n > 0 ? 4 : 2)}`;
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
 * current-month spend against the shared STAFF_MONTHLY_COST_CAP_USD cap so
 * staff can see the ceiling coming before engine runs start refusing with
 * 402 COST_CAP_EXCEEDED.
 */
export function CompanySpendMeter() {
  const { data } = useGetCompanySpend({
    query: { queryKey: getGetCompanySpendQueryKey(), refetchInterval: 60_000, staleTime: 30_000, retry: false },
  });
  if (!data) return null;
  const { usedUsd, capUsd, percentUsed, warnLevel } = data;
  return (
    <Link
      href="/me/costs"
      className="hidden md:flex flex-col gap-1 min-w-[150px] max-w-[190px] shrink group"
      title={`Company LLM spend this month: ${fmtUsd(usedUsd)} of ${fmtUsd(capUsd)} (${percentUsed.toFixed(1)}%). Resets ${fmtResetDate(data.monthResetsAt)} UTC.`}
      data-testid="link-company-spend-meter"
    >
      <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          LLM spend
        </span>
        <span className={`tabular-nums font-semibold ${TEXT_COLORS[warnLevel]}`} data-testid="text-company-spend">
          {fmtUsd(usedUsd)} / {fmtUsd(capUsd)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${BAR_COLORS[warnLevel]} transition-all`}
          style={{ width: `${Math.min(100, Math.max(percentUsed > 0 ? 2 : 0, percentUsed)).toFixed(2)}%` }}
        />
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
  const { usedUsd, capUsd, percentUsed, warnLevel } = data;
  const resetDate = fmtResetDate(data.monthResetsAt);

  const styles =
    warnLevel === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200";

  const headline =
    warnLevel === "blocked"
      ? "Monthly LLM cost cap reached — engine runs are paused."
      : warnLevel === "critical"
        ? `Company LLM spend is at ${percentUsed.toFixed(1)}% of this month's cap.`
        : `Company LLM spend has passed 80% of this month's cap (${percentUsed.toFixed(1)}%).`;

  const detail =
    warnLevel === "blocked"
      ? `The company-wide cap of ${fmtUsd(capUsd)} has been used. Runs resume when the counter resets on ${resetDate} UTC, or sooner if an admin raises STAFF_MONTHLY_COST_CAP_USD.`
      : warnLevel === "critical"
        ? `${fmtUsd(usedUsd)} of ${fmtUsd(capUsd)} used — engine runs will start refusing once the cap is hit. Pace heavy engines (F6/F7/F8) or ask an admin to raise the cap.`
        : `${fmtUsd(usedUsd)} of ${fmtUsd(capUsd)} used this month. Consider pacing heavy engines (F6/F7/F8) or asking an admin to raise the cap before work is blocked.`;

  return (
    <div
      className={`border-b px-4 py-2 text-sm ${styles}`}
      role="alert"
      data-testid={`banner-company-spend-${warnLevel}`}
    >
      <div className="container mx-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <strong>{headline}</strong>
        <span className="opacity-90">{detail}</span>
        <Link href="/me/costs" className="underline underline-offset-2 hover:opacity-80 shrink-0">
          View costs
        </Link>
      </div>
    </div>
  );
}
