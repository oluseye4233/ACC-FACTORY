type UnitRates = {
  inputPerMTok: number;
  cachedInputPerMTok?: number;
  outputPerMTok: number;
};

export type ModelPricing = UnitRates & {
  inputTiers?: Array<{ maxInputTokens: number; rates: UnitRates }>;
  sourceUrls: string[];
  reviewedOn: string;
};

// Standard USD prices, checked against provider rate cards on 2026-09-26.
// The uncached rate is deliberately used for reservations; cached usage is
// discounted only when a provider reports its cached-token count.
//
// Sources:
// - Anthropic: https://docs.anthropic.com/en/docs/about-claude/pricing
// - OpenAI: https://developers.openai.com/api/docs/models/gpt-5.4
// - Google: https://ai.google.dev/gemini-api/docs/pricing
// - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
// - Moonshot: https://platform.kimi.ai/docs/pricing/chat
// - Qwen: https://docs.modelstudio.console.alibabacloud.com/en/model-studio/model-pricing
// - GLM: https://docs.bigmodel.cn/cn/guide/start/pricing (RMB); the USD
//   ceiling below is also checked against the international GLM-5.3 listing:
//   https://www.alibabacloud.com/help/en/model-studio/glm-5-3-by-zhipu
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-6": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    sourceUrls: ["https://docs.anthropic.com/en/docs/about-claude/pricing"],
    reviewedOn: "2026-09-26",
  },
  "gpt-5.4": {
    inputPerMTok: 2.5,
    cachedInputPerMTok: 0.25,
    outputPerMTok: 15,
    sourceUrls: ["https://developers.openai.com/api/docs/models/gpt-5.4"],
    reviewedOn: "2026-09-26",
    inputTiers: [
      {
        maxInputTokens: 272_000,
        rates: {
          inputPerMTok: 2.5,
          cachedInputPerMTok: 0.25,
          outputPerMTok: 15,
        },
      },
      {
        maxInputTokens: Number.POSITIVE_INFINITY,
        rates: {
          inputPerMTok: 5,
          cachedInputPerMTok: 0.5,
          outputPerMTok: 22.5,
        },
      },
    ],
  },
  "gemini-3.1-pro-preview": {
    inputPerMTok: 2,
    cachedInputPerMTok: 0.2,
    outputPerMTok: 12,
    sourceUrls: ["https://ai.google.dev/gemini-api/docs/pricing?hl=en"],
    reviewedOn: "2026-09-26",
    inputTiers: [
      {
        maxInputTokens: 200_000,
        rates: {
          inputPerMTok: 2,
          cachedInputPerMTok: 0.2,
          outputPerMTok: 12,
        },
      },
      {
        maxInputTokens: Number.POSITIVE_INFINITY,
        rates: {
          inputPerMTok: 4,
          cachedInputPerMTok: 0.4,
          outputPerMTok: 18,
        },
      },
    ],
  },
  // DeepSeek's documented peak rates are used for both the monthly estimate
  // and reservations. Its off-peak rate is half price, but the peak window
  // varies by weekday and Chinese public holidays.
  "deepseek-flash": {
    inputPerMTok: 0.3,
    cachedInputPerMTok: 0.006,
    outputPerMTok: 1.2,
    sourceUrls: ["https://api-docs.deepseek.com/quick_start/pricing"],
    reviewedOn: "2026-09-26",
  },
  "kimi-k3": {
    inputPerMTok: 3,
    cachedInputPerMTok: 0.3,
    outputPerMTok: 15,
    sourceUrls: ["https://platform.kimi.ai/docs/pricing/chat.md"],
    reviewedOn: "2026-09-26",
  },
  // DashScope international standard rates; the >256K tier is priced at the
  // higher request-level rate. Implicit cached input is billed at 20% of list.
  "qwen3.7-plus": {
    inputPerMTok: 0.4,
    cachedInputPerMTok: 0.08,
    outputPerMTok: 1.6,
    sourceUrls: [
      "https://docs.modelstudio.console.alibabacloud.com/en/model-studio/model-pricing",
    ],
    reviewedOn: "2026-09-26",
    inputTiers: [
      {
        maxInputTokens: 256_000,
        rates: {
          inputPerMTok: 0.4,
          cachedInputPerMTok: 0.08,
          outputPerMTok: 1.6,
        },
      },
      {
        maxInputTokens: Number.POSITIVE_INFINITY,
        rates: {
          inputPerMTok: 1.2,
          cachedInputPerMTok: 0.24,
          outputPerMTok: 4.8,
        },
      },
    ],
  },
  // The direct GLM API rate card is denominated in RMB; use the higher USD
  // international listing as a conservative estimate. Cache hits use a
  // conservative 25% of input list price.
  "glm-5.3": {
    inputPerMTok: 1.4,
    cachedInputPerMTok: 0.35,
    outputPerMTok: 4.4,
    sourceUrls: [
      "https://docs.bigmodel.cn/cn/guide/start/pricing",
      "https://www.alibabacloud.com/help/en/model-studio/glm-5-3-by-zhipu",
    ],
    reviewedOn: "2026-09-26",
  },
};

export class UnsupportedModelPricingError extends Error {
  constructor(modelId: string) {
    super(`No cost pricing is configured for model "${modelId}".`);
    this.name = "UnsupportedModelPricingError";
  }
}

function assertTokenCount(name: string, tokens: number): void {
  if (!Number.isSafeInteger(tokens) || tokens < 0) {
    throw new TypeError(`${name} must be a non-negative integer.`);
  }
}

export function computeCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) throw new UnsupportedModelPricingError(modelId);

  assertTokenCount("inputTokens", inputTokens);
  assertTokenCount("outputTokens", outputTokens);
  assertTokenCount("cachedInputTokens", cachedInputTokens);
  if (cachedInputTokens > inputTokens) {
    throw new RangeError("cachedInputTokens cannot exceed inputTokens.");
  }

  const rates =
    pricing.inputTiers?.find((tier) => inputTokens <= tier.maxInputTokens)?.rates ??
    pricing.inputTiers?.at(-1)?.rates ??
    pricing;
  const cachedRate = rates.cachedInputPerMTok ?? rates.inputPerMTok;
  const uncachedTokens = inputTokens - cachedInputTokens;
  return (
    uncachedTokens * rates.inputPerMTok +
    cachedInputTokens * cachedRate +
    outputTokens * rates.outputPerMTok
  ) / 1_000_000;
}

/** Worst-case per-call estimate: no cache discount and the maximum output. */
export function computeWorstCaseReservationUsd(
  modelId: string,
  inputTokenUpperBound: number,
  maxOutputTokens: number,
): number {
  return computeCostUsd(modelId, inputTokenUpperBound, maxOutputTokens);
}
