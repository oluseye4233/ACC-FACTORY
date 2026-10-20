import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBoomerangCasesQueryKey, useCreateBoomerangCase, type BoomerangInputStage, type BoomerangOriginKind } from "@workspace/api-client-react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiError, stageNote } from "./boomerang-model";

export function BoomerangCreateForm({ originKind, originId, stage, onCreated }: { originKind: BoomerangOriginKind; originId: string; stage: string; onCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const create = useCreateBoomerangCase();
  const ok = title.trim().length >= 3 && brief.trim().length >= 10 && !!originId && !!stage;
  const note = stageNote(stage);
  return (
    <form aria-label={`Request ${stage} supporting work`} aria-busy={create.isPending} className="space-y-2" data-testid="form-boomerang-create" onSubmit={(e) => {
      e.preventDefault();
      if (!ok) return;
      setErr(null);
      create.mutate({ data: { originKind, originId, stage: stage as BoomerangInputStage, title: title.trim(), brief: brief.trim() } }, {
        onSuccess: (c) => { setTitle(""); setBrief(""); onCreated?.(c.id); },
        onError: (x) => setErr(apiError(x).message),
        onSettled: () => { void qc.invalidateQueries({ queryKey: getListBoomerangCasesQueryKey() }); },
      });
    }}>
      {note && <p className="font-mono text-[10px] text-secondary" data-testid="text-stage-note">{note}</p>}
      <label htmlFor={`${fieldId}-title`} className="block font-mono text-xs">Request title (3–200 characters)</label>
      <Input id={`${fieldId}-title`} required minLength={3} placeholder="Request title (3–200)" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} data-testid="input-boomerang-title" />
      <label htmlFor={`${fieldId}-brief`} className="block font-mono text-xs">Supporting-work brief (10–8,000 characters)</label>
      <Textarea id={`${fieldId}-brief`} required minLength={10} rows={3} placeholder="Brief: what supporting work you need and what evidence comes back (10–8,000)" value={brief} maxLength={8000} onChange={(e) => setBrief(e.target.value)} data-testid="input-boomerang-brief" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">Server freezes the origin fingerprint at creation.</span>
        <Button type="submit" size="sm" className="ml-auto h-8" disabled={!ok || create.isPending} data-testid="button-boomerang-create"><Send className="h-3.5 w-3.5 mr-1" />{create.isPending ? "Requesting…" : `Request ${stage} support`}</Button>
      </div>
      {err && <p className="font-mono text-[11px] text-destructive" role="alert" data-testid="text-create-error">{err}</p>}
    </form>
  );
}
