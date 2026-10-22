import { useMemo, useState } from "react";
import { useGetArtifact } from "@workspace/api-client-react";
import { bundleChanges, bundleFiles, lineChanges } from "@/lib/bundle-diff";
import { Button } from "@/components/ui/button";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function f8ComparisonRefs(text: string | null | undefined) {
  try {
    const refs = JSON.parse(text ?? "");
    return ["remediationArtifactId", "originalBundleArtifactId", "correctedBundleArtifactId", "originalReportArtifactId", "mvpPddArtifactId"]
      .every(key => typeof refs[key] === "string" && uuid.test(refs[key])) ? refs as Record<string, string> : null;
  } catch { return null; }
}

export function F8BundleComparison({ resultText, sessionId }: { resultText: string; sessionId: string }) {
  const refs = f8ComparisonRefs(resultText);
  return refs ? <Comparison refs={refs} sessionId={sessionId} /> : null;
}

function Comparison({ refs, sessionId }: { refs: Record<string, string>; sessionId: string }) {
  const options = { query: { staleTime: 0, refetchOnWindowFocus: true } };
  const original = useGetArtifact(refs.originalBundleArtifactId, options);
  const corrected = useGetArtifact(refs.correctedBundleArtifactId, options);
  const journal = useGetArtifact(refs.remediationArtifactId, options);
  const report = useGetArtifact(refs.originalReportArtifactId, options);
  const queries = [original, corrected, journal, report];
  const [path, setPath] = useState("");
  const oldFiles = bundleFiles(original.data?.artifactContent);
  const newFiles = bundleFiles(corrected.data?.artifactContent);
  const changes = useMemo(() => bundleChanges(oldFiles ?? [], newFiles ?? []), [original.data, corrected.data]);
  const selected = changes.find(f => f.path === path) ?? changes.find(f => f.status !== "unchanged") ?? changes[0];
  const diff = useMemo(() => selected ? lineChanges(selected.before ?? "", selected.after ?? "") : null, [selected?.path, selected?.before, selected?.after]);
  if (queries.some(q => q.isPending)) return <p role="status">Loading original and corrected evidence…</p>;
  if (queries.some(q => q.isError)) return <div role="alert">Could not load comparison evidence.
    <Button variant="outline" size="sm" onClick={() => queries.forEach(q => void q.refetch())}>Retry comparison</Button></div>;
  const j = journal.data?.artifactContent, c = corrected.data?.artifactContent, r = report.data?.artifactContent;
  const valid = oldFiles && newFiles && original.data?.artifactType === "CODEBASE_BUNDLE" &&
    corrected.data?.artifactType === "CODEBASE_BUNDLE" && journal.data?.artifactType === "F8_DRIFT_REMEDIATION" &&
    report.data?.artifactType === "PFP_REPORT" && queries.every(q => q.data?.sessionId === sessionId) &&
    j?.sourceCodebaseBundleArtifactId === original.data.id && j?.sourceReportArtifactId === report.data.id &&
    j?.sourceMvpPddArtifactId === refs.mvpPddArtifactId && c?.remediationArtifactId === journal.data.id &&
    c?.sourceCodebaseBundleArtifactId === original.data.id && c?.sourceDriftReportArtifactId === report.data.id &&
    c?.sourceMvpPddArtifactId === refs.mvpPddArtifactId &&
    r?.sourceCodebaseBundleArtifactId === original.data.id && r?.sourceMvpPddArtifactId === refs.mvpPddArtifactId;
  if (!valid) return <p role="alert" className="text-destructive">Comparison unavailable: evidence lineage is incomplete or does not match this session. Review the original records; no comparison was inferred.</p>;
  return <section className="border rounded p-3 space-y-2" aria-label="F8 bundle comparison">
    <h3 className="font-semibold">Original → corrected F8 files</h3>
    <p className="text-muted-foreground break-all">Original {refs.originalBundleArtifactId} · Corrected {refs.correctedBundleArtifactId}<br />
      Certified PDD {refs.mvpPddArtifactId} · Drift report {refs.originalReportArtifactId}</p>
    <p>Generated correction only. This comparison does not prove executed tests, certification or release approval.</p>
    <label className="block">File
      <select className="block w-full border rounded bg-background p-2" value={selected?.path ?? ""} onChange={e => setPath(e.target.value)}>
        {changes.map(f => <option key={f.path} value={f.path}>{f.status.toUpperCase()} · {f.path}</option>)}
      </select>
    </label>
    {diff?.fullReplacement && <p>Large file: showing the complete removed and added text instead of a minimal line diff.</p>}
    <p>− removed · + added · blank prefix unchanged</p>
    <pre className="max-h-96 overflow-auto border rounded p-2 text-[11px]" aria-label={`Changes in ${selected?.path ?? "file"}`}>
      {diff?.lines.map((line, i) => <span key={i} className={`block whitespace-pre ${line.kind === "removed" ? "bg-destructive/10" : line.kind === "added" ? "bg-primary/10" : ""}`}>
        {line.kind === "removed" ? "− " : line.kind === "added" ? "+ " : "  "}{line.text}
      </span>)}
    </pre>
  </section>;
}
