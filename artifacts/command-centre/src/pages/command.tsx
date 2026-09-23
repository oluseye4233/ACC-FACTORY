import { Link } from "wouter";
import {
  useGetMe,
  useListSessions,
  useHealthDeep,
  useGetMyUsage,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/shared/TierBadge";
import { TopNav } from "@/components/layout/TopNav";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CirclePlus,
  Database,
  FileUp,
  Library,
  Play,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

function HealthChip({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string;
  tone: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "bg-primary/10 text-primary border-primary/20"
      : tone === "warn"
        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
        : "bg-destructive/10 text-destructive border-destructive/20";

  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "good" ? "bg-primary" : tone === "warn" ? "bg-yellow-500" : "bg-destructive"}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`rounded border px-1.5 py-0.5 font-bold ${toneClass}`}>{value || "UNKNOWN"}</span>
    </div>
  );
}

function UtilityAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: typeof FileUp;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[72px] items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-wider">{label}</span>
        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function formatRecentBuildName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Untitled build";
}

function formatRecentBuildStatus(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "UNKNOWN";
}

function formatRecentBuildDate(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return "Unknown date";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : format(date, "yyyy-MM-dd HH:mm");
}

function formatRefreshTime(value: number | undefined): string | null {
  if (!Number.isFinite(value) || !value || Number.isNaN(new Date(value).getTime())) {
    return null;
  }

  return `Last refreshed ${format(new Date(value), "yyyy-MM-dd HH:mm")}`;
}

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

const METRIC_LABELS = ["Recent builds", "System status", "Monthly usage"] as const;
type MetricLabel = (typeof METRIC_LABELS)[number];
type RefreshFailure = {
  metricLabel: MetricLabel;
  attempt: number;
};

function isRefreshError(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "isError" in value &&
    value.isError === true
  );
}

export default function Command() {
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [isRefreshingOnFocus, setIsRefreshingOnFocus] = useState(false);
  const [refreshFailures, setRefreshFailures] = useState<RefreshFailure[]>([]);
  const [retryFailures, setRetryFailures] = useState<MetricLabel[]>([]);
  const isRefreshingAllRef = useRef(false);
  const refreshAttempts = useRef<Record<MetricLabel, number>>({
    "Recent builds": 0,
    "System status": 0,
    "Monthly usage": 0,
  });
  const inFlightMetricRequests = useRef<Partial<Record<MetricLabel, Promise<unknown>>>>({});
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const {
    data: sessions,
    isLoading: isLoadingSessions,
    isError: isSessionsError,
    isFetching: isFetchingSessions,
    dataUpdatedAt: sessionsUpdatedAt,
    refetch: refetchSessions,
  } = useListSessions();
  const {
    data: health,
    isLoading: isLoadingHealth,
    isError: isHealthError,
    isFetching: isFetchingHealth,
    dataUpdatedAt: healthUpdatedAt,
    refetch: refetchHealth,
  } = useHealthDeep();
  const {
    data: usageReport,
    isLoading: isLoadingUsage,
    isError: isUsageError,
    isFetching: isFetchingUsage,
    dataUpdatedAt: usageUpdatedAt,
    refetch: refetchUsage,
  } = useGetMyUsage();

  const activeSessions = sessions?.filter((session) => session.status !== "COMPLETE").length || 0;
  const completedMvps = sessions?.filter((session) => session.status === "COMPLETE").length || 0;
  const recentSessions = sessions?.slice(0, 5) || [];
  const monthlyEngineUsage = [...(usageReport?.byEngine ?? [])].sort(
    (a, b) => b.totalCostUsd - a.totalCostUsd || b.totalTokens - a.totalTokens,
  );
  const tier = me?.subscriber?.tier || "EXPLORER";

  const apiTone = health?.status === "ok" ? "good" : health?.status === undefined ? "warn" : "bad";
  const dbTone = health?.db === "ok" ? "good" : health?.db === undefined ? "warn" : "bad";
  const inferenceTone = health?.engines === "ok" ? "good" : health?.engines === "degraded" ? "warn" : health?.engines === undefined ? "warn" : "bad";
  const sessionsRefreshLabel = !isSessionsError ? formatRefreshTime(sessionsUpdatedAt) : null;
  const healthRefreshLabel = !isHealthError ? formatRefreshTime(healthUpdatedAt) : null;
  const usageRefreshLabel = !isUsageError && usageReport?.month ? formatRefreshTime(usageUpdatedAt) : null;

  const beginMetricRefresh = (metricLabel: MetricLabel): number => {
    const attempt = refreshAttempts.current[metricLabel] + 1;
    refreshAttempts.current[metricLabel] = attempt;
    return attempt;
  };

  const isCurrentMetricRefresh = (metricLabel: MetricLabel, attempt: number): boolean =>
    refreshAttempts.current[metricLabel] === attempt;

  const getMetricRequest = (
    metricLabel: MetricLabel,
    refetch: () => Promise<unknown>,
  ): Promise<unknown> => {
    const existingRequest = inFlightMetricRequests.current[metricLabel];
    if (existingRequest) {
      return existingRequest;
    }

    let request: Promise<unknown>;
    try {
      request = Promise.resolve(refetch());
    } catch (error) {
      request = Promise.reject(error);
    }

    inFlightMetricRequests.current[metricLabel] = request;
    const clearRequest = () => {
      if (inFlightMetricRequests.current[metricLabel] === request) {
        delete inFlightMetricRequests.current[metricLabel];
      }
    };
    request.then(clearRequest, clearRequest);
    return request;
  };

  const setMetricRefreshFailure = (metricLabel: MetricLabel, attempt: number) => {
    if (!isCurrentMetricRefresh(metricLabel, attempt)) {
      return;
    }

    setRefreshFailures((failures) => {
      const existingFailureIndex = failures.findIndex(
        (failure) => failure.metricLabel === metricLabel,
      );
      if (existingFailureIndex === -1) {
        return [...failures, { metricLabel, attempt }];
      }

      return failures.map((failure, index) =>
        index === existingFailureIndex ? { metricLabel, attempt } : failure,
      );
    });
  };

  const retryMetric = async (metricLabel: MetricLabel, refetch: () => Promise<unknown>) => {
    const attempt = beginMetricRefresh(metricLabel);

    try {
      const result = await getMetricRequest(metricLabel, refetch);
      if (!isCurrentMetricRefresh(metricLabel, attempt)) {
        return;
      }

      if (isRefreshError(result)) {
        setRetryFailures((failures) =>
          failures.includes(metricLabel) ? failures : [...failures, metricLabel],
        );
        setMetricRefreshFailure(metricLabel, attempt);
        return;
      }

      setRefreshFailures((failures) =>
        failures.filter((failure) => failure.metricLabel !== metricLabel),
      );
      setRetryFailures((failures) => failures.filter((failure) => failure !== metricLabel));
    } catch {
      if (isCurrentMetricRefresh(metricLabel, attempt)) {
        setRetryFailures((failures) =>
          failures.includes(metricLabel) ? failures : [...failures, metricLabel],
        );
      }
      setMetricRefreshFailure(metricLabel, attempt);
    }
  };

  const refreshAllMetrics = async (source: "manual" | "focus" = "manual") => {
    if (isRefreshingAllRef.current) {
      return;
    }

    isRefreshingAllRef.current = true;
    setIsRefreshingAll(true);
    setIsRefreshingOnFocus(source === "focus");
    setRefreshFailures([]);
    setRetryFailures([]);
    const attempts = METRIC_LABELS.map((metricLabel) => beginMetricRefresh(metricLabel));
    try {
      const results = await Promise.allSettled([
        getMetricRequest("Recent builds", refetchSessions),
        getMetricRequest("System status", refetchHealth),
        getMetricRequest("Monthly usage", refetchUsage),
      ]);
      setRefreshFailures((failures) => {
        let nextFailures = failures;

        results.forEach((result, index) => {
          const metricLabel = METRIC_LABELS[index];
          const attempt = attempts[index];
          if (!isCurrentMetricRefresh(metricLabel, attempt)) {
            return;
          }

          nextFailures = nextFailures.filter(
            (failure) => failure.metricLabel !== metricLabel,
          );
          if (result.status === "rejected" || isRefreshError(result.value)) {
            nextFailures = [...nextFailures, { metricLabel, attempt }];
          }
        });

        return nextFailures;
      });
    } finally {
      isRefreshingAllRef.current = false;
      setIsRefreshingAll(false);
      setIsRefreshingOnFocus(false);
    }
  };

  const refreshAllMetricsRef = useRef(refreshAllMetrics);
  refreshAllMetricsRef.current = refreshAllMetrics;

  useEffect(() => {
    const handleRefreshSignal = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshAllMetricsRef.current("focus");
    };

    window.addEventListener("focus", handleRefreshSignal);
    window.addEventListener("pageshow", handleRefreshSignal);
    document.addEventListener("visibilitychange", handleRefreshSignal);
    return () => {
      window.removeEventListener("focus", handleRefreshSignal);
      window.removeEventListener("pageshow", handleRefreshSignal);
      document.removeEventListener("visibilitychange", handleRefreshSignal);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="container mx-auto px-4 py-6 md:px-6 md:py-9">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-primary">ATANDA · OPERATOR CONSOLE</p>
              <h1 className="font-display text-4xl tracking-wider md:text-5xl">COMMAND DECK</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshAllMetrics()}
                disabled={isRefreshingAll}
                data-testid="button-refresh-all-metrics"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAll ? "animate-spin" : ""}`} />
                {isRefreshingAll ? "Refreshing metrics…" : "Refresh all metrics"}
              </Button>
              {isRefreshingOnFocus && (
                <p
                  className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  data-testid="automatic-refresh-status"
                >
                  Refreshing metrics after returning to this tab…
                </p>
              )}
              {isLoadingMe ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <>
                  <span className="font-mono text-xs uppercase tracking-wider">{me?.displayName || me?.email || "UNKNOWN"}</span>
                  <span className="text-border">•</span>
                  <TierBadge tier={tier} />
                </>
              )}
            </div>
          </header>
          {refreshFailures.length > 0 && (
            <div
              className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
              role="alert"
              data-testid="refresh-all-metrics-error"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="font-mono text-[10px]">
                <p className="font-bold uppercase tracking-wider text-destructive">
                  Some metrics could not be refreshed
                </p>
                <p className="mt-1 text-muted-foreground">
                  {refreshFailures.map((failure) => failure.metricLabel).join(", ")} remain unchanged. Use the panel retry actions to try again.
                </p>
                {retryFailures.map((metricLabel) => (
                  <p
                    key={metricLabel}
                    className="mt-1 font-bold text-destructive"
                    data-testid={`metric-retry-failure-${metricLabel.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {metricLabel} is still unavailable after retry.
                  </p>
                ))}
              </div>
            </div>
          )}

          <section className="relative overflow-hidden rounded-[2rem] border border-destructive/30 bg-card p-4 shadow-[0_20px_80px_rgba(0,0,0,0.22)] md:p-8" data-testid="command-orb">
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative">
              <div className="mb-7 flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">PRIMARY COMMAND</p>
                  <p className="mt-1 text-xs text-muted-foreground">Start from a new idea or continue an existing build.</p>
                </div>
                <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-destructive">
                  Ready
                </span>
              </div>

              <div className="flex justify-center py-2 md:py-4">
                <Link
                  href="/session/new"
                  data-testid="button-build-something"
                  className="group flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-destructive/30 bg-destructive text-center text-destructive-foreground shadow-[0_0_0_10px_rgba(220,38,38,0.08),0_18px_45px_rgba(220,38,38,0.3)] transition-all hover:scale-[1.03] hover:bg-destructive/90 hover:shadow-[0_0_0_14px_rgba(220,38,38,0.1),0_22px_55px_rgba(220,38,38,0.4)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-destructive/40 focus-visible:ring-offset-4 focus-visible:ring-offset-card md:h-56 md:w-56"
                >
                  <CirclePlus className="mb-3 h-7 w-7 transition-transform group-hover:rotate-90" />
                  <span className="font-display text-2xl tracking-[0.12em]">BUILD</span>
                  <span className="font-display text-2xl tracking-[0.12em]">SOMETHING</span>
                  <span className="mt-3 font-mono text-[9px] uppercase tracking-wider opacity-80">New harness session</span>
                </Link>
              </div>

              <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <UtilityAction href="/sessions" icon={Play} label="Resume Session" description="Continue a live harness" />
                <UtilityAction href="/ingest" icon={FileUp} label="Import Existing" description="Bring in a document" />
                <UtilityAction href="/exemplars" icon={Library} label="Open Library" description="Browse proven examples" />
                <UtilityAction href="/quests" icon={Trophy} label="View Quests" description="Track operator progress" />
              </div>
            </div>
          </section>

          <section className="my-4 grid gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Command Deck summary">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Active sessions</p>
                <p className="font-mono text-lg font-bold text-primary">
                  {isLoadingSessions ? "—" : isSessionsError ? "UNAVAILABLE" : activeSessions}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-border/50 sm:border-l sm:pl-4">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Completed MVPs</p>
                <p className="font-mono text-lg font-bold text-secondary">
                  {isLoadingSessions ? "—" : isSessionsError ? "UNAVAILABLE" : completedMvps}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-border/50 lg:border-l lg:pl-4">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Month usage</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg font-bold">
                    {isLoadingUsage
                      ? "—"
                      : isUsageError
                        ? "UNAVAILABLE"
                        : usageReport?.month
                          ? `${usageReport.month.totalTokens.toLocaleString()} tok`
                          : "—"}
                  </p>
                  {isUsageError && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => void retryMetric("Monthly usage", refetchUsage)}
                      disabled={isFetchingUsage}
                      aria-label="Retry monthly usage"
                      data-testid="button-retry-monthly-usage"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isFetchingUsage ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
                {usageRefreshLabel && (
                  <p
                    className="mt-1 break-words font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                    data-testid="monthly-usage-refreshed"
                  >
                    {usageRefreshLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 border-border/50 sm:border-l sm:pl-4 lg:border-l-0 lg:pl-0">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">System</p>
                <p className="font-mono text-lg font-bold uppercase">
                  {isLoadingHealth ? "—" : isHealthError ? "UNAVAILABLE" : health?.status || "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <Card className="bg-card">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-display text-xl tracking-wider">RECENT BUILDS</p>
                    <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">Your latest harness sessions</p>
                  </div>
                  {sessionsRefreshLabel && (
                    <p
                      className="break-words font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:text-right"
                      data-testid="sessions-refreshed"
                    >
                      {sessionsRefreshLabel}
                    </p>
                  )}
                  <Link href="/sessions" className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">View all</Link>
                </div>
                {isLoadingSessions ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
                  </div>
                ) : isSessionsError ? (
                  <div
                    className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
                    data-testid="recent-builds-error"
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-mono text-xs font-bold uppercase text-destructive">Recent builds unavailable</p>
                      <p className="mt-1 text-xs text-muted-foreground">We could not load your latest harness sessions.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void retryMetric("Recent builds", refetchSessions)}
                      disabled={isFetchingSessions}
                      data-testid="button-retry-sessions"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isFetchingSessions ? "animate-spin" : ""}`} />
                      Retry recent builds
                    </Button>
                  </div>
                ) : recentSessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center font-mono text-xs text-muted-foreground">
                    No sessions yet. Press BUILD SOMETHING to begin.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {recentSessions.map((session, index) => {
                      const sessionId = typeof session?.id === "string" && session.id.trim() ? session.id : `unknown-${index}`;
                      const sessionStatus = formatRecentBuildStatus(session?.status);

                      return (
                        <div key={sessionId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <Link href={`/session/${sessionId}`} className="block truncate text-sm font-medium hover:text-primary">{formatRecentBuildName(session?.sessionName)}</Link>
                            <span className="font-mono text-[10px] text-muted-foreground">{formatRecentBuildDate(session?.updatedAt)}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold ${sessionStatus === "COMPLETE" ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                              {sessionStatus}
                            </span>
                            <Link href={`/session/${sessionId}`} className="font-mono text-[10px] font-bold text-primary hover:underline">ENTER</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-5">
                <div className="mb-4">
                  <p className="font-display text-xl tracking-wider">SYSTEM</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">Core services</p>
                  {healthRefreshLabel && (
                    <p
                      className="mt-1 break-words font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                      data-testid="system-health-refreshed"
                    >
                      {healthRefreshLabel}
                    </p>
                  )}
                </div>
                {isLoadingHealth ? (
                  <div className="space-y-4"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></div>
                ) : isHealthError ? (
                  <div
                    className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
                    data-testid="system-status-error"
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-mono text-xs font-bold uppercase text-destructive">System status unavailable</p>
                      <p className="mt-1 text-xs text-muted-foreground">We could not reach the service health check.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void retryMetric("System status", refetchHealth)}
                      disabled={isFetchingHealth}
                      data-testid="button-retry-system-status"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isFetchingHealth ? "animate-spin" : ""}`} />
                      Retry system status
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <HealthChip label="API" value={health?.status} tone={apiTone} />
                    <HealthChip label="Data" value={health?.db} tone={dbTone} />
                    <HealthChip label="Inference" value={health?.engines} tone={inferenceTone} />
                    {isUsageError ? (
                      <div
                        className="border-t border-destructive/30 pt-4 font-mono text-[10px]"
                        data-testid="monthly-usage-error"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">MONTHLY USAGE</span>
                          <span className="font-bold text-destructive">UNAVAILABLE</span>
                        </div>
                        <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
                          Engine breakdown unavailable.
                        </p>
                      </div>
                    ) : usageReport?.month ? (
                      <div className="border-t border-border/50 pt-4">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="text-muted-foreground">MONTH COST</span>
                          <span className="font-bold">${usageReport.month.totalCostUsd.toFixed(2)}</span>
                        </div>
                        <div className="mt-3 border-t border-border/50 pt-3" data-testid="monthly-engine-usage">
                          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
                            <span className="text-muted-foreground">ENGINE USAGE</span>
                            <span className="text-muted-foreground">THIS MONTH</span>
                          </div>
                          {monthlyEngineUsage.length === 0 ? (
                            <p
                              className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                              data-testid="monthly-engine-usage-empty"
                            >
                              No engine usage recorded this month.
                            </p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {monthlyEngineUsage.map((engine) => (
                                <div
                                  key={engine.engineId}
                                  className="flex items-center justify-between gap-3 font-mono text-[9px]"
                                  data-testid={`monthly-engine-${engine.engineId}`}
                                >
                                  <span className="min-w-0 truncate font-bold">
                                    {ENGINE_LABELS[engine.engineId] ?? `Engine ${engine.engineId}`}
                                  </span>
                                  <span className="shrink-0 text-right text-muted-foreground">
                                    {engine.totalTokens.toLocaleString()} tok · ${engine.totalCostUsd.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-t border-border/50 pt-4 font-mono text-[10px]"
                        data-testid="monthly-usage-empty"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">MONTHLY USAGE</span>
                          <span className="font-bold text-muted-foreground">NO DATA</span>
                        </div>
                        <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
                          Monthly usage has not loaded.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
