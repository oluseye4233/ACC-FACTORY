import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
