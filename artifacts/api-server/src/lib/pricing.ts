// USD cost per 1M tokens (rough order-of-magnitude estimates; metering is the
// source of truth for billing, this is for in-product cost visibility only).
const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "gpt-5.4": { inputPerMTok: 5, outputPerMTok: 15 },
  "gemini-3.1-pro-preview": { inputPerMTok: 3, outputPerMTok: 12 },
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
