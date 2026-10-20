import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateLearningCohort } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErr, invalidateLearning } from "./learning-model";

const lab = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";

export function CreateCohortForm() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const create = useCreateLearningCohort();
  const [f, setF] = useState({ title: "", capacity: "", budgetUsd: "", studentBudgetUsd: "", endsAt: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const cap = Number(f.capacity), b = Number(f.budgetUsd), sb = Number(f.studentBudgetUsd);
  const end = f.endsAt ? new Date(f.endsAt) : null;
  const invalid =
    f.title.trim().length < 3 ? "Title needs 3+ characters"
    : !f.capacity || !Number.isInteger(cap) || cap < 1 || cap > 500 ? "Capacity 1–500"
    : f.budgetUsd === "" || !(b >= 0 && b <= 100000) ? "Cohort budget $0–100,000"
    : f.studentBudgetUsd === "" || !(sb >= 0 && sb <= 1000) ? "Per-student budget $0–1,000"
    : !end || isNaN(end.getTime()) || end.getTime() <= Date.now() ? "End date must be in the future"
    : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid || !end) return;
    setErr(null);
    create.mutate({ data: { title: f.title.trim(), capacity: cap, budgetUsd: b, studentBudgetUsd: sb, endsAt: end.toISOString() } }, {
      onSuccess: (c) => nav(`/teach/cohorts/${c.id}`),
      onError: (x) => setErr(apiErr(x).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  return (
    <form onSubmit={submit} aria-label="Create cohort draft" aria-busy={create.isPending} aria-describedby={invalid ? "cohort-create-validation" : undefined} className="border rounded-md p-4 bg-card space-y-3" data-testid="form-create-cohort">
      <h3 className="font-display text-lg">New cohort draft</h3>
      <p className="text-xs text-muted-foreground">Created as DRAFT. Nothing is open to students until you activate it. All values are explicit; there are no defaults.</p>
      <label className="block space-y-1"><span className={lab}>Title</span><Input value={f.title} onChange={set("title")} maxLength={160} data-testid="input-cohort-title" /></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1"><span className={lab}>Capacity</span><Input type="number" min={1} max={500} value={f.capacity} onChange={set("capacity")} data-testid="input-cohort-capacity" /></label>
        <label className="block space-y-1"><span className={lab}>Ends</span><Input type="datetime-local" value={f.endsAt} onChange={set("endsAt")} data-testid="input-cohort-ends" /></label>
        <label className="block space-y-1"><span className={lab}>Cohort budget USD</span><Input type="number" min={0} step="0.01" value={f.budgetUsd} onChange={set("budgetUsd")} data-testid="input-cohort-budget" /></label>
        <label className="block space-y-1"><span className={lab}>Per student USD</span><Input type="number" min={0} step="0.01" value={f.studentBudgetUsd} onChange={set("studentBudgetUsd")} data-testid="input-cohort-student-budget" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {invalid && <span id="cohort-create-validation" className="text-xs text-muted-foreground" data-testid="text-create-invalid">{invalid}</span>}
        <Button type="submit" className="ml-auto" disabled={!!invalid || create.isPending} data-testid="button-create-cohort">Create draft</Button>
      </div>
      {err && <p role="alert" className="text-xs text-destructive" data-testid="text-create-error">{err}</p>}
    </form>
  );
}
