export const SPC_PLAYER_PRODUCTION_ID = "JNGL-SPCPLY-PDD-2026-008";
export const SPC_PLAYER_REGISTRY_VERSION = "4.0";
/**
 * Reserved telemetry engine id for standalone SPC Player calls.  It is not a
 * HARNESS feature id and must be used with sessionId: null.
 */
export const SPC_PLAYER_ENGINE_ID = 30;

export const SPC_PLAYER_ENVIRONMENTS = [
  "Claude Skills",
  "Claude Code",
  "Codex + Sites + GPT",
  "Cursor",
  "Replit",
  "Antigravity",
  "Google Gemini Studio",
  "Microsoft Azure Copilot Studio",
  "LangChain",
  "GitHub Copilot",
] as const;

export const SPC_DEV_KIT = [
  {
    key: "atlas-360-plan",
    name: "ATLAS 360 PLAN",
    responsibility:
      "Registered planning card. Its detailed execution contract is outside the supplied SPC Player sources.",
    status: "registered_pre_build" as const,
  },
  {
    key: "spartan",
    name: "SPARTAN",
    responsibility: "Scopes the MVP.",
    status: "registered_pre_build" as const,
  },
  {
    key: "code-dj",
    name: "CODE DJ",
    responsibility: "Builds the scoped MVP.",
    status: "registered_pre_build" as const,
  },
  {
    key: "bugmxt",
    name: "BUGMXT",
    responsibility: "Debugs the result.",
    status: "registered_pre_build" as const,
  },
  {
    key: "codon",
    name: "CODON",
    responsibility:
      "Aligns intake against an existing MVP instead of rebuilding it.",
    status: "registered_pre_build" as const,
  },
  {
    key: "cordon",
    name: "CORDON",
    responsibility: "Sequences build order.",
    status: "registered_pre_build" as const,
  },
] as const;

export type SpcQualityScores = {
  clarity: number | null;
  truthfulness: number | null;
  detectability: number | null;
};

export type SpcPlayerPublication = {
  registryVersion: string;
  publicationStatus: "legacy" | "draft" | "published";
  cheatSheetPublished: boolean;
  publishedBy: "sphinx_engine" | null;
  publishedAt: string | null;
  cheatSheet: {
    mission: string;
    skillSet: string[];
    useCases: string[];
    productionProcess: string[];
    thirdPartyDefinitions: string[] | null;
    environmentNotes: Array<{
      environment: string;
      status: "sketch" | "verified_integration";
      note: string;
    }>;
  } | null;
  qualityScores: SpcQualityScores;
};

export const EMPTY_SPC_QUALITY_SCORES: SpcQualityScores = Object.freeze({
  clarity: null,
  truthfulness: null,
  detectability: null,
});

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function buildPublishedSpcMetadata(
  snapshot: Record<string, unknown>,
  fallbackTitle: string,
  publishedAt: Date,
): SpcPlayerPublication {
  const title =
    typeof snapshot.title === "string" && snapshot.title.trim()
      ? snapshot.title.trim()
      : fallbackTitle;
  const mission =
    typeof snapshot.objective === "string" && snapshot.objective.trim()
      ? snapshot.objective.trim()
      : `Apply ${title} according to its stored prompt contract.`;
  const outputs = stringArray(snapshot.outputs);
  const successCriteria = stringArray(snapshot.successCriteria);
  const orchestration =
    typeof snapshot.orchestrationPattern === "string"
      ? snapshot.orchestrationPattern
      : "declared";

  return {
    registryVersion: SPC_PLAYER_REGISTRY_VERSION,
    publicationStatus: "published",
    cheatSheetPublished: true,
    publishedBy: "sphinx_engine",
    publishedAt: publishedAt.toISOString(),
    cheatSheet: {
      mission,
      skillSet:
        outputs.length > 0
          ? outputs
          : ["Execute the card's stored seven-part atomic prompt."],
      useCases:
        successCriteria.length > 0
          ? successCriteria
          : ["Use the card where its stated objective and guardrails apply."],
      productionProcess: [
        "Load the card's system prompt and seven-part atomic prompt.",
        `Run the ${orchestration} orchestration against approved input data.`,
        "Validate outputs against the stored success criteria and guardrails.",
        "Package any completed governance checks as separate clarity, truthfulness, and detectability figures.",
      ],
      thirdPartyDefinitions: null,
      environmentNotes: SPC_PLAYER_ENVIRONMENTS.map((environment) => ({
        environment,
        status: "sketch",
        note: `Implementation sketch: adapt ${title}'s stored prompt contracts to ${environment}. This is not a verified integration.`,
      })),
    },
    qualityScores: { ...EMPTY_SPC_QUALITY_SCORES },
  };
}

export function readSpcPlayerPublication(
  snapshot: unknown,
): SpcPlayerPublication | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = (snapshot as Record<string, unknown>).spcPlayer;
  if (!value || typeof value !== "object") return null;
  return value as SpcPlayerPublication;
}

export function spcPlayerRegistry() {
  return {
    productionId: SPC_PLAYER_PRODUCTION_ID,
    version: SPC_PLAYER_REGISTRY_VERSION,
    status: "available" as const,
    access: "open_access" as const,
    certificationStatus: "pre_build" as const,
    cards: SPC_DEV_KIT,
    environments: SPC_PLAYER_ENVIRONMENTS,
    executionAuthority: "user-authorized REVERB v3 derivation" as const,
    qualityPolicy:
      "Clarity, truthfulness, and detectability are reported independently. No composite score is permitted; null means a check has not run.",
  };
}
