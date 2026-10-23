import { useMemo, useState } from "react";
import type { CohortLearner, ConvenerDashboard } from "@workspace/api-client-react";
import { ClipboardPen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lab } from "./convener-model";

function Stat({ k, v, sub, id }: { k: string; v: string | number; sub?: string; id: string }) {
  return (
    <div className="border rounded-md bg-card px-3 py-2.5" data-testid={`stat-${id}`}>
      <div className={lab}>{k}</div>
      <div className="font-display text-3xl leading-none mt-1">{v}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function PerformancePanel({ dash, onDraft, readOnly }: { dash: ConvenerDashboard; onDraft: (l: CohortLearner) => void; readOnly?: boolean }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"attention" | "progress" | "name">("attention");
  const learners = dash.learners;
  const active = learners.filter((l) => l.state === "ACTIVE");
  const avg = active.length ? Math.round(active.reduce((s, l) => s + l.progressPercent, 0) / active.length) : 0;
  const revisions = learners.reduce((s, l) => s + l.revisions, 0);
  const awaiting = learners.reduce((s, l) => s + Math.max(0, l.submitted - l.completed), 0);
  const openFollowups = dash.followups.filter((f) => f.state !== "COMPLETED").length;

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = learners.filter((l) => !t || l.name.toLowerCase().includes(t) || l.track.toLowerCase().includes(t));
    return [...r].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "progress" ? b.progressPercent - a.progressPercent
      : (b.revisions - a.revisions) || (a.progressPercent - b.progressPercent));
  }, [learners, q, sort]);

  return (
    <div className="space-y-5" data-testid="panel-performance">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat id="active" k="Active trainees" v={active.length} sub={`${learners.length} on roster`} />
        <Stat id="avg" k="Avg required progress" v={`${avg}%`} sub="active trainees only" />
        <Stat id="revisions" k="Revisions requested" v={revisions} sub={`${awaiting} submissions beyond completed`} />
        <Stat id="followups" k="Open follow-ups" v={openFollowups} sub={`${dash.followups.length} total`} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or track" className="pl-8" data-testid="input-filter-learners" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-md border bg-background px-2 text-sm" data-testid="select-sort-learners">
          <option value="attention">Needs attention first</option><option value="progress">Most progress</option><option value="name">Name</option>
        </select>
      </div>

      {learners.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center" data-testid="state-no-learners">
          <p className="font-display text-xl">No trainees yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Invite trainees from the People tab. Performance appears as soon as someone starts a lesson.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed rounded p-4">No trainee matches “{q}”.</p>
      ) : (
        <ul className="border rounded-md divide-y bg-card" data-testid="list-learners">
          {rows.map((l) => (
            <li key={l.membershipId} className="p-3 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start" data-testid={`row-learner-${l.membershipId}`}>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{l.name}</div>
                <div className="flex gap-2 font-mono text-[10px] text-muted-foreground mt-0.5"><span className={l.state === "ACTIVE" ? "text-primary" : ""}>{l.state}</span><span>track {l.track}</span></div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs"><span className="font-display text-xl">{l.progressPercent}%</span><span className="font-mono text-[10px] text-muted-foreground">{l.completed}/{l.required} req</span></div>
                <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden" role="progressbar" aria-valuenow={l.progressPercent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-primary origin-left transition-transform duration-500" style={{ transform: `scaleX(${Math.min(100, Math.max(0, l.progressPercent)) / 100})` }} />
                </div>
                <div className="flex gap-3 font-mono text-[10px] text-muted-foreground mt-1"><span>{l.submitted} submitted</span><span className={l.revisions ? "text-secondary-foreground bg-secondary/25 px-1 rounded" : ""}>{l.revisions} revisions</span></div>
              </div>
              <div className="text-xs space-y-1 min-w-0">
                <p data-testid={`text-recommendation-${l.membershipId}`}><span className={lab}>Suggested · </span>{l.recommendation || "No recommendation."}</p>
                {l.recentFeedback.length > 0 && (
                  <ul className="text-muted-foreground space-y-0.5 border-l-2 border-secondary/60 pl-2">
                    {l.recentFeedback.slice(0, 2).map((f, i) => <li key={i} className="line-clamp-2">{f}</li>)}
                  </ul>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => onDraft(l)} disabled={readOnly || l.state !== "ACTIVE"} title={l.state !== "ACTIVE" ? "Follow-ups are for active trainees" : "Opens a draft; nothing is sent or saved yet"} data-testid={`button-draft-followup-${l.membershipId}`}>
                <ClipboardPen className="h-3.5 w-3.5 mr-1" /> Draft follow-up
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Suggestions are prefills only. Nothing is saved, sent or shown to a trainee until you save a follow-up.</p>
    </div>
  );
}
