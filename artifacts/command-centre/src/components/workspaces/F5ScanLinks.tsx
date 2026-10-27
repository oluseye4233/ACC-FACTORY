import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHarnessF5Scan, getListSessionArtifactsQueryKey, getListFeatureStateQueryKey, type HarnessArtifact } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import { extractApiError } from "@/lib/sse";

export function F5ScanLinks({ sessionId, artifacts }: { sessionId: string; artifacts: HarnessArtifact[] }) {
  const [links, setLinks] = useState("");
  const [context, setContext] = useState("");
  const qc = useQueryClient();
  const scan = useHarnessF5Scan({ mutation: { onSuccess: async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) }),
      qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) }),
    ]);
  } } });
  const latest = artifacts.filter(a => a.featureId === 5 && a.artifactType === "ATLAS_360_SCAN_VIEW")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const artifact = scan.data ?? latest;
  const content = artifact?.artifactContent;
  const stages = Array.isArray(content?.stages) ? content.stages : [];
  const evidence = Array.isArray(content?.sourceLinks) ? content.sourceLinks : [];
  const urlList = links.split(/\r?\n/).map(link => link.trim()).filter(Boolean);
  const status = (scan.error as { status?: number } | null)?.status;
  const [validation, setValidation] = useState("");
  return <Card className="p-5 space-y-4" data-testid="f5-scan-panel">
    <div>
      <h3 className="font-mono font-bold text-sm">ATLAS 360 SCAN · LINK INTAKE</h3>
      <p className="text-xs text-muted-foreground mt-1">Scan website pages, public GitHub repository pages or server references, then use the saved F5 SCAN artifact in F6.</p>
    </div>
    <div>
      <label htmlFor="f5-scan-links" className="font-mono text-xs font-bold">WEBSITE / GITHUB / LOCAL SERVER LINKS</label>
      <Textarea id="f5-scan-links" data-testid="f5-scan-links" value={links} onChange={e => setLinks(e.target.value)}
        placeholder={"https://your-website.com\nhttps://github.com/owner/repository\nhttp://localhost:3000"}
        className="mt-2 font-mono text-xs" disabled={scan.isPending} />
      <p className="text-xs text-muted-foreground mt-2">One link per line, maximum 3. Public HTTPS text pages are inspected read-only; a repository page is not a full code audit. Local/private links are retained as references, not fetched. Use a public HTTPS tunnel for live inspection. Do not paste credentials or signed private URLs.</p>
    </div>
    <div>
      <label htmlFor="f5-scan-context" className="font-mono text-xs">SUPPORTING CONTEXT · OPTIONAL</label>
      <Textarea id="f5-scan-context" value={context} onChange={e => setContext(e.target.value)}
        maxLength={4000} disabled={scan.isPending} className="mt-2 text-xs"
        placeholder="Describe the system and known limitations. Supplied claims remain unverified." />
    </div>
    <Button data-testid="f5-scan-run" disabled={scan.isPending || !urlList.length} onClick={() => {
      setValidation("");
      if (urlList.length > 3) { setValidation("Enter no more than 3 links."); return; }
      try {
        for (const link of urlList) {
          const u = new URL(link);
          if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) throw new Error();
        }
      } catch { setValidation("Enter valid HTTP/HTTPS links without embedded credentials."); return; }
      scan.mutate({ data: { sessionId, links: urlList, ...(context.trim() ? { context: context.trim() } : {}) } });
    }}>{scan.isPending ? "SCANNING REFERENCES…" : "CREATE F5 SCAN ARTIFACT"}</Button>
    {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
    {scan.error && <p role="alert" className="text-xs text-destructive">{extractApiError(scan.error).message}</p>}
    {artifact && <section className="space-y-3 border-t pt-3" data-testid="f5-scan-result">
      <h4 className="font-bold">{String(content?.title || artifact.name || "ATLAS 360 SCAN")}</h4>
      <p className="text-xs font-mono break-all">Saved F5 artifact: {artifact.id} · Available in F6’s source selector.</p>
      <p className="text-xs text-muted-foreground">Evidence-limited report—not certification or a passing release gate.</p>
      {evidence.map((item, i) => <div key={i} className="text-xs break-words">
        <strong>{String(item.status)}</strong> · {String(item.url)}
        <p className="text-muted-foreground">{String(item.coverage)}</p>
      </div>)}
      {stages.map((stage, i) => <details key={i} className="text-sm">
        <summary className="cursor-pointer font-mono">{String(stage.stage)}. {String(stage.name)}</summary>
        <p className="whitespace-pre-wrap my-2">{String(stage.assessment)}</p>
        {Array.isArray(stage.actions) && <ul className="list-disc pl-5">{stage.actions.map((action: unknown, n: number) => <li key={n}>{String(action)}</li>)}</ul>}
      </details>)}
    </section>}
    <UpgradeCTA open={status === 402 || status === 403} onOpenChange={() => scan.reset()}
      costCap={status === 402} message="F5 SCAN uses the existing subscription and model-budget controls." />
  </Card>;
}
