import { BoomerangError } from "./boomerang";

export const SUPPORT_TOOLS = ["imprima", "short-sprints", "ingestion", "cartridge", "f0"] as const;
export type SupportTool = typeof SUPPORT_TOOLS[number];
export const PUBLICATION_KINDS: Record<string, string> = {
  MA_BIRTH_PACKAGE: "F3_MA", MICRO_PDD: "F4_MICRO_PDD", SPC: "F5_SPC",
  ATLAS_PDD: "F6_PDD", ATLAS_PDD_JSON: "F6_PDD", ATLAS_360_PLAN_VIEW: "F6_PDD",
  ATLAS_360_SCAN_VIEW: "F6_PDD", MVP_PDD: "F7_MVP_PDD",
};
type Source = { id: string; featureId: number; artifactType: string; createdAt: Date | string };

/** No upstream fallback: the currently open stage must have its own saved output. */
export function exactSupportSource<T extends Source>(rows: T[], featureId: number): T | undefined {
  return rows.filter(row => row.featureId === featureId && row.artifactType !== "SPC_PLAYER_SUPPORT")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id))[0];
}

export function supportAvailability(source: Source | undefined, tool: SupportTool) {
  if (!source) return { tool, active: false, reason: "Save an artifact at this exact stage first." };
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
