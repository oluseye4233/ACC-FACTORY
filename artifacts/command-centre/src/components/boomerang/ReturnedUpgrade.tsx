import { Link } from "wouter";
import type { HarnessArtifact } from "@workspace/api-client-react";
import { ENGINES } from "@/lib/constants";

export function returnedUpgradeHref(sessionId: string, featureId: number, artifactId: string) {
  return `/session/${encodeURIComponent(sessionId)}?featureId=${featureId}&artifactId=${encodeURIComponent(artifactId)}#artifact-${encodeURIComponent(artifactId)}`;
}

export function ReturnedUpgrade({ artifact, featureId }: { artifact: HarnessArtifact; featureId: number }) {
  const metadata = artifact.artifactContent?.boomerangUpgrade as Record<string, unknown> | undefined;
  const stage = ENGINES.find(engine => engine.id === featureId)?.name ?? "recorded stage";
  const title = typeof metadata?.label === "string" ? metadata.label : "Returned support";
  const rework = new URLSearchParams({
    sourceSessionId: artifact.sessionId, originFeatureId: String(featureId), sourceArtifactId: artifact.id,
  });
  const review = `/boomerang?originKind=SESSION&originId=${encodeURIComponent(artifact.sessionId)}&stage=${encodeURIComponent(stage)}`;
  return <section id={`artifact-${artifact.id}`} tabIndex={-1}
    className="mx-4 mt-4 scroll-mt-24 rounded-lg border border-primary/35 bg-primary/5 p-4"
    data-testid={`boomerang-return-${artifact.id}`} aria-label={`${title} at ${stage}`}>
    <h3 className="font-mono text-sm font-bold text-primary">{title} · {stage}</h3>
    <p className="mt-1 break-words text-sm">{artifact.name || artifact.artifactType}</p>
    <p className="mt-1 break-all font-mono text-[10px]">Artifact: {artifact.id}</p>
    <p className="mt-2 text-xs text-muted-foreground">
      A revised candidate, not a gate pass. Review the changed work and run this stage’s evaluation.
      If it still fails, rework this version again; earlier versions and failed checks remain in history.
    </p>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-primary">
      <Link href={returnedUpgradeHref(artifact.sessionId, featureId, artifact.id)} className="underline">Link to this returned artifact</Link>
      <Link href={review} className="underline">Review Boomerang evidence</Link>
      {artifact.artifactType === "SPC_PLAYER_SUPPORT" && metadata &&
        <Link href={`/spc-player/new?${rework}`} className="underline" data-testid={`rework-upgrade-${artifact.id}`}>Rework this version again</Link>}
    </div>
    <details className="mt-3">
      <summary className="cursor-pointer font-mono text-xs">View changed artifact / returned package</summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-3 font-mono text-[10px]">
        {JSON.stringify(artifact.artifactContent, null, 2)}
      </pre>
    </details>
  </section>;
}
