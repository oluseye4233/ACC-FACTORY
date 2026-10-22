import { Link } from "wouter";
import { useGetBoomerangRemediation } from "@workspace/api-client-react";
import { STAGE_ENGINE_ID } from "./boomerang-model";

export function BoomerangRecommendation({ originId, stage }: { originId: string; stage: string }) {
  const query = useGetBoomerangRemediation({ sessionId: originId, stage }, { query: {
    staleTime: 0, refetchOnWindowFocus: true,
  } });
  if (query.isLoading) return <p role="status" className="text-xs">Checking this stage’s internal evaluation…</p>;
  if (query.isError) return <p role="alert" className="text-xs text-destructive">Evaluation recommendation unavailable. No artifact has been selected for rework.</p>;
  const rec = query.data;
  if (!rec || rec.status !== "REWORK_RECOMMENDED" || !rec.sourceArtifactId || !STAGE_ENGINE_ID[stage]) return (
    <p className="text-xs text-muted-foreground">No recorded low-score rework recommendation for the latest saved artifact at this stage. Missing scores are not passes or failures.</p>
  );
  const params = new URLSearchParams({ sourceSessionId: originId, originFeatureId: String(STAGE_ENGINE_ID[stage]),
    sourceArtifactId: rec.sourceArtifactId, scoreRemediation: "1" });
  return <aside className="rounded border border-secondary/60 bg-secondary/5 p-3 space-y-2" data-testid="boomerang-score-recommendation">
    <h5 className="font-bold text-sm">Recommended: rework → re-ingest at F1</h5>
    <p className="text-xs break-all">{rec.sourceName} · {stage} · {rec.sourceArtifactId}</p>
    <p className="text-xs">JCSE: {rec.jcseScore ?? "NOT RUN"} / 50 · MATHMON: {rec.mathmonScore ?? "NOT RUN"} / 100</p>
    <ul className="list-disc pl-4 text-xs space-y-1">{rec.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul>
    <Link href={`/spc-player/new?${params}`} className="inline-block rounded bg-primary text-primary-foreground px-3 py-2 text-xs font-bold" data-testid="button-score-rework">
      Rework selected artifact in SPC Player → F1
    </Link>
    <p className="text-xs text-muted-foreground">The artifact is picked automatically. Choose supporting SPCs and confirm execution. Completed rework is sent to F1 for a new ingestion and evaluation; it does not approve a return or advance the original stage.</p>
  </aside>;
}
