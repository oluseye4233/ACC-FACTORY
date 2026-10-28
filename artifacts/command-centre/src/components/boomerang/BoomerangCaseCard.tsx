import { useState } from "react";
import { RETURN_WITH_ARTIFACT_LABEL } from "./ReturnedUpgrade";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListBoomerangCasesQueryKey, useTransitionBoomerangCase, type BoomerangCase, type BoomerangTransitionInput } from "@workspace/api-client-react";
import { AlertTriangle, ChevronDown, ChevronRight, Download, ExternalLink, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RESULT_MAX, STAGE_ENGINE_ID, apiError, controlsFor, downloadCaseJson, fmtTime, returnError, shortHash } from "./boomerang-model";
import { F8BundleComparison } from "./F8BundleComparison";

const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";

export function BoomerangStateTag({ state }: { state: string }) {
  const tone =
    state === "RETURNED" ? "border-secondary/60 text-secondary bg-secondary/10"
    : state === "ACCEPTED" ? "border-primary/50 text-primary bg-primary/10"
    : state === "REJECTED" || state === "CANCELLED" ? "border-destructive/50 text-destructive bg-destructive/10"
    : "border-border text-foreground/80 bg-muted/40";
  return <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${tone}`} data-testid={`status-boomerang-${state}`}>{state}</span>;
}

export function BoomerangCaseCard({ c, defaultOpen = false }: { c: BoomerangCase; defaultOpen?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [runId, setRunId] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ctl = controlsFor(c);
  const tx = useTransitionBoomerangCase();
  const engineId = STAGE_ENGINE_ID[c.stage];
  const retErr = returnError(text, runId);

  const act = (data: Omit<BoomerangTransitionInput, "expectedVersion">) => {
    setErr(null);
    tx.mutate({ id: c.id, data: { ...data, expectedVersion: c.version } }, {
      onSuccess: () => { setText(""); setRunId(""); setNote(""); },
      onError: (e) => {
        const m = apiError(e);
        setErr(m.conflict ? `${m.message}. This request changed elsewhere; reloaded latest version.` : m.message);
      },
      onSettled: () => { void qc.invalidateQueries({ queryKey: getListBoomerangCasesQueryKey() }); },
    });
  };

  return (
    <article className="border rounded bg-card" data-testid={`card-boomerang-${c.id}`}>
      <button type="button" aria-expanded={open} className="w-full flex flex-wrap items-center gap-2 p-2.5 text-left hover:bg-muted/40" onClick={() => setOpen(!open)} data-testid={`button-toggle-case-${c.id}`}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-mono text-[10px] bg-muted px-1.5 rounded">{c.stage}{engineId != null ? ` · eng ${engineId}` : ""}</span>
        <span className="text-sm font-medium truncate min-w-0 flex-1" data-testid={`text-case-title-${c.id}`}>{c.title}</span>
        {c.sourceChanged && <span className="font-mono text-[10px] text-destructive border border-destructive/50 px-1 rounded" data-testid={`status-drift-${c.id}`}>SOURCE CHANGED</span>}
        <BoomerangStateTag state={c.state} />
        <span className="font-mono text-[10px] text-muted-foreground">v{c.version}</span>
      </button>
      {open && (
        <div className="border-t p-3 space-y-3 font-mono text-[11px]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>origin {c.originKind} · {c.originId.slice(0, 8)}</span>
            <span data-testid={`text-source-hash-${c.id}`}>source fingerprint {shortHash(c.sourceHash)}</span>
            <span>created {fmtTime(c.createdAt)}</span>
            <span>updated {fmtTime(c.updatedAt)}</span>
            {c.originAvailable ? <Link href={c.originHref} className="text-primary underline inline-flex items-center gap-1" data-testid={`link-origin-${c.id}`}>open origin <ExternalLink className="h-3 w-3" /></Link> : <span className="text-destructive">origin unavailable</span>}
          </div>
          <p className="text-[10px] border-l-2 border-secondary pl-2">Advisory only · release not allowed. Returned support never runs an engine, advances a stage, certifies or releases anything.</p>
          <div><div className={lab}>Brief</div><p className="whitespace-pre-wrap font-sans text-xs mt-1" data-testid={`text-brief-${c.id}`}>{c.brief}</p></div>
          {(c.resultText || c.spcPlayerRunId) && (
            <div className="border rounded p-2 bg-muted/30" data-testid={`panel-result-${c.id}`}>
              {c.returnedArtifactHref && <div className="mb-3">
                <Link href={c.returnedArtifactHref} className="inline-flex min-h-11 w-full items-center justify-center rounded bg-primary px-4 py-3 text-center font-mono text-[10px] font-bold text-primary-foreground hover:opacity-90" data-testid={`link-upgraded-${c.id}`}>
                  {RETURN_WITH_ARTIFACT_LABEL}
                </Link>
                <p className="mt-1 text-[11px] text-muted-foreground">{c.upgradeLabel || "Returned artifact"} · {c.stage}. Continue with review and applicable checks; this does not pass a gate.</p>
              </div>}
              <div className={lab}>Returned work · hash {shortHash(c.resultHash)}</div>
              {c.spcPlayerRunId && <div className="mt-1">SPC Player run <span className="break-all" data-testid={`text-run-id-${c.id}`}>{c.spcPlayerRunId}</span></div>}
              {c.resultText && <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-[10px]">{c.resultText}</pre>}
              {c.stage === "F8" && c.originKind === "SESSION" && c.resultText &&
                <F8BundleComparison resultText={c.resultText} sessionId={c.originId} />}
            </div>
          )}
          {ctl.driftBlocked && (
            <div className="flex gap-2 border border-destructive/40 bg-destructive/5 rounded p-2 text-destructive" data-testid={`text-drift-${c.id}`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>The origin changed since this request was frozen. Return and accept are disabled. Create a fresh request against the current source; this one is retained as-is for the record.</span>
            </div>
          )}
          {ctl.canReturn && (
            <div className="border rounded p-2 space-y-2" data-testid={`panel-return-${c.id}`}>
              <div className="flex items-center gap-2"><span className={lab}>Return supporting work (one source)</span>
                {c.originKind === "SESSION" && STAGE_ENGINE_ID[c.stage] != null ? (
                  <Link href={`/spc-player/new?sourceSessionId=${encodeURIComponent(c.originId)}&originFeatureId=${STAGE_ENGINE_ID[c.stage]}`} className="ml-auto inline-flex items-center gap-1 text-primary underline" data-testid={`link-spc-player-${c.id}`}><PlaySquare className="h-3 w-3" /> Open SPC Player with this project</Link>
                ) : (
                  <span className="text-muted-foreground">This origin has no mapped artifact-backed Player stage. Return supporting text here instead.</span>
                )}
              </div>
              <p className="text-muted-foreground">Nothing is launched from here. Execute in SPC Player yourself, then paste the completed run id — or paste returned text manually.</p>
              <Input aria-label="Completed SPC Player run UUID" placeholder="Completed SPC Player run UUID" value={runId} onChange={(e) => setRunId(e.target.value)} disabled={!!text.trim()} className="font-mono text-xs" data-testid={`input-run-id-${c.id}`} />
              <Textarea aria-label="Returned supporting work" rows={5} placeholder="…or paste returned work (10–40,000 chars)" value={text} maxLength={RESULT_MAX} onChange={(e) => setText(e.target.value)} disabled={!!runId.trim()} className="font-mono text-[11px]" data-testid={`input-result-text-${c.id}`} />
              <div className="flex items-center gap-2"><span className="text-muted-foreground">{text.length.toLocaleString()} / 40,000</span>
                {(text || runId) && retErr && <span role="alert" className="text-destructive" data-testid={`text-return-error-${c.id}`}>{retErr}</span>}
                <Button size="sm" className="ml-auto h-7" disabled={!!retErr || tx.isPending} onClick={() => act(runId.trim() ? { action: "RETURN", spcPlayerRunId: runId.trim() } : { action: "RETURN", resultText: text.trim() })} data-testid={`button-return-${c.id}`}>Record return</Button>
              </div>
            </div>
          )}
          {ctl.canReview && (
            <div className="border rounded p-2 space-y-2" data-testid={`panel-review-${c.id}`}>
              <span className={lab}>Review returned work</span>
              <Textarea aria-label="Review note (required for revision or reject)" rows={2} placeholder="Note (required for revision or reject)" value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} data-testid={`input-note-${c.id}`} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-7" disabled={c.sourceChanged || tx.isPending} onClick={() => act({ action: "ACCEPT", ...(note.trim() ? { note: note.trim() } : {}) })} data-testid={`button-accept-${c.id}`}>Accept as support</Button>
                <Button size="sm" variant="outline" className="h-7" disabled={!note.trim() || tx.isPending} onClick={() => act({ action: "REQUEST_REVISION", note: note.trim() })} data-testid={`button-revision-${c.id}`}>Request revision</Button>
                <Button size="sm" variant="outline" className="h-7 text-destructive" disabled={!note.trim() || tx.isPending} onClick={() => act({ action: "REJECT", note: note.trim() })} data-testid={`button-reject-${c.id}`}>Reject</Button>
              </div>
              <p className="text-muted-foreground">Accepting records support only. It does not advance {c.stage}.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {ctl.canCancel && <Button size="sm" variant="outline" className="h-7 text-destructive" disabled={tx.isPending} onClick={() => act({ action: "CANCEL", ...(note.trim() ? { note: note.trim() } : {}) })} data-testid={`button-cancel-${c.id}`}>Cancel request</Button>}
            <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadCaseJson(c)} data-testid={`button-download-${c.id}`}><Download className="h-3 w-3 mr-1" /> JSON</Button>
          </div>
          {err && <p className="text-destructive" role="alert" data-testid={`text-action-error-${c.id}`}>{err}</p>}
          <div>
            <div className={lab}>History ({c.history.length})</div>
            <ol className="mt-1 divide-y" data-testid={`list-history-${c.id}`}>
              {c.history.map((h, i) => (
                <li key={i} className="py-1 flex flex-wrap gap-x-3">
                  <b>{h.action}</b><span className="text-muted-foreground">{fmtTime(h.at)}</span>
                  {h.resultHash && <span>hash {shortHash(h.resultHash)}</span>}
                  {h.spcPlayerRunId && <span>run {h.spcPlayerRunId.slice(0, 8)}</span>}
                  {h.note && <span className="w-full text-muted-foreground font-sans">{h.note}</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </article>
  );
}
