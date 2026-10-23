import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSaveCohortFollowup, type CohortFollowup, type CohortFollowupInput, type ConvenerDashboard, type LearningLesson } from "@workspace/api-client-react";
import { CheckCircle2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiErr, invalidateLearning } from "@/components/learning/learning-model";
import { fmtWhen, isoToLocal, lab, localToIso } from "./convener-model";

const schema = z.object({
  membershipId: z.string().min(1, "Choose a trainee"),
  title: z.string().trim().min(3, "3+ characters").max(160),
  feedback: z.string().trim().min(3, "3+ characters").max(4000),
  actionPlan: z.string().trim().min(3, "3+ characters").max(4000),
  state: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]),
  lessonKey: z.string(),
  dueAt: z.string(),
});
type Values = z.infer<typeof schema>;
export type FollowupDraft = Partial<Values> & { id?: string };

const STATE_LABEL: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", COMPLETED: "Completed" };
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function toValues(d: FollowupDraft): Values {
  return { membershipId: d.membershipId ?? "", title: d.title ?? "", feedback: d.feedback ?? "", actionPlan: d.actionPlan ?? "", state: d.state ?? "OPEN", lessonKey: d.lessonKey ?? "", dueAt: d.dueAt ?? "" };
}

export function followupToDraft(f: CohortFollowup): FollowupDraft {
  return { id: f.id, membershipId: f.membershipId, title: f.title, feedback: f.feedback, actionPlan: f.actionPlan, state: f.state, lessonKey: f.lessonKey ?? "", dueAt: isoToLocal(f.dueAt) };
}

function FollowupForm({ cohortId, dash, lessons, draft, onDone }: { cohortId: string; dash: ConvenerDashboard; lessons: LearningLesson[]; draft: FollowupDraft; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useSaveCohortFollowup();
  const [err, setErr] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(draft) });
  const learners = dash.learners.filter((l) => l.state === "ACTIVE" || l.membershipId === draft.membershipId);

  const submit = (v: Values) => {
    setErr(null);
    const data: CohortFollowupInput = {
      ...(draft.id ? { id: draft.id } : {}),
      membershipId: v.membershipId, title: v.title.trim(), feedback: v.feedback.trim(), actionPlan: v.actionPlan.trim(), state: v.state,
      lessonKey: v.lessonKey || null,
      dueAt: localToIso(v.dueAt),
    };
    save.mutate({ id: cohortId, data }, {
      onSuccess: () => onDone(),
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="border border-primary/40 rounded-md p-4 bg-card space-y-3" aria-busy={save.isPending} data-testid="form-followup">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl flex-1">{draft.id ? "Edit follow-up" : "New follow-up"}</h3>
          <Button type="button" size="icon" variant="ghost" onClick={onDone} aria-label="Close" data-testid="button-close-followup"><X className="h-4 w-4" /></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField control={form.control} name="membershipId" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Trainee</FormLabel><FormControl>
              <select {...field} disabled={!!draft.id} className={sel} data-testid="select-followup-member">
                <option value="">Choose…</option>
                {learners.map((l) => <option key={l.membershipId} value={l.membershipId}>{l.name}</option>)}
              </select>
            </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="lessonKey" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Lesson (optional)</FormLabel><FormControl>
              <select {...field} className={sel} data-testid="select-followup-lesson">
                <option value="">Not tied to a lesson</option>
                {lessons.map((l) => <option key={l.key} value={l.key}>{l.title}</option>)}
              </select>
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel className={lab}>Title</FormLabel><FormControl><Input {...field} maxLength={160} data-testid="input-followup-title" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid gap-3 md:grid-cols-2">
          <FormField control={form.control} name="feedback" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Feedback</FormLabel><FormControl><Textarea {...field} rows={5} maxLength={4000} data-testid="input-followup-feedback" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="actionPlan" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Action plan</FormLabel><FormControl><Textarea {...field} rows={5} maxLength={4000} data-testid="input-followup-plan" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField control={form.control} name="dueAt" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Due (optional)</FormLabel>
              <div className="flex gap-1.5"><FormControl><Input type="datetime-local" {...field} data-testid="input-followup-due" /></FormControl>
                {field.value && <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange("")} data-testid="button-clear-due">Clear</Button>}
              </div><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="state" render={({ field }) => (
            <FormItem><FormLabel className={lab}>State</FormLabel><FormControl>
              <select {...field} className={sel} data-testid="select-followup-state">
                {Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-muted-foreground flex-1">Visible to this trainee only, on their training page. No email is sent.</p>
          <Button type="submit" disabled={save.isPending} data-testid="button-save-followup">{save.isPending ? "Saving…" : "Save follow-up"}</Button>
        </div>
        {err && <p role="alert" className="text-xs text-destructive" data-testid="text-followup-error">{err}</p>}
      </form>
    </Form>
  );
}

export function FollowupsPanel({ cohortId, dash, lessons, seed, onSeedUsed, readOnly }: { cohortId: string; dash: ConvenerDashboard; lessons: LearningLesson[]; seed: FollowupDraft | null; onSeedUsed: () => void; readOnly?: boolean }) {
  const qc = useQueryClient();
  const complete = useSaveCohortFollowup();
  const [draft, setDraft] = useState<FollowupDraft | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (seed) { setDraft(seed); setFormKey((k) => k + 1); onSeedUsed(); } }, [seed, onSeedUsed]);

  const names = new Map(dash.learners.map((l) => [l.membershipId, l.name]));
  const lessonTitle = new Map(lessons.map((l) => [l.key, l.title]));
  const list = dash.followups.filter((f) => filter === "all" || f.state !== "COMPLETED");
  const open = (d: FollowupDraft) => { setDraft(d); setFormKey((k) => k + 1); };

  const markComplete = (f: CohortFollowup) => {
    setErr(null);
    complete.mutate({ id: cohortId, data: { id: f.id, membershipId: f.membershipId, title: f.title, feedback: f.feedback, actionPlan: f.actionPlan, state: "COMPLETED", lessonKey: f.lessonKey ?? null, dueAt: f.dueAt ?? null } }, {
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  return (
    <div className="space-y-4" data-testid="panel-followups">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex border rounded-md p-0.5 text-xs">
          {(["open", "all"] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} data-testid={`filter-followups-${f}`}>{f === "open" ? "Open" : "All"}</button>)}
        </div>
        <Button size="sm" className="ml-auto" onClick={() => open({})} disabled={readOnly || dash.learners.every((l) => l.state !== "ACTIVE")} data-testid="button-new-followup"><Plus className="h-3.5 w-3.5 mr-1" /> New follow-up</Button>
      </div>
      {draft && !readOnly && <FollowupForm key={formKey} cohortId={cohortId} dash={dash} lessons={lessons} draft={draft} onDone={() => setDraft(null)} />}
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      {list.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center" data-testid="state-no-followups">
          <p className="font-display text-xl">{filter === "open" ? "Nothing open." : "No follow-ups yet."}</p>
          <p className="text-xs text-muted-foreground mt-1">Start from a suggestion on the Performance tab, or write one from scratch.</p>
        </div>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2" data-testid="list-followups">
          {list.map((f) => {
            const overdue = f.dueAt && f.state !== "COMPLETED" && new Date(f.dueAt).getTime() < Date.now();
            return (
              <li key={f.id} className={`border rounded-md bg-card p-3 space-y-2 ${f.state === "COMPLETED" ? "opacity-70" : ""}`} data-testid={`card-followup-${f.id}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{f.title}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{names.get(f.membershipId) ?? "Former trainee"}{f.lessonKey ? ` · ${lessonTitle.get(f.lessonKey) ?? f.lessonKey}` : ""}</div>
                  </div>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${f.state === "COMPLETED" ? "border-primary/50 text-primary" : f.state === "IN_PROGRESS" ? "border-secondary bg-secondary/20" : ""}`}>{STATE_LABEL[f.state]}</span>
                </div>
                <p className="text-xs whitespace-pre-wrap line-clamp-3">{f.feedback}</p>
                <p className="text-xs whitespace-pre-wrap line-clamp-3 text-muted-foreground"><span className={lab}>Plan · </span>{f.actionPlan}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-mono text-[10px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{f.dueAt ? `${overdue ? "overdue · " : "due "}${fmtWhen(f.dueAt)}` : "no due date"}</span>
                  <span className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-7" disabled={readOnly} onClick={() => open(followupToDraft(f))} data-testid={`button-edit-followup-${f.id}`}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  {f.state !== "COMPLETED" && <Button size="sm" variant="outline" className="h-7" disabled={readOnly || complete.isPending} onClick={() => markComplete(f)} data-testid={`button-complete-followup-${f.id}`}><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
