import { Link } from "wouter";
import { useGetLearningHome } from "@workspace/api-client-react";
import { ArrowRight, ShieldOff, Users } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { CreateCohortForm } from "@/components/learning/CreateCohortForm";
import { apiErr, usd } from "@/components/learning/learning-model";
import { lab } from "@/components/convener/convener-model";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10 space-y-8">{children}</main>
    </div>
  );
}

const STATE_CLS: Record<string, string> = { ACTIVE: "text-primary border-primary/50 bg-primary/10", DRAFT: "border-secondary bg-secondary/20", SUSPENDED: "text-destructive border-destructive/50" };

export default function ConvenerPage() {
  const q = useGetLearningHome();
  const home = q.data;
  if (q.isLoading) return <Shell><div className="space-y-3" data-testid="state-loading">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-md bg-muted/50 animate-pulse" />)}</div></Shell>;
  if (q.isError || !home) return <Shell><div className="border border-destructive/50 rounded-md p-4 space-y-2" data-testid="state-error"><p className="text-sm text-destructive">{apiErr(q.error).message}</p><Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry">Retry</Button></div></Shell>;

  const teaching = home.memberships.filter((m) => m.role === "INSTRUCTOR" && m.state === "ACTIVE");
  const cohorts = home.cohorts.filter((c) => home.canCreateCohort || teaching.some((m) => m.cohortId === c.id));
  const allowed = home.canCreateCohort || teaching.length > 0;

  return (
    <Shell>
      <header className="space-y-2">
        <div className={`${lab} flex items-center gap-2`}><Users className="h-3.5 w-3.5 text-primary" /> FORGE Field Engineer · Convener</div>
        <h1 className="font-display text-4xl sm:text-6xl leading-[0.95]">Run the room.</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">Progress, follow-ups, meetings, a shared library and cohort email for the cohorts you convene. Invite-only and free; Quest credentials stay independent of anything you do here.</p>
      </header>

      {!allowed ? (
        <div className="border rounded-md p-8 text-center space-y-3 bg-card" data-testid="state-access-denied">
          <ShieldOff className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-display text-2xl">No convener access.</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">This workspace is for cohort owners and assigned instructors. If you were invited to teach, redeem that invitation on the training page first.</p>
          <Button asChild variant="outline"><Link href="/learn" data-testid="link-back-learn">Go to training</Link></Button>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-2">
            <div className={lab}>Your cohorts ({cohorts.length})</div>
            {cohorts.length === 0 ? (
              <div className="border border-dashed rounded-md p-8 text-center" data-testid="state-no-cohorts"><p className="font-display text-xl">No cohorts yet.</p><p className="text-xs text-muted-foreground mt-1">{home.canCreateCohort ? "Create a draft to start." : "An owner has not assigned you to an active cohort."}</p></div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2" data-testid="list-convener-cohorts">
                {cohorts.map((c) => {
                  const pct = c.budgetUsd > 0 ? Math.min(100, (c.spentUsd / c.budgetUsd) * 100) : 0;
                  return (
                    <li key={c.id}>
                      <Link href={`/teach/cohorts/${c.id}`} className="group block border rounded-md p-4 bg-card hover:border-primary transition-colors h-full" data-testid={`link-convene-${c.id}`}>
                        <div className="flex items-start gap-2"><span className="font-display text-xl leading-tight flex-1">{c.title}</span><span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${STATE_CLS[c.state] ?? ""}`}>{c.state}</span></div>
                        <div className="font-mono text-[10px] text-muted-foreground mt-2">cap {c.capacity} · ends {new Date(c.endsAt).toLocaleDateString()} · {teaching.some((m) => m.cohortId === c.id) ? "instructor" : "owner/admin"}</div>
                        <div className="h-1 rounded-full bg-muted mt-3 overflow-hidden"><div className="h-full bg-secondary origin-left" style={{ transform: `scaleX(${pct / 100})` }} /></div>
                        <div className="flex items-center font-mono text-[10px] text-muted-foreground mt-1"><span className="flex-1">{usd(c.spentUsd)} of {usd(c.budgetUsd)}</span><span className="text-primary inline-flex items-center gap-1">Convene <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span></div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {home.canCreateCohort && <CreateCohortForm />}
        </section>
      )}
    </Shell>
  );
}
