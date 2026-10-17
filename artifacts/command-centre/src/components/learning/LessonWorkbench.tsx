import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListArtifacts,
  useSaveLearningAttempt,
  type LearningAssignment,
  type LearningLesson,
  type LearningMembership,
} from "@workspace/api-client-react";
import { ExternalLink, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  MAX_SUBMIT_CHARS,
  MODE_COPY,
  apiErr,
  fmtDate,
  invalidateLearning,
  lessonMode,
  parseArtifactIds,
  startPayload,
  submitError,
  submitPayload,
} from "./learning-model";

const lab = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";

export function ModeTag({ mode }: { mode: string }) {
  const m = lessonMode(mode);
  const tone =
    m === "ACTUAL_PLATFORM" ? "border-primary/60 text-primary bg-primary/10"
    : m === "SIMULATION" ? "border-secondary/60 text-secondary bg-secondary/10"
    : "border-border text-foreground/80 bg-muted/50";
  return <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${tone}`} data-testid={`status-mode-${m}`}>{MODE_COPY[m].short}</span>;
}

export function ArtifactPicker({ value, onChange, artifactType }: { value: string[]; onChange: (ids: string[]) => void; artifactType: string | null }) {
  const list = useListArtifacts({ query: { retry: false } as never });
  const [manual, setManual] = useState("");
  const own = (list.data ?? []).filter((a) => !artifactType || String(a.artifactType) === artifactType);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="space-y-2" data-testid="picker-artifacts">
      <div className={lab}>Your artifacts{artifactType ? ` · type ${artifactType}` : ""}</div>
      {list.isLoading && <div className="h-16 rounded bg-muted/50 animate-pulse" />}
      {list.data && own.length === 0 && (
        <p className="text-xs text-muted-foreground">No matching artifacts in your sessions yet. <Link href="/sessions" className="text-primary underline" data-testid="link-sessions">Open sessions</Link> and produce one first.</p>
      )}
      {own.length > 0 && (
        <ul className="max-h-48 overflow-auto border rounded divide-y">
          {own.map((a) => (
            <li key={a.id}>
              <label className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={value.includes(a.id)} onChange={() => toggle(a.id)} data-testid={`checkbox-artifact-${a.id}`} />
                <span className="font-mono text-[10px] bg-muted px-1 rounded">{String(a.artifactType)}</span>
                <span className="truncate flex-1">{a.name || "Untitled"}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{a.id.slice(0, 8)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {list.isError && <p className="text-xs text-muted-foreground">Artifact list unavailable for this account. Paste IDs from your <Link href="/sessions" className="text-primary underline">session pages</Link> instead.</p>}
      <div className="flex gap-2">
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or paste artifact UUIDs, comma-separated" className="font-mono text-xs" data-testid="input-artifact-ids" />
        <Button type="button" size="sm" variant="outline" disabled={!manual.trim()} onClick={() => { onChange(Array.from(new Set([...value, ...parseArtifactIds(manual)]))); setManual(""); }} data-testid="button-add-artifacts">Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => (
            <button key={id} type="button" onClick={() => toggle(id)} className="font-mono text-[10px] border rounded px-1.5 py-0.5 hover:border-destructive hover:text-destructive" data-testid={`chip-artifact-${id}`}>{id.slice(0, 13)} ×</button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Only IDs you own are accepted. The server rejects anything else; nothing is invented here.</p>
    </div>
  );
}

export function AttemptHistory({ a }: { a?: LearningAssignment }) {
  if (!a || a.submissions.length === 0) return <p className="text-xs text-muted-foreground" data-testid="text-no-history">No submissions yet.</p>;
  return (
    <ol className="space-y-2" data-testid="list-attempts">
      {[...a.submissions].reverse().map((s) => (
        <li key={s.id} className="border rounded p-2.5 bg-card" data-testid={`attempt-${s.id}`}>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="text-foreground font-bold">v{s.version}</span><ModeTag mode={s.mode} /><span>{fmtDate(s.createdAt)}</span>
            {s.sourceChanged && <span className="text-destructive border border-destructive/50 rounded px-1">SOURCE CHANGED</span>}
            {s.artifactIds.length > 0 && <span>{s.artifactIds.length} artifact(s)</span>}
          </div>
          <p className="text-xs whitespace-pre-wrap mt-1.5 line-clamp-6">{s.text}</p>
          {s.reviews.map((r) => (
            <div key={r.id} className={`mt-2 border-l-2 pl-2 text-xs ${r.decision === "LEARNING_COMPLETE" ? "border-primary" : "border-secondary"}`} data-testid={`review-${r.id}`}>
              <span className="font-mono text-[10px] font-bold">{r.decision === "LEARNING_COMPLETE" ? "LEARNING COMPLETE" : "REVISION REQUIRED"}</span>
              <span className="font-mono text-[10px] text-muted-foreground ml-2">{fmtDate(r.createdAt)}</span>
              <p className="whitespace-pre-wrap mt-0.5">{r.feedback}</p>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

export function LessonWorkbench({ lesson, membership, assignment, readOnly }: { lesson: LearningLesson; membership: LearningMembership; assignment?: LearningAssignment; readOnly?: boolean }) {
  const qc = useQueryClient();
  const save = useSaveLearningAttempt();
  const [text, setText] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const mode = lessonMode(lesson.mode);
  const started = !!assignment;
  const vErr = submitError(lesson, text, ids);
  const awaitingReview = assignment?.state === "SUBMITTED";

  const run = (body: Parameters<typeof save.mutate>[0]["data"], reset: boolean) => {
    setErr(null);
    save.mutate({ data: body }, {
      onSuccess: () => { if (reset) { setText(""); setIds([]); } },
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  return (
    <div className="space-y-5" data-testid={`workbench-${lesson.key}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{lesson.stage}</span><span>·</span><span>{lesson.track}</span><ModeTag mode={lesson.mode} />
          {lesson.required && <span className="text-primary">REQUIRED</span>}
          {assignment && <span className="ml-auto" data-testid="text-assignment-state">{assignment.state} · v{assignment.version}</span>}
        </div>
        <h2 className="font-display text-2xl leading-tight" data-testid="text-lesson-title">{lesson.title}</h2>
        <p className="text-sm text-muted-foreground">{lesson.purpose}</p>
        <p className="text-xs border-l-2 border-primary pl-2" data-testid="text-mode-explain">{MODE_COPY[mode].label}: {MODE_COPY[mode].explain}</p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 text-xs">
        {([["Input", lesson.input], ["Worked example", lesson.example], ["Expected", lesson.expected], ["Exercise", lesson.exercise]] as const).map(([k, v]) => (
          <div key={k} className="border rounded p-2.5 bg-muted/20"><dt className={lab}>{k}</dt><dd className="mt-1 whitespace-pre-wrap">{v}</dd></div>
        ))}
      </dl>
      <div>
        <div className={lab}>Rubric</div>
        <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">{lesson.rubric.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">
          <span>source {lesson.source}</span>
          {lesson.href && <Link href={lesson.href} className="text-primary underline inline-flex items-center gap-1" data-testid="link-lesson-href">Open in platform <ExternalLink className="h-3 w-3" /></Link>}
        </div>
      </div>

      {!readOnly && (
        <section className="border rounded-md p-3 space-y-3 bg-card" data-testid="panel-attempt">
          {!started ? (
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground flex-1">Starting opens an attempt record. You can submit once you have work to show.</p>
              <Button size="sm" disabled={save.isPending} onClick={() => run(startPayload(membership.id, lesson.key, assignment), false)} data-testid="button-start-lesson"><Play className="h-3.5 w-3.5 mr-1" /> Start lesson</Button>
            </div>
          ) : awaitingReview ? (
            <p className="text-xs text-muted-foreground" data-testid="text-awaiting-review">Submitted. Waiting for an instructor review.</p>
          ) : (
            <>
              <div className={lab}>Submit · {MODE_COPY[mode].label}</div>
              <Textarea rows={7} value={text} maxLength={MAX_SUBMIT_CHARS} onChange={(e) => setText(e.target.value)} placeholder={mode === "REFLECTION" ? "Your reasoning, in your own words" : mode === "SIMULATION" ? "Your simulated walkthrough" : "What you did and what the artifacts show"} data-testid="input-attempt-text" />
              {mode === "ACTUAL_PLATFORM" && <ArtifactPicker value={ids} onChange={setIds} artifactType={lesson.artifactType} />}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[10px] text-muted-foreground">{text.trim().length} chars</span>
                {(text || ids.length > 0) && vErr && <span className="text-destructive" data-testid="text-submit-error">{vErr}</span>}
                <Button size="sm" className="ml-auto" disabled={!!vErr || save.isPending || !assignment} onClick={() => assignment && run(submitPayload(membership.id, lesson, assignment, text, ids), true)} data-testid="button-submit-attempt"><Send className="h-3.5 w-3.5 mr-1" /> Submit v{(assignment?.version ?? 0)}</Button>
              </div>
            </>
          )}
          {err && <p role="alert" className="text-xs text-destructive" data-testid="text-attempt-error">{err}</p>}
        </section>
      )}

      <section><div className={`${lab} mb-2`}>Attempts &amp; feedback</div><AttemptHistory a={assignment} /></section>
      <p className="text-[11px] text-muted-foreground" data-testid="text-no-credential">Lesson review is learning feedback only. It never issues a badge, certificate or Quest credential.</p>
    </div>
  );
}
