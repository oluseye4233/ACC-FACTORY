import { useEffect, useRef, useState } from "react";
import { getRemediateF8DriftUrl, type F8DriftRemediationResult, type RemediateF8DriftInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { streamSse, extractApiError } from "@/lib/sse";

export function F8DriftRemediation({ sessionId, reportArtifactId, provider, disabled, onResult, onBusyChange }: {
  sessionId: string; reportArtifactId?: string; provider?: RemediateF8DriftInput["provider"];
  disabled: boolean; onResult: (result: F8DriftRemediationResult) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [caseId, setCaseId] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const run = async () => {
    if (busy || !reportArtifactId) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); onBusyChange(true); setError(""); setCaseId(undefined);
    setMessage("Starting remediation…");
    let terminal = false;
    try {
      await streamSse(getRemediateF8DriftUrl(), { sessionId, reportArtifactId, ...(provider ? { provider } : {}) }, event => {
        if (controller.signal.aborted) return;
        if (event.event === "progress") setMessage((event.data as { message: string }).message);
        if (event.event === "error") { terminal = true; setError((event.data as { message: string }).message); setMessage(""); }
        if (event.event === "complete") {
          terminal = true;
          const result = event.data as F8DriftRemediationResult;
          setMessage(`${result.state.replaceAll("_", " ")}: ${result.summary}`);
          setCaseId(result.boomerangCaseId);
          onResult(result);
        }
      }, controller.signal);
      if (!terminal && !controller.signal.aborted) throw new Error("Connection ended before completion. Reload artifacts before retrying; a saved repair may already exist.");
    } catch (err) {
      if (!controller.signal.aborted) { setError(extractApiError(err).message); setMessage(""); }
    } finally {
      if (!controller.signal.aborted) { setBusy(false); onBusyChange(false); }
    }
  };
  return <div className="border border-secondary/40 rounded p-3 space-y-2 font-mono text-xs">
    <Button type="button" size="sm" onClick={run} disabled={disabled || busy || !reportArtifactId} data-testid="f8-remediate">
      {busy ? "REMEDIATING → RE-DRIFT CHECK…" : "AUTO REMEDIATE + RE-DRIFT CHECK"}
    </Button>
    <p className="text-muted-foreground">One automated repair pass, then an immediate fresh PFP check. Uses model credits for both calls. Original evidence is retained; requirements changes stop for human review. Generated code is not executed or certified.</p>
    {message && <p role="status">{message}</p>}
    {caseId && <Link href={`/boomerang?originKind=SESSION&originId=${encodeURIComponent(sessionId)}&stage=F8`} className="underline">Review returned Boomerang evidence</Link>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
