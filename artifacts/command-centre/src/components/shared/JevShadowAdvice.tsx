import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetJevShadowReportsQueryKey, useGetJevShadowReports, useGetMe, useRunJevShadow } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

/** Shadow output intentionally has no Apply / Accept / Advance action. */
export function JevShadowAdvice({ sessionId, featureId, kind, disabled }: {
  sessionId: string; featureId: number; kind: "MODEL_ROUTING" | "REMEDIATION"; disabled?: boolean;
}) {
  const params = { sessionId, featureId, kind };
  const query = useGetJevShadowReports(params, { query: { staleTime: 0, refetchOnWindowFocus: true, retry: false } });
  const me = useGetMe();
  const mutation = useRunJevShadow({ mutation: { retry: false } });
  const qc = useQueryClient();
  const requestKey = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = query.data?.[0];
  const explorer = (me.data?.subscriber?.tier ?? "EXPLORER") === "EXPLORER";
  const pct = (value: unknown) => typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "Not available";
  async function run() {
    setError(null);
    requestKey.current ??= crypto.randomUUID();
    try {
      await mutation.mutateAsync({ data: { ...params, requestKey: requestKey.current } });
      await qc.invalidateQueries({ queryKey: getGetJevShadowReportsQueryKey(params) });
      requestKey.current = null;
    } catch {
      setError("Shadow check unavailable or budget/tier restricted. Refresh saved results before another attempt.");
      await qc.invalidateQueries({ queryKey: getGetJevShadowReportsQueryKey(params) });
    }
  }
  return <section className="rounded border p-3 space-y-2 text-xs" data-testid="jev-shadow-advice">
    <h4 className="font-semibold">JEV — optional shadow adviser</h4>
    <p>Records a {kind === "MODEL_ROUTING" ? "model-routing" : "remediation"} suggestion for review. It does not change your model, scores, Boomerang route, stage or release permissions.</p>
    <Button type="button" size="sm" variant="outline" disabled={disabled || explorer || mutation.isPending} onClick={run}>
      {mutation.isPending ? "Recording shadow check…" : "Run JEV shadow check (uses credits)"}
    </Button>
    {explorer && <p>Practitioner or higher required.</p>}
    {error && <p role="alert">{error}</p>}
    {query.isError && <p role="alert">Saved advice could not be loaded. Production controls are unchanged.</p>}
    {report && <div className="space-y-1" role="status">
      <p>Saved snapshot: {new Date(report.createdAt).toLocaleString()} · {report.status}</p>
      {report.status === "COMPLETED" && <>
        <p>Suggestion: <strong>{String(report.result?.choice ?? "Review required")}</strong></p>
        <p>Model-reported confidence: {pct(report.result?.confidence)} · Review-needed probability: {pct(report.result?.needsReviewProbability)}</p>
        <p>Not calibrated against ACC outcomes; not a certification or verified accuracy measure.</p>
      </>}
      {report.error && <p>{report.error}</p>}
      {report.status === "STARTED" && <p>Recorded attempt has not confirmed completion. Do not repeat an uncertain paid dispatch.</p>}
      <p className="break-all text-muted-foreground">Model: {report.modelId ?? "Not confirmed"} · Evidence snapshot: {report.snapshotHash}</p>
      <p className="text-muted-foreground">Applies only to the saved context at that time. A later artifact or configuration needs its own review. Identical context reuses the saved attempt without another provider call.</p>
    </div>}
    <Button type="button" size="sm" variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>Refresh saved advice — no model call</Button>
  </section>;
}
