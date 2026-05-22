import { HarnessArtifact } from "@workspace/api-client-react";
import { format } from "date-fns";
import { CertTierChip } from "./CertTierChip";
import { GRODot } from "./GRODot";
import { FileText, Sparkles } from "lucide-react";

const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
};

function providerLabel(provider: string | null | undefined): string | null {
  if (!provider) return null;
  return PROVIDER_LABEL[provider] ?? provider;
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
    <div className="flex flex-col gap-2">
      {artifacts.map((artifact) => (
        <button
          key={artifact.id}
          onClick={() => onSelect?.(artifact)}
          className="flex flex-col gap-2 p-3 text-left border rounded-md hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-xs font-bold text-primary">{artifact.artifactType.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {format(new Date(artifact.createdAt), "HH:mm")}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            {artifact.jcseScore !== null && artifact.jcseScore !== undefined && (
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                JCSE: <span className="text-foreground">{artifact.jcseScore}</span>
              </span>
            )}
            
            {artifact.certTier && <CertTierChip tier={artifact.certTier} />}
            {artifact.groState && <GRODot state={artifact.groState} />}
            {providerLabel(artifact.provider) && (
              <span
                className="flex items-center gap-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                title={artifact.modelId ?? undefined}
                data-testid={`artifact-provider-${artifact.id}`}
              >
                <Sparkles className="h-3 w-3" />
                {providerLabel(artifact.provider)}
                {artifact.modelId ? (
                  <span className="text-foreground/70">·{artifact.modelId}</span>
                ) : null}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
