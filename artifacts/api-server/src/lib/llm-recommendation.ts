import type { LlmProvider } from "@workspace/db";
import { PROVIDER_MODELS } from "../engines/provider-models";
import { computeWorstCaseReservationUsd } from "./pricing";

export type Complexity = "simple" | "standard" | "complex";
export type RecommendationComplexity = Complexity | "auto";
const BAND = { simple: 1, standard: 2, complex: 3 };
// Conservative routing-policy profiles, NOT benchmark scores or assertions
// that a model cannot perform a harder task. Manual choices remain available.
const PROFILE: Record<LlmProvider, Complexity> = {
  deepseek: "simple", qwen: "standard", glm: "standard",
  kimi: "complex", mistral: "complex", claude: "complex", openai: "complex", gemini: "complex",
};
const ESTIMATE = {
  simple: { input: 2000, output: 1000 },
  standard: { input: 6000, output: 4000 },
  complex: { input: 20000, output: 12000 },
};
const REQUIRED_ENV: Record<LlmProvider, string[]> = {
  claude: ["AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
  openai: ["AI_INTEGRATIONS_OPENAI_BASE_URL", "AI_INTEGRATIONS_OPENAI_API_KEY"],
  gemini: ["AI_INTEGRATIONS_GEMINI_BASE_URL", "AI_INTEGRATIONS_GEMINI_API_KEY"],
  deepseek: ["AI_INTEGRATIONS_OPENROUTER_BASE_URL", "AI_INTEGRATIONS_OPENROUTER_API_KEY"],
  kimi: ["AI_INTEGRATIONS_OPENROUTER_BASE_URL", "AI_INTEGRATIONS_OPENROUTER_API_KEY"],
  qwen: ["AI_INTEGRATIONS_OPENROUTER_BASE_URL", "AI_INTEGRATIONS_OPENROUTER_API_KEY"],
  mistral: ["AI_INTEGRATIONS_OPENROUTER_BASE_URL", "AI_INTEGRATIONS_OPENROUTER_API_KEY"],
  glm: ["ZHIPU_API_KEY"],
};

export function recommendLlm({
  featureId, complexity: requested = "auto", tier,
  env = process.env,
}: {
  featureId?: number; complexity?: RecommendationComplexity; tier: string;
  env?: Record<string, string | undefined>;
}) {
  const complexity: Complexity = requested !== "auto" ? requested
    : featureId === 1 || featureId === 2 ? "simple"
    : featureId !== undefined && (featureId === 0 || featureId >= 6) ? "complex"
    : "standard";
  const estimate = ESTIMATE[complexity];
  const candidates = (Object.keys(PROFILE) as LlmProvider[])
    .filter(provider => tier !== "EXPLORER" || provider === "claude")
    .filter(provider => REQUIRED_ENV[provider].every(key => Boolean(env[key]?.trim())))
    .filter(provider => BAND[PROFILE[provider]] >= BAND[complexity])
    .map(provider => ({
      provider, modelId: PROVIDER_MODELS[provider], profile: PROFILE[provider],
      estimatedCostUsd: computeWorstCaseReservationUsd(
        PROVIDER_MODELS[provider], estimate.input, estimate.output,
      ),
    }))
    .sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd ||
      a.provider.localeCompare(b.provider));
  const recommended = candidates[0] ?? null;
  return {
    recommended, complexity, candidates,
    reason: !recommended ? "No configured, tier-eligible provider fits this routing profile. Keep your manual choice."
      : tier === "EXPLORER" ? "Your tier permits Claude only; other models have not been recommended."
      : `Lowest estimated per-call cost among configured providers in the ${complexity} routing profile or above.`,
    estimatedInputTokens: estimate.input,
    estimatedOutputTokens: estimate.output,
    disclaimer: "Optional policy-based suggestion, not a quality benchmark. Stage-based token estimates; artifact content is not analyzed. Actual cost varies with usage, endpoint pricing and multi-call runs. Getting a suggestion never calls a model or changes preferences. Apply to select a provider; starting an engine is separate. Existing governance and budget checks still apply.",
  };
}
