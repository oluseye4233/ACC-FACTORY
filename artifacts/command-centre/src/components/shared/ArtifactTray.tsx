import { HarnessArtifact } from "@workspace/api-client-react";
import { format } from "date-fns";
import { CertTierChip } from "./CertTierChip";
import { GRODot } from "./GRODot";
import { FileText, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
};

function providerLabel(provider: string | null | undefined): string | null {
  if (!provider) return null;
  return PROVIDER_LABEL[provider] ?? provider;
}

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

function formatNumber(n: number | null | undefined): string | null {
  if (n == null) return null;
  return n.toLocaleString();
}

interface ArtifactTrayProps {
  artifacts: HarnessArtifact[];
  onSelect?: (artifact: HarnessArtifact) => void;
}

export function ArtifactTray({ artifacts, onSelect }: ArtifactTrayProps) {
  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-medium">No artifacts yet</p>
        <p className="text-sm mt-1">Artifacts generated during this session will appear here.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-2">
        {artifacts.map((artifact) => {
          const label = providerLabel(artifact.provider);
          const hasRunMeta =
            artifact.runDurationMs != null ||
            artifact.runInputTokens != null ||
            artifact.runOutputTokens != null ||
            artifact.runAt != null;
          const chip = label ? (
            <span
              className="flex items-center gap-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
              data-testid={`artifact-provider-${artifact.id}`}
            >
              <Sparkles className="h-3 w-3" />
              {label}
              {artifact.modelId ? (
                <span className="text-foreground/70">·{artifact.modelId}</span>
              ) : null}
            </span>
          ) : null;
          return (
            <button
              key={artifact.id}
              onClick={() => onSelect?.(artifact)}
              className="flex flex-col gap-2 p-3 text-left border rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs font-bold text-primary">
                  {artifact.artifactType.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {format(new Date(artifact.createdAt), "HH:mm")}
                </span>
              </div>

              {artifact.sku ? (
                <span
                  className="font-mono text-[10px] text-muted-foreground/90 tracking-tight break-all"
                  title="Universal SKU"
                  data-testid={`artifact-sku-${artifact.id}`}
                >
                  {artifact.sku}
                </span>
              ) : null}

              <div className="flex items-center gap-2 mt-1">
                {artifact.jcseScore !== null && artifact.jcseScore !== undefined && (
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    JCSE: <span className="text-foreground">{artifact.jcseScore}</span>
                  </span>
                )}

                {artifact.certTier && <CertTierChip tier={artifact.certTier} />}
                {artifact.groState && <GRODot state={artifact.groState} />}
                {chip ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        data-testid={`artifact-provider-tooltip-trigger-${artifact.id}`}
                      >
                        {chip}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs"
                      data-testid={`artifact-provider-tooltip-${artifact.id}`}
                    >
                      <div className="flex flex-col gap-1 text-xs font-mono">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Provider</span>
                          <span>{label}</span>
                        </div>
                        {artifact.modelId ? (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Model</span>
                            <span>{artifact.modelId}</span>
                          </div>
                        ) : null}
                        {hasRunMeta ? (
                          <>
                            {artifact.runDurationMs != null ? (
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">Duration</span>
                                <span>{formatDuration(artifact.runDurationMs)}</span>
                              </div>
                            ) : null}
                            {artifact.runInputTokens != null ? (
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">Input tokens</span>
                                <span>{formatNumber(artifact.runInputTokens)}</span>
                              </div>
                            ) : null}
                            {artifact.runOutputTokens != null ? (
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">Output tokens</span>
                                <span>{formatNumber(artifact.runOutputTokens)}</span>
                              </div>
                            ) : null}
                            {artifact.runAt ? (
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">Run at</span>
                                <span>
                                  {format(new Date(artifact.runAt), "yyyy-MM-dd HH:mm:ss")}
                                </span>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="text-muted-foreground italic">
                            No run telemetry recorded
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
