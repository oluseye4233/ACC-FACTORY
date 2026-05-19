import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF1,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  PromptDiagnostic,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { JCSECounter } from "@/components/shared/JCSECounter";
import { CertTierChip } from "@/components/shared/CertTierChip";
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { extractApiError } from "@/lib/sse";
import { Cpu, Activity, Sparkles, TriangleAlert } from "lucide-react";

interface Props {
  sessionId: string;
  latest?: PromptDiagnostic;
}

export function F1TestPrompt({ sessionId, latest }: Props) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<PromptDiagnostic | undefined>(latest);
  const [error, setError] = useState<string | null>(null);

  const m = useHarnessF1({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        setError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
        qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
      },
      onError: (e) => setError(extractApiError(e).message),
    },
  });

  const onAnalyse = () => {
    if (prompt.trim().length < 10) {
      setError("Prompt must be at least 10 characters");
      return;
    }
    setError(null);
    m.mutate({ data: { sessionId, prompt } });
  };

  return (
    <WorkspaceShell>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4 h-full">
        <Card className="p-5 bg-card/50 flex flex-col gap-4 min-h-[400px]">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
              Raw Prompt Input
            </h3>
          </div>
          <Textarea
            data-testid="f1-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste your raw prompt here for ATLAS diagnostic..."
            className="flex-1 font-mono text-sm resize-none min-h-[280px] bg-background/50"
          />
          {error && <ErrorBanner message={error} />}
          <Button
            data-testid="f1-analyse"
            onClick={onAnalyse}
            disabled={m.isPending}
            className="font-display tracking-wider"
          >
            {m.isPending ? "ANALYSING..." : "ANALYSE"}
          </Button>
        </Card>

        <div className="flex flex-col gap-4 min-h-0">
          {!result ? (
            <EmptyState
              icon={<Activity className="h-12 w-12" />}
              title="AWAITING DIAGNOSTIC"
              body="Submit a raw prompt to receive a 7-pillar ATLAS assessment, JCSE score, and Atomic Prompt 7-tuple."
            />
          ) : (
            <>
              <Card className="p-5 bg-card/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <JCSECounter score={result.jcse.total} size="lg" />
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Composite Score
                    </span>
                    <CertTierChip tier={result.certTier} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                    Cert Tier
                  </div>
                  <div className="font-display text-2xl tracking-wider text-secondary">
                    {result.certTier}
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-card/50">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  7 Context Craft Pillars
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {result.pillars.map((p) => (
                    <div
                      key={p.pillar}
                      data-testid={`pillar-${p.pillar.toLowerCase()}`}
                      className="border border-border/40 rounded p-2 bg-background/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-primary">
                          {p.pillar}
                        </span>
                        <span className="font-mono text-xs">
                          {p.score}/{p.max}
                        </span>
                      </div>
                      <div className="mt-1 h-1 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(p.score / p.max) * 100}%` }}
                        />
                      </div>
                      {p.notes && (
                        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-5 bg-card/50">
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" /> Strengths
                  </h4>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="text-xs font-mono text-muted-foreground border-l border-primary/40 pl-2"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="p-5 bg-card/50">
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-destructive mb-2 flex items-center gap-2">
                    <TriangleAlert className="h-3 w-3" /> Gaps
                  </h4>
                  <ul className="space-y-1">
                    {result.gaps.map((g, i) => (
                      <li
                        key={i}
                        className="text-xs font-mono text-muted-foreground border-l border-destructive/40 pl-2"
                      >
                        {g}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card className="p-5 bg-card/50">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Atomic Prompt 7-Tuple (proposed)
                </h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(Object.keys(result.atomicPrompt) as Array<keyof typeof result.atomicPrompt>).map((k) => (
                    <div key={k} className="border border-border/40 rounded p-2">
                      <div className="font-mono text-[10px] font-bold text-secondary uppercase">
                        {k}
                      </div>
                      <div className="font-mono text-[11px] text-foreground/90 mt-1 line-clamp-3">
                        {result.atomicPrompt[k]}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
