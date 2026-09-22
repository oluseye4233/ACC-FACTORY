import { Redirect, Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { useGetMe, useAdminGetCronStatus } from "@workspace/api-client-react";
import type { CronTargetStatus } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, TimerOff } from "lucide-react";

function formatAgo(minutes: number | null): string {
  if (minutes === null) return "never";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}

/**
 * "expected N, got M in last 24h" flakiness line. Only meaningful for
 * schedules with at least one expected tick per day; a shortfall means the
 * schedule is firing intermittently even when the LAST tick looks recent.
 * One missed tick is tolerated before flagging (window-boundary effects on
 * the densest schedule would otherwise flap the warning).
 */
function TickHistoryLine({ t }: { t: CronTargetStatus }) {
  if (t.expectedTicksLast24h < 1) {
    if (t.recentTicks.length === 0) return null;
    return (
      <div
        className="text-xs text-muted-foreground"
        data-testid={`text-tick-history-${t.target}`}
      >
        {t.ticksLast24h} tick{t.ticksLast24h === 1 ? "" : "s"} in last 24h (schedule is
        coarser than daily)
      </div>
    );
  }
  // Schedule-aware tolerance: dense schedules (many ticks/day) get one
  // missed tick of slack so window-boundary effects never flap the warning;
  // low-frequency schedules (e.g. daily, expected=1) must flag ANY shortfall
  // or "expected 1, got 0" would never warn.
  const tolerance = t.expectedTicksLast24h >= 8 ? 1 : 0;
  const flaky = t.ticksLast24h < t.expectedTicksLast24h - tolerance;
  return (
    <div
      className={`text-xs ${flaky ? "text-amber-500 font-medium" : "text-muted-foreground"}`}
      data-testid={`text-tick-history-${t.target}`}
    >
      Last 24h: expected {t.expectedTicksLast24h}, got {t.ticksLast24h}
      {flaky ? " — schedule looks flaky" : ""}
    </div>
  );
}

/**
 * Compact strip of the most recent ticks (oldest → newest, left → right).
 * A dot turns amber when the gap since the previous tick exceeded 2× the
 * expected interval — a visible "hole" even when the latest tick is green.
 */
function TickStrip({ t }: { t: CronTargetStatus }) {
  if (t.recentTicks.length === 0) return null;
  const ticks = [...t.recentTicks].reverse(); // oldest first
  const gapThresholdMs = t.expectedIntervalMinutes * 2 * 60_000;
  return (
    <div
      className="flex items-center gap-1 mt-1"
      data-testid={`strip-ticks-${t.target}`}
      aria-label={`Recent ticks for ${t.label}`}
    >
      {ticks.map((iso, i) => {
        const gapMs = i > 0 ? new Date(iso).getTime() - new Date(ticks[i - 1]!).getTime() : 0;
        const gapped = i > 0 && gapMs > gapThresholdMs;
        return (
          <span
            key={iso}
            title={`${formatUtc(iso)}${gapped ? ` — ${Math.round(gapMs / 60_000)} min gap before this tick` : ""}`}
            className={`inline-block h-2 w-2 rounded-full ${
              gapped ? "bg-amber-500" : "bg-green-600"
            }`}
          />
        );
      })}
    </div>
  );
}

function StatusBadge({ t }: { t: CronTargetStatus }) {
  if (t.stale) {
    return (
      <Badge variant="destructive" className="gap-1" data-testid={`badge-stale-${t.target}`}>
        <AlertTriangle className="h-3 w-3" />
        {t.neverTicked ? "NEVER TICKED" : "STALE"}
      </Badge>
    );
  }
  if (t.neverTicked) {
    return (
      <Badge variant="secondary" className="gap-1" data-testid={`badge-waiting-${t.target}`}>
        <TimerOff className="h-3 w-3" />
        AWAITING FIRST TICK
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-green-700 text-green-500"
      data-testid={`badge-ok-${t.target}`}
    >
      <CheckCircle2 className="h-3 w-3" />
      OK
    </Badge>
  );
}

export default function AdminOps() {
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const isAdmin = me?.role === "ADMIN";
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useAdminGetCronStatus({
    query: { enabled: isAdmin, queryKey: ["/admin/cron-status"] as const },
  });

  if (isLoadingMe) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav />
        <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl">
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (!me || me.role !== "ADMIN") {
    return <Redirect to="/command" />;
  }

  const staleCount = data?.targets.filter((t) => t.stale).length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Ops Health
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dead-man's-switch over the external Scheduled-Deployment cron ticks. A stale
              target means its schedule has silently stopped — the safety net it provides is
              degraded until it ticks again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              data-testid="button-refresh-cron-status"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/admin/badges">
              <Button variant="ghost" size="sm">
                Badges →
              </Button>
            </Link>
          </div>
        </div>

        {staleCount > 0 && (
          <div
            className="border border-destructive/50 bg-destructive/10 rounded-md px-4 py-3 text-sm flex items-center gap-2"
            data-testid="banner-stale-warning"
          >
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span>
              {staleCount} cron {staleCount === 1 ? "target is" : "targets are"} overdue. Check
              the Scheduled Deployments in the Publishing tool: the deployment may be missing,
              CRON_SECRET / PUBLIC_BASE_URL may have drifted, or the app was re-published with
              Private visibility (which blocks external cron ticks).
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Scheduled cron targets</CardTitle>
            <CardDescription>
              Each target should be driven by its own Replit Scheduled Deployment running{" "}
              <code className="font-mono text-xs">cron-tick</code>. A target is flagged stale
              once it hasn't ticked within roughly 2× its schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : isError || !data ? (
              <p className="text-sm text-destructive">Could not load cron status. Try again.</p>
            ) : (
              <div className="divide-y">
                {data.targets.map((t) => (
                  <div
                    key={t.target}
                    className="py-4 flex flex-wrap items-center justify-between gap-3"
                    data-testid={`row-cron-${t.target}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.label}</span>
                        <code className="text-xs font-mono text-muted-foreground">
                          {t.target}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.schedule} · stale after {t.staleAfterMinutes} min without a tick
                      </p>
                      <div className="mt-1.5 space-y-0.5">
                        <TickHistoryLine t={t} />
                        <TickStrip t={t} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <div data-testid={`text-last-tick-${t.target}`}>
                          Last tick:{" "}
                          <span className={t.stale ? "text-destructive font-medium" : ""}>
                            {formatAgo(t.minutesSinceLastTick)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatUtc(t.lastTickAt)} · {t.tickCount} tick
                          {t.tickCount === 1 ? "" : "s"} recorded
                        </div>
                      </div>
                      <StatusBadge t={t} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Stale targets also trigger a one-time email to ADMIN_EMAILS per outage (sent by the
          server's 15-minute monitor while it is awake). This page computes staleness live on
          every load.
        </p>
      </main>
    </div>
  );
}
