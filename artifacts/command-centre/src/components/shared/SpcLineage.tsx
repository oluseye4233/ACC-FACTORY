import { useMemo } from "react";
import type { HarnessArtifact } from "@workspace/api-client-react";
import { ENGINES } from "@/lib/constants";
import { GitBranch } from "lucide-react";

interface Props {
  /** All artifacts in the current session. */
  artifacts: HarnessArtifact[];
  /** The SPC the lineage is being rendered for. */
  targetArtifactId?: string;
}

export interface Stage {
  featureId: number;
  engineName: string;
  engineTitle: string;
  artifact: HarnessArtifact | null;
}

// The canonical provenance chain that produces an SPC: F1 → F2 → F3 → F4 → F5.
const LINEAGE_STAGES = [1, 2, 3, 4, 5] as const;

// Lineage is derived from session membership. To stay trustworthy when a session
// has multiple runs/branches, the chain is anchored to the target SPC: every
// prior stage is the most recent artifact that could have *preceded* that SPC
// (createdAt <= the target's createdAt). The SPC stage uses the target itself.
// Without a target, it falls back to the session-global latest per stage.
export function computeLineage(
  artifacts: HarnessArtifact[],
  targetArtifactId?: string,
): Stage[] {
  const target = targetArtifactId
    ? artifacts.find((a) => a.id === targetArtifactId)
    : undefined;
  const cutoff = target ? new Date(target.createdAt).getTime() : Infinity;

  return LINEAGE_STAGES.map((featureId) => {
    const engine = ENGINES.find((e) => e.id === featureId);
    let artifact: HarnessArtifact | null = null;
    if (target && featureId === target.featureId) {
      artifact = target;
    } else {
      artifact =
        artifacts
          .filter(
            (a) =>
              a.featureId === featureId &&
              new Date(a.createdAt).getTime() <= cutoff,
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0] ?? null;
    }
    return {
      featureId,
      engineName: engine?.name ?? `F${featureId}`,
      engineTitle: engine?.title ?? "",
      artifact,
    };
  });
}

export function SpcLineage({ artifacts, targetArtifactId }: Props) {
  const stages = useMemo<Stage[]>(
    () => computeLineage(artifacts, targetArtifactId),
    [artifacts, targetArtifactId],
  );

  const hasAny = stages.some((s) => s.artifact);
  if (!hasAny) return null;

  return (
    <div
      className="rounded border border-border/40 bg-background/30 p-3"
      data-testid="spc-lineage"
    >
      <div className="mb-2 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-secondary" />
        <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
          SPC Lineage · Provenance Chain
        </h4>
      </div>
      <ol className="space-y-1.5">
        {stages.map((stage, i) => {
          const a = stage.artifact;
          const isTarget = !!a && a.id === targetArtifactId;
          return (
            <li
              key={stage.featureId}
              className="flex items-start gap-2"
              data-testid={`spc-lineage-stage-${stage.featureId}`}
            >
              <div className="flex flex-col items-center pt-0.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] font-bold ${
                    a
                      ? isTarget
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/20 text-secondary"
                      : "bg-muted text-muted-foreground/50"
                  }`}
                >
                  {stage.engineName}
                </span>
                {i < stages.length - 1 && (
                  <span className="my-0.5 h-3 w-px bg-border/60" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                {a ? (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-mono text-[11px] font-bold text-foreground/90">
                        {a.name ?? stage.engineTitle ?? a.artifactType}
                      </span>
                      {isTarget && (
                        <span className="rounded bg-primary/15 px-1 font-mono text-[8px] uppercase text-primary">
                          this SPC
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted-foreground">
                      <span>{a.artifactType}</span>
                      {typeof a.jcseScore === "number" && (
                        <span>JCSE {a.jcseScore}</span>
                      )}
                      {a.certTier && <span>· {a.certTier}</span>}
                      {a.provider && <span>· {a.provider}</span>}
                      <span>· {new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                  </>
                ) : (
                  <span className="font-mono text-[10px] italic text-muted-foreground/50">
                    {stage.engineTitle || `Stage ${stage.featureId}`} — not yet run
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
