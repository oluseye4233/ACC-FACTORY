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
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CirclePlus,
  Database,
  FileUp,
  Library,
  Play,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";

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

export default function Command() {
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const { data: sessions, isLoading: isLoadingSessions } = useListSessions();
  const { data: health, isLoading: isLoadingHealth } = useHealthDeep();
  const { data: usageReport, isLoading: isLoadingUsage } = useGetMyUsage();

  const activeSessions = sessions?.filter((session) => session.status !== "COMPLETE").length || 0;
  const completedMvps = sessions?.filter((session) => session.status === "COMPLETE").length || 0;
  const recentSessions = sessions?.slice(0, 5) || [];
  const tier = me?.subscriber?.tier || "EXPLORER";

  const apiTone = health?.status === "ok" ? "good" : health?.status === undefined ? "warn" : "bad";
  const dbTone = health?.db === "ok" ? "good" : health?.db === undefined ? "warn" : "bad";
  const inferenceTone = health?.engines === "ok" ? "good" : health?.engines === "degraded" ? "warn" : health?.engines === undefined ? "warn" : "bad";

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
            <div className="flex items-center gap-3 text-muted-foreground">
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
                <p className="font-mono text-lg font-bold text-primary">{isLoadingSessions ? "—" : activeSessions}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-border/50 sm:border-l sm:pl-4">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Completed MVPs</p>
                <p className="font-mono text-lg font-bold text-secondary">{isLoadingSessions ? "—" : completedMvps}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-border/50 lg:border-l lg:pl-4">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Month usage</p>
                <p className="font-mono text-lg font-bold">{isLoadingUsage ? "—" : `${(usageReport?.month?.totalTokens ?? 0).toLocaleString()} tok`}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-border/50 sm:border-l sm:pl-4 lg:border-l-0 lg:pl-0">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">System</p>
                <p className="font-mono text-lg font-bold uppercase">{health?.status || "—"}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <Card className="bg-card">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-display text-xl tracking-wider">RECENT BUILDS</p>
                    <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">Your latest harness sessions</p>
                  </div>
                  <Link href="/sessions" className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">View all</Link>
                </div>
                {isLoadingSessions ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
                  </div>
                ) : recentSessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center font-mono text-xs text-muted-foreground">
                    No sessions yet. Press BUILD SOMETHING to begin.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {recentSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <Link href={`/session/${session.id}`} className="block truncate text-sm font-medium hover:text-primary">{session.sessionName}</Link>
                          <span className="font-mono text-[10px] text-muted-foreground">{format(new Date(session.updatedAt), "yyyy-MM-dd HH:mm")}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold ${session.status === "COMPLETE" ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                            {session.status}
                          </span>
                          <Link href={`/session/${session.id}`} className="font-mono text-[10px] font-bold text-primary hover:underline">ENTER</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-5">
                <div className="mb-4">
                  <p className="font-display text-xl tracking-wider">SYSTEM</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">Core services</p>
                </div>
                {isLoadingHealth ? (
                  <div className="space-y-4"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></div>
                ) : (
                  <div className="space-y-4">
                    <HealthChip label="API" value={health?.status} tone={apiTone} />
                    <HealthChip label="Data" value={health?.db} tone={dbTone} />
                    <HealthChip label="Inference" value={health?.engines} tone={inferenceTone} />
                    {usageReport?.month && (
                      <div className="border-t border-border/50 pt-4">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="text-muted-foreground">MONTH COST</span>
                          <span className="font-bold">${usageReport.month.totalCostUsd.toFixed(2)}</span>
                        </div>
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