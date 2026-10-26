type SourceArtifact = {
  id: string;
  sessionId: string;
  featureId: number;
  artifactType: string;
  name?: string | null;
  artifactContent?: unknown;
  parentArtifactId?: string | null;
  createdAt: string | Date;
};

const generic = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const genericNames = new Set(["artifact", "untitled", "spc", "pdd", "mpdd", "micropdd", "microagent", "ma", "mvp", "mvppdd"]);

/** Display a real saved/product name before the type; never invent a product title. */
export function artifactDisplayName(artifact: Pick<SourceArtifact, "name" | "artifactType" | "artifactContent">): string {
  const meaningful = (value: unknown): value is string =>
    typeof value === "string" && Boolean(value.trim()) &&
    !genericNames.has(generic(value)) && generic(value) !== generic(artifact.artifactType);
  if (meaningful(artifact.name)) return artifact.name.trim();
  const find = (value: unknown, depth: number): string | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return;
    const record = value as Record<string, unknown>;
    for (const key of ["product_name", "productName", "project_name", "projectName", "project_title", "projectTitle", "system_name", "systemName", "artifact_name", "artifactName", "card_name", "cardName", "product", "title", "name"]) {
      if (meaningful(record[key])) return (record[key] as string).trim();
    }
    for (const key of ["card_identity_metadata", "cardIdentityMetadata", "identity", "metadata", "cheat_sheet", "cheatSheet", "pdd_cheat_sheet", "spc", "pdd", "microPdd", "micro_pdd", "mvp"]) {
      const found = find(record[key], depth + 1);
      if (found) return found;
    }
    return undefined;
  };
  return find(artifact.artifactContent, 0) ?? "Untitled artifact";
}

/** Exact departure wins. Otherwise use this stage, or the newest earlier stage. */
export function resolveSpcPlayerSource<T extends SourceArtifact>(
  artifacts: readonly T[],
  origin: { sessionId: string; featureId: number; sourceArtifactId?: string },
): T | undefined {
  // Canonical cockpit IDs are not F-stage numbers: F6-VDJ (8) precedes F7 (7).
  const stages = [1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11, 12, 13];
  const originIndex = stages.indexOf(origin.featureId);
  // Explicitly selected returned candidates may be reworked again. They never
  // become the implicit "latest production artifact" or gain certification.
  if (origin.sourceArtifactId) {
    const returned = artifacts.find(a => a.id === origin.sourceArtifactId &&
      a.sessionId === origin.sessionId && a.featureId === origin.featureId &&
      a.artifactType === "SPC_PLAYER_SUPPORT");
    const content = returned?.artifactContent as Record<string, unknown> | undefined;
    const upgrade = content?.boomerangUpgrade as Record<string, unknown> | undefined;
    if (returned?.parentArtifactId && upgrade?.parentArtifactId === returned.parentArtifactId &&
        content?.advisoryOnly === true && content?.planOnly === true) return returned;
  }
  const eligible = artifacts.filter(a => a.sessionId === origin.sessionId &&
    stages.indexOf(a.featureId) >= 0 && stages.indexOf(a.featureId) <= originIndex &&
    !a.artifactType.includes("SUPPORT"));
  if (origin.sourceArtifactId) return eligible.find(a => a.id === origin.sourceArtifactId);
  return [...eligible].sort((a, b) =>
    stages.indexOf(b.featureId) - stages.indexOf(a.featureId) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
    b.id.localeCompare(a.id),
  )[0];
}
