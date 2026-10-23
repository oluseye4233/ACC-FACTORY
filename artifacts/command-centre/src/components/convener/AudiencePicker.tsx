import type { CohortLearner } from "@workspace/api-client-react";
import { lab } from "./convener-model";

/** [] means every active trainee; the server resolves the list at save/send time. */
export function AudiencePicker({ learners, value, onChange, disabled, testId }: { learners: CohortLearner[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean; testId: string }) {
  const active = learners.filter((l) => l.state === "ACTIVE");
  const all = value.length === 0;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset className="space-y-1.5" disabled={disabled} data-testid={testId}>
      <legend className={lab}>Audience</legend>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange([])} className={`px-2 py-1 rounded border text-xs ${all ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`} data-testid={`${testId}-all`}>All active trainees ({active.length})</button>
        {active.map((l) => {
          const on = value.includes(l.membershipId);
          return <button key={l.membershipId} type="button" aria-pressed={on} onClick={() => toggle(l.membershipId)} className={`px-2 py-1 rounded border text-xs ${on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:border-primary/50"}`} data-testid={`${testId}-member-${l.membershipId}`}>{l.name}</button>;
        })}
      </div>
      {active.length === 0 && <p className="text-[11px] text-muted-foreground">No active trainees in this cohort.</p>}
    </fieldset>
  );
}
