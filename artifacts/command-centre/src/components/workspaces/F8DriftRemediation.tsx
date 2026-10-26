import { useEffect, useRef, useState } from "react";
import { getRemediateF8DriftUrl, useGetF8RemediationProgress, type F8DriftRemediationResult, type RemediateF8DriftInput } from "@workspace/api-client-react";
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
  const [result, setResult] = useState<F8DriftRemediationResult>();
  const abort = useRef<AbortController | null>(null);
  const recovery = useGetF8RemediationProgress({ sessionId }, { query: { refetchInterval: busy ? false : 15000, staleTime: 0 } });
  const saved = recovery.data?.attempt;
  const recoveryApplies = saved && (!reportArtifactId || saved.reportArtifactId === reportArtifactId);
  const savedResult = recoveryApplies && saved.phase === "COMPLETE" ? saved.result : undefined;
  const visibleResult = result ?? savedResult;
  const effectiveReportId = reportArtifactId ?? (recoveryApplies ? saved.reportArtifactId : undefined);
  useEffect(() => () => abort.current?.abort(), []);
  const run = async (reportOverride?: string) => {
    if (busy) return;
    if (savedResult && !reportOverride) {
      setMessage(`${savedResult.state.replaceAll("_", " ")}: ${savedResult.summary}`);
      setCaseId(savedResult.boomerangCaseId); setResult(savedResult); setError(""); onResult(savedResult);
      return;
    }
    const selectedReportId = reportOverride ?? effectiveReportId;
    if (!selectedReportId) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); onBusyChange(true); setError(""); setCaseId(undefined);
    setMessage("Starting remediation…");
    let terminal = false;
    try {
      await streamSse(getRemediateF8DriftUrl(), { sessionId, reportArtifactId: selectedReportId, ...(provider ? { provider } : {}) }, event => {
        if (controller.signal.aborted) return;
        if (event.event === "progress") setMessage((event.data as { message: string }).message);
        if (event.event === "error") { terminal = true; setError((event.data as { message: string }).message); setMessage(""); }
        if (event.event === "complete") {
          terminal = true;
          const result = event.data as F8DriftRemediationResult;
          setResult(result);
          setMessage(`${result.state.replaceAll("_", " ")}: ${result.summary}`);
          setCaseId(result.boomerangCaseId);
          onResult(result);
        }
      }, controller.signal);
      if (!terminal && !controller.signal.aborted) throw new Error("Connection ended before completion. Reload artifacts before retrying; saved progress will be recovered without repeating a completed repair.");
    } catch (err) {
      if (!controller.signal.aborted) { setError(extractApiError(err).message); setMessage(""); }
    } finally {
      if (!controller.signal.aborted) { setBusy(false); onBusyChange(false); void recovery.refetch(); }
    }
  };
  return <div className="border border-secondary/40 rounded p-3 space-y-2 font-mono text-xs">
    <Button type="button" size="sm" onClick={() => void run()} disabled={disabled || busy || (!effectiveReportId && !savedResult)} data-testid="f8-remediate">
      {busy ? "REMEDIATING → RE-DRIFT CHECK…" : savedResult ? "RESTORE SAVED REPAIR RESULT" : recoveryApplies ? "RESUME REPAIR + RE-DRIFT CHECK" : "AUTO REMEDIATE + RE-DRIFT CHECK"}
    </Button>
    <p className="text-muted-foreground">One automated repair pass, then an immediate fresh PFP check. Uses model credits for both calls. Original evidence is retained; requirements changes stop for human review. Generated code is not executed or certified.</p>
    {recoveryApplies && <p className="text-muted-foreground">Saved phase: {saved.phase.replaceAll("_", " ")}. Completed repairs are reused. Unknown provider outcomes stop for review rather than triggering another charge.</p>}
    {recovery.isError && <p role="alert">Saved progress could not be loaded. <button className="underline" onClick={() => void recovery.refetch()}>Retry loading progress</button></p>}
    {message && <p role="status">{message}</p>}
    {visibleResult?.bundle && <Link className="block underline"
      href={`/session/${encodeURIComponent(sessionId)}?featureId=9&artifactId=${encodeURIComponent(visibleResult.bundle.artifactId)}#artifact-${encodeURIComponent(visibleResult.bundle.artifactId)}`}>
      Open corrected artifact at F8
    </Link>}
    {visibleResult?.report?.verdict === "fail" && <div className="space-y-2" data-testid="f8-upgrade-still-failed">
      <p className="text-destructive">The fresh drift check still FAILED. This version is not a pass. Review its remaining findings, then authorize another repair of this corrected bundle.</p>
      <Button size="sm" variant="outline" disabled={busy || disabled}
        onClick={() => void run(visibleResult.report!.artifactId)}>
        REMEDIATE AGAIN + RE-DRIFT CHECK
      </Button>
    </div>}
    {visibleResult?.report && visibleResult.report.verdict !== "fail" && <p className="text-primary">
      Fresh drift result: {visibleResult.report.verdict.replaceAll("_", " ").toUpperCase()}. This is internal drift evidence, not release approval.
    </p>}
    {caseId && <Link href={`/boomerang?originKind=SESSION&originId=${encodeURIComponent(sessionId)}&stage=F8`} className="underline">Review returned Boomerang evidence</Link>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
