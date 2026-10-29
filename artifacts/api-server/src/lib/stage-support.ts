import { BoomerangError } from "./boomerang";

export const SUPPORT_TOOLS = ["imprima", "short-sprints", "agent-creator", "ingestion", "cartridge", "f0"] as const;
export type SupportTool = typeof SUPPORT_TOOLS[number];
export const PUBLICATION_KINDS: Record<string, string> = {
  MA_BIRTH_PACKAGE: "F3_MA", MICRO_PDD: "F4_MICRO_PDD", SPC: "F5_SPC",
  ATLAS_PDD: "F6_PDD", ATLAS_PDD_JSON: "F6_PDD", ATLAS_360_PLAN_VIEW: "F6_PDD",
  ATLAS_360_SCAN_VIEW: "F6_PDD", MVP_PDD: "F7_MVP_PDD",
  PROMPT_DIAGNOSTIC: "ARTIFACT", ATOMIC_PROMPT: "ARTIFACT",
  CODEBASE_BUNDLE: "ARTIFACT", VERIFIED_CODEBASE_BUNDLE: "ARTIFACT",
  AGENT_PACKAGE: "ARTIFACT", PFP_REPORT: "ARTIFACT", HOSTING_PLAN: "ARTIFACT",
};
type Source = { id: string; featureId: number; artifactType: string; createdAt: Date | string; sessionId?: string; artifactContent?: unknown };

/** No upstream fallback: the currently open stage must have its own saved output. */
export function exactSupportSource<T extends Source>(rows: T[], featureId: number): T | undefined {
  return rows.filter(row => row.featureId === featureId && !["SPC_PLAYER_SUPPORT", "AGENT_PACKAGE"].includes(row.artifactType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id))[0];
}

export function supportAvailability(source: Source | undefined, tool: SupportTool, rows: Source[] = [], featureId = source?.featureId) {
  if (tool === "agent-creator" && ![3, 4, 5].includes(featureId ?? -1)) {
    return { tool, active: false, reason: "Agent Creator is available only at F3/F4 after a paired Micro PDD exists, or at F5 after an SPC is saved." };
  }
  if (!source) return { tool, active: false, reason: "Save an artifact at this exact stage first." };
  if (tool === "agent-creator") {
    const parent = (row: Source) => (row.artifactContent as { sourceArtifactId?: string } | null)?.sourceArtifactId;
    const paired = source.featureId === 3 && source.artifactType === "MA_BIRTH_PACKAGE"
      ? rows.some(row => row.featureId === 4 && row.artifactType === "MICRO_PDD" && row.sessionId === source.sessionId && parent(row) === source.id)
      : source.featureId === 4 && source.artifactType === "MICRO_PDD"
        ? rows.some(row => row.featureId === 3 && row.artifactType === "MA_BIRTH_PACKAGE" && row.sessionId === source.sessionId && row.id === parent(source))
        : source.featureId === 5 && source.artifactType === "SPC";
    return { tool, active: paired, reason: paired
      ? "Saved source and required companion are ready. SPC creation saves its Cheat Sheet first; fresh internal evaluation and release checks still apply."
      : "Save an MA's exact paired Micro PDD before launching from F3/F4, or save an SPC at F5." };
  }
  if (tool === "imprima" && !PUBLICATION_KINDS[source.artifactType]) {
    return { tool, active: false, reason: "IMPRIMA requires a saved MA, Micro PDD, SPC, PDD or MVP PDD at this stage." };
  }
  if (tool === "short-sprints" && !["MICRO_PDD", "SPC"].includes(source.artifactType)) {
    return { tool, active: false, reason: "SHORT SPRINTS requires this stage's Micro PDD (SC ONE) or SPC (SC TWO)." };
  }
  return { tool, active: true, reason: tool === "imprima" || tool === "short-sprints"
    ? "Private/internal supporting work available. Protected verification and release remain separately gated."
    : tool === "f0"
      ? "Source-bound advisory available. Complete discovery, save a report and return it for review; advice does not pass or advance this stage."
      : "Saved stage source available. Normal intake validation, usage and confirmation still apply." };
}

export function assertFreshSupportOutput(createdAt: Date, departedAt: Date) {
  if (createdAt.getTime() < departedAt.getTime()) {
    throw new BoomerangError(409, "OLD_SUPPORT_OUTPUT", "Use a new saved result produced after this departure, not an older artifact.");
  }
}

export function safePreparationResult(content: Record<string, unknown>, tool: SupportTool, sourceId: string) {
  if (content.kind !== tool || content.sourceId !== sourceId ||
      content.state !== (tool === "imprima" ? "PREPARED_DRAFT" : "PREPARED_PROPOSAL")) {
    throw new BoomerangError(409, "WRONG_SUPPORT_SOURCE", "This preparation is not a completed result for the exact departure source.");
  }
  const files = Array.isArray(content.files) ? content.files : [];
  if (!files.length) throw new BoomerangError(409, "MISSING_FILES", "The preparation has no saved output files.");
  return {
    kind: content.kind, sourceId, sourceHash: content.sourceHash, manifestHash: content.manifestHash,
    state: content.state, evaluationMode: content.evaluationMode,
    internalEvaluation: content.internalEvaluation, notices: content.notices,
    files: files.map(file => {
      const f = file as Record<string, unknown>;
      // Never copy private storage keys or credentials into a stage artifact.
      return { id: f.id, filename: f.filename, format: f.format, size: f.size, fileHash: f.fileHash, contentHash: f.contentHash };
    }),
    releaseAllowed: false, independentVerification: "NOT_ASSERTED",
  };
}
