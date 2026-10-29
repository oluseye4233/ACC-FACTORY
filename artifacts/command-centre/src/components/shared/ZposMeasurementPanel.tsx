import type { HarnessArtifact, MvpPdd, ZposMeasurement } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

// Saved artifacts can predate this measurement contract. Do not infer a
// historical measurement from the model-reported crP.
export function readZposMeasurement(cert: unknown): ZposMeasurement | null {
  const m = (cert as { zposMeasurement?: ZposMeasurement } | null)?.zposMeasurement;
  if (!m || m.version !== "zpos-document-v1" || m.tokenizer !== "cl100k_base" ||
      m.scope !== "document-content-json" ||
      !Number.isSafeInteger(m.sourceTokens) || m.sourceTokens <= 0 ||
      !Number.isSafeInteger(m.resultTokens) || m.resultTokens < 0 ||
      m.tokensReduced !== m.sourceTokens - m.resultTokens ||
      !Number.isFinite(m.reductionPct)) return null;
  return m;
}

export function summarizeZpos(artifacts: HarnessArtifact[], current?: MvpPdd) {
  const measurements = new Map<string, ZposMeasurement | null>();
  for (const artifact of artifacts) {
    if (artifact.artifactType === "MVP_PDD") {
      measurements.set(artifact.id, readZposMeasurement(artifact.spartanCert));
    }
  }
  if (current?.artifactId) measurements.set(current.artifactId, readZposMeasurement(current.cert));
  const measured = [...measurements.values()].filter((m): m is ZposMeasurement => !!m);
  const source = measured.reduce((n, m) => n + m.sourceTokens, 0);
  const result = measured.reduce((n, m) => n + m.resultTokens, 0);
  return {
    count: measured.length, unmeasured: measurements.size - measured.length,
    source, result, reduced: source - result,
    percentage: source ? (source - result) / source * 100 : null,
  };
}

export function ZposMeasurementPanel({ artifacts, current }: {
  artifacts: HarnessArtifact[]; current?: MvpPdd;
}) {
  const summary = summarizeZpos(artifacts, current);
  const latest = current ? readZposMeasurement(current.cert) : null;
  return (
    <Card className="p-4 space-y-3" data-testid="zpos-measurements">
      <h3 className="font-display tracking-wide">ZPOS · MEASURED DOCUMENT COMPRESSION</h3>
      <p className="text-sm text-muted-foreground">
        Server-counted document content using the fixed cl100k_base reference tokenizer.
        F6's four parts and F7's sections are normalized to title/key/body JSON; metadata is excluded.
        This measures SPARTAN + ZPOS document reduction, not ZPOS-only attribution,
        provider-billed usage, cost savings or preserved meaning.
      </p>
      {latest && (
        <div className="text-sm space-y-1" data-testid="zpos-current">
          <p>Current conversion: {latest.sourceTokens.toLocaleString()} → {latest.resultTokens.toLocaleString()} reference tokens</p>
          <p>{latest.tokensReduced.toLocaleString()} tokens reduced · {latest.reductionPct.toFixed(2)}%
            {latest.tokensReduced < 0 ? " (document expanded)" : ""}</p>
          <p className="text-xs text-muted-foreground">Measured {new Date(latest.measuredAt).toLocaleString()}</p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Measurement provenance</summary>
            <div className="break-all space-y-1 mt-2">
              <p>Source artifact: {latest.sourceArtifactId}</p>
              <p>Source SHA-256: {latest.sourceHash}</p>
              <p>Result SHA-256: {latest.resultHash}</p>
            </div>
          </details>
        </div>
      )}
      {summary.count ? (
        <p className="text-sm" data-testid="zpos-session-total">
          Session totals · {summary.count} measured conversions:
          {" "}{summary.source.toLocaleString()} → {summary.result.toLocaleString()} reference tokens;
          {" "}{summary.reduced.toLocaleString()} tokens reduced
          {" "}({summary.percentage!.toFixed(2)}%, weighted by source tokens).
          Repeated conversions of the same source count separately; this is not a cumulative inference saving.
        </p>
      ) : <p className="text-sm">No measured conversions yet. Complete a new F7 conversion to record a baseline and result.</p>}
      <p className="text-xs text-muted-foreground">
        {summary.unmeasured} saved conversions not measured. Historical model-reported ratios are not backfilled.
        Full prompts, metadata and model reasoning are excluded. Generation itself consumes tokens;
        inference savings remain unmeasured without a comparable baseline.
      </p>
    </Card>
  );
}
