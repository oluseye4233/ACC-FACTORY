import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetCompanySpend,
  getGetCompanySpendQueryKey,
  useGetCompanySpendByUser,
  getGetCompanySpendByUserQueryKey,
} from "@workspace/api-client-react";
import { TopNav } from "@/components/layout/TopNav";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type CostSummary } from "@/lib/api";

const ENGINE_LABELS: Record<number, string> = {
  1: "F1 Diagnose",
  2: "F2 Atomic",
  3: "F3 Build MA",
  4: "F4 Micro PDD",
  5: "F5 Build SPC",
  6: "F6 Draft PDD",
  7: "F7 MVP PDD",
  8: "F6-VDJ / DE-SPC",
  9: "F8 Code ORACLE",
  10: "ATLAS J",
  11: "PFP",
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function fmtShortDate(iso: string): string {
  // "2026-05-28" → "May 28"
  const [, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? m} ${Number(d)}`;
}

function CapMeter({ summary }: { summary: CostSummary }) {
  const { usedUsd, capUsd, percentUsed, overCap, tierDefaultUsd, overrideUsd } = summary.monthToDate;
  const warn = percentUsed >= 80 && !overCap;
  const barColor = overCap
    ? "bg-red-600"
    : warn
    ? "bg-amber-500"
    : "bg-emerald-600";
  const textColor = overCap ? "text-red-700" : warn ? "text-amber-700" : "text-emerald-700";
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 className="text-lg font-semibold">Month-to-date LLM cost</h2>
        <div className={`text-2xl font-mono tabular-nums ${textColor}`}>
          {fmtUsd(usedUsd)} <span className="text-base text-muted-foreground">/ {fmtUsd(capUsd)}</span>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.min(100, Math.max(2, percentUsed)).toFixed(2)}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Cap resets at the start of next month UTC. Tier <span className="font-semibold">{summary.effectiveTier}</span>{" "}
          default: {fmtUsd(tierDefaultUsd)}
          {overrideUsd !== null ? ` · admin override: ${fmtUsd(overrideUsd)}` : ""}
          {summary.tier !== summary.effectiveTier
            ? ` · personal tier ${summary.tier} (elevated by team membership)`
            : ""}
        </span>
        <span className={`font-semibold ${textColor}`}>{percentUsed.toFixed(1)}% used</span>
      </div>
      {overCap ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <strong>Cap reached.</strong> Engine runs are paused until the cap resets or an admin raises it. Contact your administrator
          if you need an immediate increase.
        </div>
      ) : warn ? (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You're past 80% of this month's cap. Consider pacing the heavy engines (F6/F7/F8) or requesting an override.
        </div>
      ) : null}
    </div>
  );
}

function CompanySpendCard() {
  const { data } = useGetCompanySpend({
    query: { queryKey: getGetCompanySpendQueryKey(), refetchInterval: 60_000, staleTime: 30_000, retry: false },
  });
  if (!data) return null;
  const { usedUsd, capUsd, percentUsed, warnLevel } = data;
  const barColor =
    warnLevel === "blocked" || warnLevel === "critical"
      ? "bg-red-600"
      : warnLevel === "warn"
        ? "bg-amber-500"
        : "bg-emerald-600";
  const textColor =
    warnLevel === "blocked" || warnLevel === "critical"
      ? "text-red-700"
      : warnLevel === "warn"
        ? "text-amber-700"
        : "text-emerald-700";
  const resetDate = new Date(data.monthResetsAt);
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm" data-testid="card-company-spend">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 className="text-lg font-semibold">Company-wide LLM spend (this month)</h2>
        <div className={`text-2xl font-mono tabular-nums ${textColor}`}>
          {fmtUsd(usedUsd)} <span className="text-base text-muted-foreground">/ {fmtUsd(capUsd)}</span>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.min(100, Math.max(percentUsed > 0 ? 2 : 0, percentUsed)).toFixed(2)}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          One shared cap for the whole team (STAFF_MONTHLY_COST_CAP_USD). Every engine run counts here —
          once it's hit, all runs pause until{" "}
          {Number.isNaN(resetDate.getTime())
            ? "the start of next month UTC"
            : resetDate.toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" })}{" "}
          UTC or an admin raises the cap.
        </span>
        <span className={`font-semibold ${textColor}`}>{percentUsed.toFixed(1)}% used</span>
      </div>
      {data.alertsSent.length > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs"
          data-testid="row-cost-cap-alerts"
        >
          <span className="font-medium text-muted-foreground">Admin alerts already emailed this month:</span>
          {data.alertsSent.map((a) => (
            <span
              key={a.thresholdPercent}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 font-mono tabular-nums"
              data-testid={`badge-cost-cap-alert-${a.thresholdPercent}`}
              title={`The one-time ${a.thresholdPercent}% threshold email went to all admins on ${fmtAlertDate(a.sentAt)} — no need to ping them again.`}
            >
              {a.thresholdPercent}% · {fmtAlertDate(a.sentAt)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function fmtAlertDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function SpendByUserCard() {
  const { data, error } = useGetCompanySpendByUser({
    query: {
      queryKey: getGetCompanySpendByUserQueryKey(),
      refetchInterval: 60_000,
      staleTime: 30_000,
      retry: false,
    },
  });
  if (error) {
    return (
      <div
        className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        data-testid="error-spend-by-user"
      >
        Couldn't load the per-person spend breakdown. Refresh in a moment.
      </div>
    );
  }
  if (!data) {
    return <Skeleton className="h-40 w-full" data-testid="skeleton-spend-by-user" />;
  }
  const maxCost = Math.max(0.0001, ...data.users.map((u) => u.costUsd));
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm" data-testid="card-spend-by-user">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Who's using the budget (this month)</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtUsd(data.totalUsd)} of {fmtUsd(data.capUsd)} shared cap
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Month-to-date spend per staff member — the same numbers as the company-wide meter, split by
        person, highest first.
      </p>
      {data.users.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-spend-by-user-empty">
          No engine runs yet this month.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Staff member</th>
              <th className="pb-2 font-medium text-right">Runs</th>
              <th className="pb-2 font-medium text-right">Cost</th>
              <th className="pb-2 font-medium text-right">Share</th>
              <th className="pb-2 pl-4 font-medium w-32 sm:w-48" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.userId} className="border-t" data-testid={`row-spend-user-${u.userId}`}>
                <td className="py-2">
                  <span className="font-medium">{u.displayName}</span>
                  {u.email && u.email !== u.displayName ? (
                    <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                      {u.email}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">{u.runs}</td>
                <td className="py-2 text-right tabular-nums">{fmtUsd(u.costUsd)}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {u.sharePercent.toFixed(1)}%
                </td>
                <td className="py-2 pl-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500/80"
                      style={{
                        width: `${Math.max(2, (u.costUsd / maxCost) * 100).toFixed(2)}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DailyBars({ daily }: { daily: CostSummary["dailyBreakdown"] }) {
  const max = Math.max(0.0001, ...daily.map((d) => d.costUsd));
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Last 30 days</h2>
        <span className="text-xs text-muted-foreground">peak day {fmtUsd(max)}</span>
      </div>
      <div className="flex h-32 items-end gap-1">
        {daily.map((d) => {
          const h = max > 0 ? (d.costUsd / max) * 100 : 0;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center"
              title={`${d.date}: ${fmtUsd(d.costUsd)} (${d.runs} runs)`}
            >
              <div
                className="w-full rounded-t bg-emerald-500/80 group-hover:bg-emerald-600 transition-colors"
                style={{ height: `${h}%`, minHeight: d.costUsd > 0 ? "2px" : "0px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{daily.length > 0 ? fmtShortDate(daily[0]!.date) : ""}</span>
        <span>today</span>
      </div>
    </div>
  );
}

function ByEngineTable({ byEngine }: { byEngine: CostSummary["byEngine"] }) {
  if (byEngine.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">By engine (this month)</h2>
        <p className="text-sm text-muted-foreground">No engine runs yet this month.</p>
      </div>
    );
  }
  const total = byEngine.reduce((s, e) => s + e.costUsd, 0);
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">By engine (this month)</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium">Engine</th>
            <th className="pb-2 font-medium text-right">Runs</th>
            <th className="pb-2 font-medium text-right">Cost</th>
            <th className="pb-2 font-medium text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {byEngine.map((e) => (
            <tr key={e.engineId} className="border-t">
              <td className="py-2">{ENGINE_LABELS[e.engineId] ?? `Engine ${e.engineId}`}</td>
              <td className="py-2 text-right tabular-nums">{e.runs}</td>
              <td className="py-2 text-right tabular-nums">{fmtUsd(e.costUsd)}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {total > 0 ? `${((e.costUsd / total) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentRunsTable({ recent }: { recent: CostSummary["recentRuns"] }) {
  if (recent.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Most recent 20 runs</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Engine</th>
              <th className="pb-2 font-medium">Session</th>
              <th className="pb-2 font-medium">Provider</th>
              <th className="pb-2 font-medium text-right">In</th>
              <th className="pb-2 font-medium text-right">Out</th>
              <th className="pb-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2 text-xs text-muted-foreground">
                  {new Date(r.ts).toLocaleString()}
                </td>
                <td className="py-2">{ENGINE_LABELS[r.engineId] ?? `Engine ${r.engineId}`}</td>
                <td className="py-2">
                  <Link href={`/session/${r.sessionId}`} className="text-primary hover:underline">
                    {r.sessionId.slice(0, 8)}
                  </Link>
                </td>
                <td className="py-2 text-xs text-muted-foreground">{r.provider}</td>
                <td className="py-2 text-right tabular-nums">{r.inputTokens.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums">{r.outputTokens.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MeCosts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["cost-summary"],
    queryFn: () => api.get<CostSummary>("/api/me/cost-summary"),
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="container mx-auto max-w-6xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">LLM cost &amp; cap</h1>
          <p className="text-sm text-muted-foreground">
            Month-to-date spend across every HARNESS engine. Cap is per calendar month UTC.
          </p>
        </header>

        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Couldn't load cost summary. Refresh in a moment.
          </div>
        ) : data ? (
          <>
            <CompanySpendCard />
            <SpendByUserCard />
            <CapMeter summary={data} />
            <DailyBars daily={data.dailyBreakdown} />
            <div className="grid gap-6 md:grid-cols-2">
              <ByEngineTable byEngine={data.byEngine} />
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-2">How the cap works</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>The cap is a runaway-spend guard — a stuck loop or compromised account can't quietly burn unlimited tokens.</li>
                  <li>Sum is live across every engine call (F1–F8 + ATLAS J + PFP), tagged to the logged-in user.</li>
                  <li>Team / Team Lite seat holders use their elevated tier's cap, not the personal one.</li>
                  <li>Admins can raise an individual account's cap from the admin tools without changing the tier defaults.</li>
                  <li>Counter resets at the start of next calendar month UTC.</li>
                </ul>
              </div>
            </div>
            <RecentRunsTable recent={data.recentRuns} />
          </>
        ) : null}
      </main>
    </div>
  );
}
