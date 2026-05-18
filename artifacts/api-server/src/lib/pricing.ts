// USD cost per 1M tokens. Source: Anthropic pricing for Sonnet 4.
const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
};

const FALLBACK = { inputPerMTok: 3, outputPerMTok: 15 };

export function computeCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[modelId] ?? FALLBACK;
  return (inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) / 1_000_000;
}
