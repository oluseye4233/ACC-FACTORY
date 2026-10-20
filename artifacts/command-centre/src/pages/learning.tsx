import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { getLearningPortfolio, useGetLearningCohort, useGetLearningHome, type LearningHome } from "@workspace/api-client-react";
import { ArrowLeft, Download, GraduationCap } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { QuestProgress } from "@/components/shared/QuestProgress";
import { LessonWorkbench, ModeTag } from "@/components/learning/LessonWorkbench";
import { RedeemPanel } from "@/components/learning/RedeemPanel";
import { CreateCohortForm } from "@/components/learning/CreateCohortForm";
import { ReviewQueue } from "@/components/learning/ReviewQueue";
import { CohortManager } from "@/components/learning/CohortManager";
import { QUEST_RULES, apiErr, downloadJson, findAssignment, isLessonDone, readInviteToken, requiredDone, trackMatches, usd } from "@/components/learning/learning-model";

const lab = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10 space-y-8">{children}</main>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3" data-testid="state-loading">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-md bg-muted/50 animate-pulse" />)}</div>;
}

function ErrorBox({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="border border-destructive/50 rounded-md p-4 space-y-2" data-testid="state-error">
      <p className="text-sm text-destructive">{apiErr(error).message}</p>
      <Button size="sm" variant="outline" onClick={retry} data-testid="button-retry">Retry</Button>
    </div>
  );
}

function Hero({ home }: { home: LearningHome }) {
  return (
    <header className="space-y-3">
      <div className={`${lab} flex items-center gap-2`}><GraduationCap className="h-3.5 w-3.5 text-primary" /> FORGE Field Engineer · {home.plan} · curriculum {home.curriculumVersion}</div>
      <h1 className="font-display text-3xl sm:text-5xl leading-[1.05] max-w-3xl">Learn the factory by working in it.</h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        An invite-only cohort. {home.price === 0 ? "Free." : `${usd(home.price)}.`} Every lesson is marked as actual platform work, a simulation, or a reflection, so you always know which one you are doing.
      </p>
    </header>
  );
}

function QuestNote() {
  return (
    <aside className="border rounded-md p-4 bg-muted/20 space-y-2" data-testid="panel-quest-rules">
      <div className={lab}>Credentials are separate</div>
      <p className="text-xs">Instructor reviews do not award or withhold badges. Your qualifying platform artifacts count normally under the existing Quest rules; viewing examples and completing simulations do not create them.</p>
      <ul className="text-xs space-y-1">
        {QUEST_RULES.map((q) => <li key={q.badge}><b className="font-mono">{q.badge}</b> · {q.rule} · <Link href={q.href} className="text-primary underline" data-testid={`link-quest-${q.badge}`}>{q.href.slice(1)}</Link></li>)}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild size="sm" progression><Link href="/quests" data-testid="button-open-quests">Open Quests</Link></Button>
        <Button asChild size="sm" variant="outline" progression><Link href="/guide" data-testid="link-guide">Platform guide</Link></Button>
      </div>
      <QuestProgress compact className="mt-2" />
    </aside>
  );
}

export default function LearningHomePage() {
  const q = useGetLearningHome();
  const home = q.data;
  const [memberId, setMemberId] = useState<string | null>(null);
  const [lessonKey, setLessonKey] = useState<string | null>(null);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const hasInvite = useMemo(() => !!readInviteToken(), []);

  const students = (home?.memberships ?? []).filter((m) => m.role === "STUDENT");
  const member = students.find((m) => m.id === memberId) ?? students[0];
  useEffect(() => {
    if (member) sessionStorage.setItem("ffe-membership", member.id);
    else sessionStorage.removeItem("ffe-membership");
  }, [member?.id]);
  // Every student can study every gate's example; assessment stays track-specific.
  const lessons = useMemo(() => (home && member ? home.lessons : []), [home, member]);
  const lesson = lessons.find((l) => l.key === lessonKey) ?? null;
  const teaching = (home?.memberships ?? []).filter((m) => m.role === "INSTRUCTOR");
  const ownedCohorts = (home?.cohorts ?? []).filter((c) => home?.canCreateCohort || teaching.some((m) => m.cohortId === c.id && m.state === "ACTIVE"));
  const currentCohort = home?.cohorts.find((c) => c.id === member?.cohortId);
  const learningOpen = member?.state === "ACTIVE" && currentCohort?.state === "ACTIVE" && new Date(currentCohort.endsAt).getTime() > Date.now();

  const portfolio = async (id: string) => {
    setDlErr(null);
    try { downloadJson(`ffe-portfolio-${id.slice(0, 8)}.json`, await getLearningPortfolio(id)); }
    catch (e) { setDlErr(apiErr(e).message); }
  };

  if (q.isLoading) return <Shell><Skeleton /></Shell>;
  if (q.isError || !home) return <Shell><ErrorBox error={q.error} retry={() => q.refetch()} /></Shell>;

  return (
    <Shell>
      <Hero home={home} />
      {(students.length === 0 || hasInvite) && <RedeemPanel terms={home.terms} compact={students.length > 0} />}

      {member && (
        <section className="grid gap-6 lg:grid-cols-[320px_1fr]" data-testid="section-student">
          <aside className="space-y-4">
            {students.length > 1 && (
              <label className="block space-y-1"><span className={lab}>Cohort</span>
                <select value={member.id} onChange={(e) => { setMemberId(e.target.value); setLessonKey(null); }} className="w-full h-9 rounded-md border bg-background px-2 text-sm" data-testid="select-membership">
                  {students.map((m) => <option key={m.id} value={m.id}>{home.cohorts.find((c) => c.id === m.cohortId)?.title ?? m.cohortId.slice(0, 8)}</option>)}
                </select>
              </label>
            )}
            <div className="border rounded-md p-3 bg-card space-y-1 text-xs" data-testid="card-membership">
              <div className="flex justify-between"><span className={lab}>{member.state}</span><span className={lab}>track {member.track}</span></div>
              <p className="text-muted-foreground">Cohort: {currentCohort?.state ?? "unavailable"} · Funded allowance: {usd(currentCohort?.studentBudgetUsd ?? 0)}</p>
              {!learningOpen && <p>New training work is paused. Your records, portfolio export and existing Quest eligibility remain available.</p>}
              {(() => { const p = requiredDone(home.lessons, home.assignments, member); return <div className="font-display text-2xl" data-testid="text-progress">{p.done}<span className="text-muted-foreground text-base"> / {p.total} required</span></div>; })()}
              {member.completedAt && <p className="text-primary">Course completed. This is a learning record, not a credential.</p>}
              <div className="flex gap-3 text-muted-foreground font-mono text-[10px]"><span>spent {usd(member.spentUsd)}</span><span>reserved {usd(member.reservedUsd)}</span></div>
              <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => portfolio(member.id)} data-testid="button-portfolio"><Download className="h-3 w-3 mr-1" /> Portfolio JSON</Button>
              {dlErr && <p className="text-destructive">{dlErr}</p>}
            </div>
            <ol className="border rounded-md divide-y bg-card max-h-[60vh] overflow-auto" data-testid="list-lessons">
              {lessons.map((l, i) => {
                const a = findAssignment(home.assignments, member.id, l.key);
                const done = isLessonDone(a);
                return (
                  <li key={l.key}>
                    <button type="button" onClick={() => setLessonKey(l.key)} className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-muted/40 ${lesson?.key === l.key ? "bg-primary/10" : ""}`} data-testid={`button-lesson-${l.key}`}>
                      <span className="font-mono text-[10px] text-muted-foreground w-5">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 min-w-0 truncate">{l.title}</span>
                      <ModeTag mode={l.mode} />
                      <span className={`h-2 w-2 rounded-full ${done ? "bg-primary" : a ? "bg-secondary" : "bg-muted"}`} aria-label={done ? "complete" : a ? a.state : "not started"} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
          <div className="min-w-0">
            {lesson && !trackMatches(lesson.track, member.track) && <p className="mb-3 rounded border p-3 text-sm">Worked-example reference for the {lesson.track.toLowerCase()} track. You can study this gate; it is not an assessed exercise on your current track.</p>}
            {lesson ? (
              <LessonWorkbench key={`${member.id}-${lesson.key}`} lesson={lesson} membership={member} assignment={findAssignment(home.assignments, member.id, lesson.key)} readOnly={!learningOpen || !trackMatches(lesson.track, member.track)} />
            ) : (
              <div className="border border-dashed rounded-md p-8 text-center space-y-2" data-testid="state-pick-lesson">
                <p className="font-display text-xl">Pick a lesson.</p>
                <p className="text-xs text-muted-foreground">{lessons.length} lessons on your track. Start anywhere; required ones count toward completion.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {(home.canCreateCohort || teaching.length > 0 || ownedCohorts.length > 0) && (
        <section className="space-y-4" data-testid="section-teach">
          <h2 className="font-display text-2xl">Teaching</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <ul className="space-y-2">
              {ownedCohorts.length === 0 && <li className="text-xs text-muted-foreground border border-dashed rounded p-4">No cohorts yet.</li>}
              {ownedCohorts.map((c) => (
                <li key={c.id}>
                  <Link href={`/teach/cohorts/${c.id}`} className="block border rounded-md p-3 bg-card hover:border-primary" data-testid={`link-cohort-${c.id}`}>
                    <div className="flex items-center gap-2"><span className="font-medium text-sm flex-1 truncate">{c.title}</span><span className="font-mono text-[10px]">{c.state}</span></div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1">cap {c.capacity} · {usd(c.spentUsd)} of {usd(c.budgetUsd)} · ends {new Date(c.endsAt).toLocaleDateString()}</div>
                  </Link>
                </li>
              ))}
            </ul>
            {home.canCreateCohort && <CreateCohortForm />}
          </div>
        </section>
      )}

      <QuestNote />
    </Shell>
  );
}

export function LearningCohortPage() {
  const { id = "" } = useParams<{ id: string }>();
  const q = useGetLearningCohort(id);
  const [tab, setTab] = useState<"review" | "manage">("review");
  const d = q.data;
  const cohort = d?.cohorts.find((c) => c.id === id) ?? d?.cohorts[0];

  return (
    <Shell>
      <Link href="/learn" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" data-testid="link-back-learn"><ArrowLeft className="h-3 w-3" /> Learning</Link>
      {q.isLoading ? <Skeleton /> : q.isError || !d ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
        <>
          <header className="space-y-2">
            <div className={lab}>{d.isOwner ? "Owner" : "Instructor"} · curriculum {cohort?.curriculumVersion ?? d.curriculumVersion}</div>
            <h1 className="font-display text-3xl sm:text-4xl" data-testid="text-cohort-title">{cohort?.title ?? "Cohort"}</h1>
            {cohort && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground font-bold" data-testid="text-cohort-state">{cohort.state}</span>
                <span>capacity {cohort.capacity}</span><span>budget {usd(cohort.budgetUsd)}</span><span>per student {usd(cohort.studentBudgetUsd)}</span>
                <span>spent {usd(cohort.spentUsd)}</span><span>reserved {usd(cohort.reservedUsd)}</span><span>ends {new Date(cohort.endsAt).toLocaleString()}</span>
              </div>
            )}
          </header>
          <div className="flex gap-1 border-b">
            {(["review", "manage"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`} data-testid={`tab-${t}`}>{t === "review" ? "Review" : "People"}</button>
            ))}
          </div>
          {tab === "review" ? <ReviewQueue assignments={d.assignments} lessons={d.lessons} members={d.memberships} /> : <CohortManager cohortId={id} d={d} />}
        </>
      )}
    </Shell>
  );
}
