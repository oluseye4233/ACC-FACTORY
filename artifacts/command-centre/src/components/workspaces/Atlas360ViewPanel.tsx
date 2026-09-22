import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessPddView,
  HarnessPddViewFormat,
  Atlas360PddViewResponse,
  HarnessSessionOrigin,
  HarnessArtifact,
  getListSessionArtifactsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import { ErrorBanner } from "./_shared";
import { extractApiError } from "@/lib/sse";
import { downloadZip } from "@/lib/zipExport";
import { Download, LayoutDashboard, ShieldAlert, Loader2 } from "lucide-react";

interface Props {
  sessionId: string;
  sessionOrigin?: HarnessSessionOrigin;
  sourceArtifactId: string;
  artifacts: HarnessArtifact[];
}

export function Atlas360ViewPanel({ sessionId, sessionOrigin, sourceArtifactId, artifacts }: Props) {
  const qc = useQueryClient();

  const [format, setFormat] = useState<HarnessPddViewFormat>(
    sessionOrigin === HarnessSessionOrigin.ingested
      ? HarnessPddViewFormat.scan
      : HarnessPddViewFormat.plan
  );

  const [localResult, setLocalResult] = useState<Atlas360PddViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [costCap, setCostCap] = useState(false);

  // If we change source artifact, clear local result
  useEffect(() => {
    setLocalResult(null);
  }, [sourceArtifactId]);

  // See if there's a match in the artifacts array for this source + format
  const matchingArtifact = useMemo(() => {
    return artifacts.find((a) => {
      const content = a.artifactContent as unknown as Atlas360PddViewResponse;
      if (!content || !content.view || !content.sourceArtifactId) return false;
      
      const isCorrectSource = content.sourceArtifactId === sourceArtifactId;
      const isCorrectFormat = content.view === (format === HarnessPddViewFormat.plan ? 'PLAN' : 'SCAN');
      
      return isCorrectSource && isCorrectFormat;
    });
  }, [artifacts, sourceArtifactId, format]);

  const viewData = localResult || (matchingArtifact?.artifactContent as unknown as Atlas360PddViewResponse) || null;

  const mutation = useHarnessPddView({
    mutation: {
      onSuccess: (data) => {
        setLocalResult(data);
        setError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
      },
      onError: (err) => {
        const x = extractApiError(err);
        if (x.status === 402 || x.status === 403) {
          setCostCap(x.status === 402);
          setUpgrade(true);
        } else {
          setError(x.message || "Failed to generate view");
        }
      },
    },
  });

  const handleGenerate = () => {
    mutation.mutate({
      id: sessionId,
      params: { format },
    });
  };

  const exportView = async () => {
    if (!viewData) return;
    const files: Record<string, string> = {};
    
    // JSON dump
    files[`atlas-360-${format}.json`] = JSON.stringify(viewData, null, 2);
    
    // Markdown dump
    let md = `# ATLAS 360 ${viewData.view} VIEW\n\n`;
    if (viewData.disclosure) {
      md += `> **DISCLOSURE**: ${viewData.disclosure}\n\n`;
    }
    
    if (viewData.view === 'PLAN' && viewData.parts) {
      for (const part of viewData.parts) {
        md += `## Part ${part.part}: ${part.title}\n\n${part.content}\n\n`;
      }
    } else if (viewData.view === 'SCAN' && viewData.stages) {
      for (const stage of viewData.stages) {
        md += `## Stage ${stage.stage}: ${stage.name}\n\n`;
        md += `**Assessment**: ${stage.assessment}\n\n`;
        md += `**Evidence**:\n${stage.evidence.map(e => `- ${e}`).join('\n')}\n\n`;
        md += `**Actions**:\n${stage.actions.map(a => `- ${a}`).join('\n')}\n\n`;
      }
    }
    
    files[`atlas-360-${format}.md`] = md;
    
    await downloadZip(`atlas-360-${format}-${sessionId.slice(0, 8)}.zip`, files);
  };

  return (
    <Card className="flex flex-col bg-card/50 mt-4 overflow-hidden border-border/50">
      <div className="p-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            ATLAS 360 VIEW
          </h4>
          <p className="text-[11px] text-muted-foreground max-w-md leading-relaxed">
            {format === HarnessPddViewFormat.plan
              ? "PLAN is the 12-part build/planning view for structured software delivery."
              : "SCAN is the 8-stage assurance view for auditing and compliance."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select 
            value={format} 
            onValueChange={(v) => setFormat(v as HarnessPddViewFormat)}
            disabled={mutation.isPending}
          >
            <SelectTrigger className="font-mono text-xs w-28 h-8" data-testid="pdd-view-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={HarnessPddViewFormat.plan} className="font-mono text-xs">PLAN</SelectItem>
              <SelectItem value={HarnessPddViewFormat.scan} className="font-mono text-xs">SCAN</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleGenerate}
            disabled={mutation.isPending || !sourceArtifactId}
            size="sm"
            className="font-display tracking-wider h-8 px-4"
            data-testid="pdd-view-generate"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> GENERATING...</>
            ) : (
              `GENERATE ${format.toUpperCase()}`
            )}
          </Button>
          
          {viewData && (
            <Button
              onClick={exportView}
              variant="outline"
              size="sm"
              className="font-mono text-xs h-8 px-3"
              data-testid="pdd-view-export"
            >
              <Download className="w-3 h-3 mr-1.5" /> EXPORT
            </Button>
          )}
        </div>
      </div>
      
      {error && <div className="p-3"><ErrorBanner message={error} /></div>}

      <div className="p-4 flex-1 min-h-[300px] max-h-[500px] overflow-y-auto bg-background/30">
        {!viewData ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            {format === HarnessPddViewFormat.plan ? (
              <LayoutDashboard className="w-10 h-10 mb-3" />
            ) : (
              <ShieldAlert className="w-10 h-10 mb-3" />
            )}
            <p className="font-mono text-xs max-w-xs">
              Generate a {format.toUpperCase()} view to transform this PDD into {format === HarnessPddViewFormat.plan ? "an actionable 12-part technical plan" : "a rigorous 8-stage audit profile"}.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-display text-2xl text-secondary">
                {viewData.title || `ATLAS 360 ${viewData.view} VIEW`}
              </h3>
              <div className="font-mono text-[10px] text-muted-foreground opacity-70">
                {viewData.schemaVersion}
              </div>
            </div>

            {viewData.disclosure && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-destructive">
                <p className="font-mono text-[10px] uppercase font-bold mb-1 tracking-wider">Disclosure</p>
                <p className="text-xs font-mono">{viewData.disclosure}</p>
              </div>
            )}

            {viewData.view === 'PLAN' && viewData.parts && (
              <div className="space-y-4">
                {viewData.parts.map((p) => (
                  <div key={p.part} className="bg-card rounded border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 border-b border-border/40 px-3 py-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                        PART {p.part}
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground/90">
                        {p.title}
                      </span>
                    </div>
                    <div className="p-3">
                      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
                        {p.content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewData.view === 'SCAN' && viewData.stages && (
              <div className="space-y-4">
                {viewData.stages.map((s) => (
                  <div key={s.stage} className="bg-card rounded border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 border-b border-border/40 px-3 py-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded font-bold">
                        STAGE {s.stage}
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground/90">
                        {s.name}
                      </span>
                    </div>
                    <div className="p-3 space-y-4">
                      <div>
                        <h5 className="font-mono text-[10px] uppercase font-bold text-muted-foreground mb-1">Assessment</h5>
                        <p className="text-xs text-foreground/90">{s.assessment}</p>
                      </div>
                      
                      {s.evidence && s.evidence.length > 0 && (
                        <div>
                          <h5 className="font-mono text-[10px] uppercase font-bold text-muted-foreground mb-1">Evidence</h5>
                          <ul className="list-disc list-inside text-xs text-foreground/80 pl-4 space-y-1">
                            {s.evidence.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                      
                      {s.actions && s.actions.length > 0 && (
                        <div>
                          <h5 className="font-mono text-[10px] uppercase font-bold text-muted-foreground mb-1">Actions</h5>
                          <ul className="list-disc list-inside text-xs text-foreground/80 pl-4 space-y-1">
                            {s.actions.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        costCap={costCap}
        message="ATLAS 360 Views require Practitioner tier or an active escalation."
      />
    </Card>
  );
}
