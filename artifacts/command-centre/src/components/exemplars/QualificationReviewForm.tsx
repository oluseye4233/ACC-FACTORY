import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReviewExemplarQualification } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEMVER_RE, errorMessage, toInt, type CatalogItem } from "@/lib/catalog";
import { invalidateCatalog } from "./invalidate";

type Decision = "APPROVED" | "REJECTED";

export function validateReview(v: {
  decision: Decision;
  notes: string;
  jcse: string;
  tokenCount: string;
  version: string;
  documentation: string;
  tests: string;
  rightsCleared: boolean;
  safetyReviewed: boolean;
}): Record<string, string> {
  const e: Record<string, string> = {};
  const jcse = toInt(v.jcse);
  const tokens = toInt(v.tokenCount);
  const len = (s: string) => s.trim().length;
  if (len(v.notes) < 10 || len(v.notes) > 2000) e.notes = "Notes must be 10 to 2000 characters.";
  if (len(v.documentation) < 5 || len(v.documentation) > 2000) e.documentation = "Documentation evidence must be 5 to 2000 characters.";
  if (len(v.tests) < 5 || len(v.tests) > 2000) e.tests = "Test evidence must be 5 to 2000 characters.";
  if (!Number.isInteger(jcse) || jcse < 0 || jcse > 50) e.jcse = "JCSE must be a whole number 0 to 50.";
  else if (v.decision === "APPROVED" && jcse < 35) e.jcse = "Approval requires JCSE of at least 35/50.";
  if (!Number.isInteger(tokens) || tokens < 1) e.tokenCount = "Token count must be a positive whole number.";
  else if (v.decision === "APPROVED" && tokens > 100000) e.tokenCount = "Approval requires 100,000 tokens or fewer.";
  if (!SEMVER_RE.test(v.version.trim())) e.version = "Use a semantic version, e.g. 1.0.0.";
  if (v.decision === "APPROVED" && !v.rightsCleared) e.rightsCleared = "Approval requires rights clearance.";
  if (v.decision === "APPROVED" && !v.safetyReviewed) e.safetyReviewed = "Approval requires safety review.";
  return e;
}

const field = "w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring";

export function QualificationReviewForm({ item }: { item: CatalogItem }) {
  const q = item.qualification;
  const qc = useQueryClient();
  const { toast } = useToast();
  const mutation = useReviewExemplarQualification();
  const [v, setV] = useState({
    decision: (q?.decision ?? "APPROVED") as Decision,
    notes: q?.notes ?? "",
    jcse: String(q?.jcse ?? item.jcse ?? ""),
    tokenCount: q?.tokenCount ? String(q.tokenCount) : "",
    version: q?.version ?? "",
    documentation: q?.documentation ?? "",
    tests: q?.tests ?? "",
    rightsCleared: false,
    safetyReviewed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  if (!item.canReview) return null;
  const f0 = item.kind === "F0_REPORT";

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    const errs = validateReview(v);
    if (f0 && v.decision === "APPROVED") errs.decision = "F0 advisory reports never qualify for Sphinx.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await mutation.mutateAsync({
        id: item.id,
        data: {
          decision: v.decision,
          notes: v.notes.trim(),
          jcse: toInt(v.jcse),
          tokenCount: toInt(v.tokenCount),
          version: v.version.trim(),
          documentation: v.documentation.trim(),
          tests: v.tests.trim(),
          rightsCleared: v.rightsCleared,
          safetyReviewed: v.safetyReviewed,
        },
      });
      await invalidateCatalog(qc, item.id);
      toast({ title: v.decision === "APPROVED" ? "Qualification approved" : "Qualification rejected; public entry removed" });
    } catch (e) {
      setServerError(errorMessage(e, "Review could not be saved."));
    }
  };

  const Err = ({ k }: { k: string }) =>
    errors[k] ? (
      <p className="font-mono text-[10px] text-destructive" data-testid={`error-review-${k}`}>
        {errors[k]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-dashed border-foreground/30 bg-muted/30 p-4" data-testid="form-review" noValidate>
      <div>
        <p className="font-display text-xl tracking-wide">Internal reviewer evidence</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Records what the reviewer asserts. It does not execute tests or independently certify them. Baseline: JCSE 35/50 or higher, 1 to 100,000 tokens, semantic version, documentation and basic-test evidence, rights clearance and safety review. Rejecting or revoking removes any public entry.
        </p>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Decision">
        {(["APPROVED", "REJECTED"] as Decision[]).map((d) => (
          <button
            type="button"
            key={d}
            role="radio"
            aria-checked={v.decision === d}
            onClick={() => set("decision", d)}
            data-testid={`radio-decision-${d}`}
            className={`rounded-sm border px-3 py-1 font-mono text-xs ${v.decision === d ? (d === "APPROVED" ? "border-primary bg-primary text-primary-foreground" : "border-destructive bg-destructive text-destructive-foreground") : "hover:bg-muted"}`}
          >
            {d === "APPROVED" ? "Approve" : q?.decision === "APPROVED" ? "Revoke / reject" : "Reject"}
          </button>
        ))}
      </div>
      <Err k="decision" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase">JCSE (0-50)</span>
          <input inputMode="numeric" className={field} value={v.jcse} onChange={(e) => set("jcse", e.target.value)} data-testid="input-review-jcse" />
          <Err k="jcse" />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase">Token count</span>
          <input inputMode="numeric" className={field} value={v.tokenCount} onChange={(e) => set("tokenCount", e.target.value)} data-testid="input-review-tokens" />
          <Err k="tokenCount" />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase">Version (semver)</span>
          <input className={field} value={v.version} placeholder="1.0.0" onChange={(e) => set("version", e.target.value)} data-testid="input-review-version" />
          <Err k="version" />
        </label>
      </div>
      {(
        [
          ["documentation", "Documentation evidence", 2],
          ["tests", "Basic test evidence", 2],
          ["notes", "Reviewer notes", 3],
        ] as const
      ).map(([k, l, rows]) => (
        <label key={k} className="block space-y-1">
          <span className="flex justify-between font-mono text-[10px] uppercase">
            {l}
            <span className="text-muted-foreground">{v[k].length}/2000</span>
          </span>
          <textarea rows={rows} maxLength={2000} className={field} value={v[k]} onChange={(e) => set(k, e.target.value)} data-testid={`input-review-${k}`} />
          <Err k={k} />
        </label>
      ))}
      <div className="flex flex-wrap gap-4">
        {(
          [
            ["rightsCleared", "Rights cleared"],
            ["safetyReviewed", "Safety reviewed"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" checked={v[k]} onChange={(e) => set(k, e.target.checked)} data-testid={`checkbox-review-${k}`} className="accent-[hsl(144_61%_26%)]" />
            {l}
            <Err k={k} />
          </label>
        ))}
      </div>
      {serverError && (
        <p role="alert" className="font-mono text-xs text-destructive" data-testid="error-review-server">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending} className="font-display tracking-wider" data-testid="button-submit-review">
        {mutation.isPending ? "Saving..." : "Record review"}
      </Button>
    </form>
  );
}
