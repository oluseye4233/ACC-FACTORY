import { useState } from "react";
import { useGetTraineeSupport, getGetTraineeSupportQueryKey, type CohortResource, type LearningLesson } from "@workspace/api-client-react";
import { BookOpen, CalendarPlus, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErr } from "@/components/learning/learning-model";
import { ResourceReader, downloadResource } from "./ResourceReader";
import { STALE, downloadIcs, fmtWhen, lab } from "./convener-model";

const STATE_LABEL: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

/** Read-only view of the signed-in trainee's own follow-ups, addressed meetings and cohort library. */
export function TraineeSupport({ membershipId, cohortTitle, lessons }: { membershipId: string; cohortTitle?: string; lessons: LearningLesson[] }) {
  const q = useGetTraineeSupport(membershipId, { query: { queryKey: getGetTraineeSupportQueryKey(membershipId), enabled: !!membershipId, staleTime: STALE, refetchInterval: STALE, retry: 1, refetchOnWindowFocus: false } });
  const [reading, setReading] = useState<CohortResource | null>(null);
  const lessonTitle = new Map(lessons.map((l) => [l.key, l.title]));

  if (q.isLoading) return <div className="grid gap-3 md:grid-cols-3" data-testid="state-support-loading">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-md bg-muted/50 animate-pulse" />)}</div>;
  if (q.isError || !q.data) return (
    <div className="border border-destructive/50 rounded-md p-3 flex items-center gap-2" data-testid="state-support-error">
      <p className="text-xs text-destructive flex-1">Convener support could not load: {apiErr(q.error).message}</p>
      <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-support">Retry</Button>
    </div>
  );
  const { followups, meetings, resources } = q.data;
  const now = Date.now();
  const openF = followups.filter((f) => f.state !== "COMPLETED");
  const doneF = followups.filter((f) => f.state === "COMPLETED");
  const nextMeetings = [...meetings].filter((m) => new Date(m.endsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const lib = resources.filter((r) => r.state !== "ARCHIVED");

  return (
    <section className="space-y-3" data-testid="section-trainee-support">
      <div className="flex items-baseline gap-3"><h2 className="font-display text-2xl">From your convener</h2><span className={lab}>read-only</span></div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="border rounded-md bg-card p-3 space-y-2" data-testid="panel-support-followups">
          <div className={lab}>Follow-ups · {openF.length} open</div>
          {followups.length === 0 ? <p className="text-xs text-muted-foreground">No follow-ups yet.</p> : (
            <ul className="space-y-2">
              {[...openF, ...doneF].slice(0, 8).map((f) => (
                <li key={f.id} className={`border-l-2 pl-2 space-y-1 ${f.state === "COMPLETED" ? "border-muted opacity-70" : "border-primary"}`} data-testid={`support-followup-${f.id}`}>
                  <div className="flex gap-2 text-sm"><span className="flex-1 font-medium">{f.title}</span><span className="font-mono text-[10px]">{STATE_LABEL[f.state]}</span></div>
                  {f.lessonKey && <div className="font-mono text-[10px] text-muted-foreground">{lessonTitle.get(f.lessonKey) ?? f.lessonKey}</div>}
                  <p className="text-xs whitespace-pre-wrap">{f.feedback}</p>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground"><span className={lab}>Plan · </span>{f.actionPlan}</p>
                  {f.dueAt && <p className={`font-mono text-[10px] ${f.state !== "COMPLETED" && new Date(f.dueAt).getTime() < now ? "text-destructive" : "text-muted-foreground"}`}>due {fmtWhen(f.dueAt)}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border rounded-md bg-card p-3 space-y-2" data-testid="panel-support-meetings">
          <div className={lab}>Meetings · {nextMeetings.length} upcoming</div>
          {nextMeetings.length === 0 ? <p className="text-xs text-muted-foreground">Nothing scheduled for you.</p> : (
            <ul className="space-y-2">
              {nextMeetings.map((m) => (
                <li key={m.id} className={`space-y-1 ${m.state === "CANCELLED" ? "opacity-60" : ""}`} data-testid={`support-meeting-${m.id}`}>
                  <div className="text-sm font-medium"><span className={m.state === "CANCELLED" ? "line-through" : ""}>{m.title}</span>{m.state === "CANCELLED" && <span className="ml-2 font-mono text-[10px] text-destructive">CANCELLED</span>}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{fmtWhen(m.startsAt)}</div>
                  {m.agenda && <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{m.agenda}</p>}
                  <div className="flex gap-1">
                    {m.meetingUrl && m.state !== "CANCELLED" && <Button asChild size="sm" variant="ghost" className="h-7 px-2"><a href={m.meetingUrl} target="_blank" rel="noreferrer noopener" data-testid={`link-support-meeting-${m.id}`}><ExternalLink className="h-3 w-3 mr-1" /> Join</a></Button>}
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => downloadIcs(m, cohortTitle)} data-testid={`button-support-ics-${m.id}`}><CalendarPlus className="h-3 w-3 mr-1" /> Add to calendar</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border rounded-md bg-card p-3 space-y-2" data-testid="panel-support-library">
          <div className={lab}>Cohort library · {lib.length}</div>
          {lib.length === 0 ? <p className="text-xs text-muted-foreground">Your convener has not shared anything yet.</p> : (
            <ul className="divide-y">
              {lib.map((r) => (
                <li key={r.id} className="py-1.5 flex items-center gap-1" data-testid={`support-resource-${r.id}`}>
                  <div className="flex-1 min-w-0"><div className="text-sm truncate">{r.title}</div><div className="font-mono text-[10px] text-muted-foreground">{r.kind}{r.lessonKey ? ` · ${lessonTitle.get(r.lessonKey) ?? r.lessonKey}` : ""}</div></div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setReading(r)} aria-label={`Read ${r.title}`} data-testid={`button-support-read-${r.id}`}><BookOpen className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadResource(r)} aria-label={`Download ${r.title}`} data-testid={`button-support-download-${r.id}`}><Download className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ResourceReader resource={reading} onClose={() => setReading(null)} />
    </section>
  );
}
