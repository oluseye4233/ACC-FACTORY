import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROVIDER_MODELS } from "../src/engines/provider-models";
import {
  computeCostUsd,
  computeWorstCaseReservationUsd,
  MODEL_PRICING,
  UnsupportedModelPricingError,
} from "../src/lib/pricing";

type ProviderPricingSnapshotManifest = {
  sources: Array<{
    id: string;
    provider: string;
    url: string;
    modelIds: string[];
    sha256: string;
    reviewedOn: string;
  }>;
};

const pricingSnapshots = JSON.parse(
  readFileSync(
    new URL("../../../scripts/data/provider-pricing-snapshots.json", import.meta.url),
    "utf8",
  ),
) as ProviderPricingSnapshotManifest;

describe("provider token pricing", () => {
  it("has a reviewed official source and valid rates for every default model", () => {
    for (const [provider, modelId] of Object.entries(PROVIDER_MODELS)) {
      const pricing = MODEL_PRICING[modelId];
      expect(pricing, `${provider} default ${modelId} has pricing`).toBeDefined();
      if (!pricing) continue;

      expect(pricing.sourceUrls.length, `${modelId} has reviewed sources`).toBeGreaterThan(
        0,
      );
      expect(pricing.reviewedOn, `${modelId} has a review date`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      const reviewDate = new Date(`${pricing.reviewedOn}T00:00:00Z`);
      expect(Number.isNaN(reviewDate.getTime())).toBe(false);
      expect(reviewDate.toISOString().slice(0, 10)).toBe(pricing.reviewedOn);

      for (const sourceUrl of pricing.sourceUrls) {
        expect(sourceUrl, `${modelId} source URL`).toMatch(/^https:\/\//);
        const monitoredSource = pricingSnapshots.sources.find(
          (source) => source.url === sourceUrl,
        );
        expect(
          monitoredSource,
          `${modelId} source ${sourceUrl} is monitored`,
        ).toBeDefined();
        expect(monitoredSource?.provider, `${modelId} source provider`).toBe(provider);
        expect(
          monitoredSource?.modelIds,
          `${modelId} is attributed to its monitored source`,
        ).toContain(modelId);
        expect(monitoredSource?.sha256, `${modelId} source fingerprint`).toMatch(
          /^[a-f0-9]{64}$/,
        );
        expect(monitoredSource?.reviewedOn, `${modelId} source review date`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
        expect(monitoredSource?.reviewedOn).toBe(pricing.reviewedOn);
      }
    }
  });

  it("keeps every configured rate finite, positive, and valid across input tiers", () => {
    const assertValidRates = (modelId: string, rates: {
      inputPerMTok: number;
      cachedInputPerMTok?: number;
      outputPerMTok: number;
    }) => {
      expect(rates.inputPerMTok, `${modelId} input rate`).toBeGreaterThan(0);
      expect(Number.isFinite(rates.inputPerMTok)).toBe(true);
      expect(rates.outputPerMTok, `${modelId} output rate`).toBeGreaterThan(0);
      expect(Number.isFinite(rates.outputPerMTok)).toBe(true);
      if (rates.cachedInputPerMTok !== undefined) {
        expect(rates.cachedInputPerMTok, `${modelId} cached input rate`).toBeGreaterThanOrEqual(0);
        expect(rates.cachedInputPerMTok, `${modelId} cached input rate`).toBeLessThanOrEqual(
          rates.inputPerMTok,
        );
        expect(Number.isFinite(rates.cachedInputPerMTok)).toBe(true);
      }
    };

    for (const [modelId, pricing] of Object.entries(MODEL_PRICING)) {
      assertValidRates(modelId, pricing);
      let previousMax = 0;
      for (const tier of pricing.inputTiers ?? []) {
        expect(tier.maxInputTokens).toBeGreaterThan(previousMax);
        expect(tier.maxInputTokens).toBeGreaterThan(0);
        assertValidRates(modelId, tier.rates);
        previousMax = tier.maxInputTokens;
      }
    }
  });

  it("uses the current published standard rates", () => {
    expect(computeCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBe(18);
    expect(computeCostUsd("gpt-5.4", 272_000, 1_000_000)).toBe(15.68);
    expect(computeCostUsd("deepseek-flash", 1_000_000, 1_000_000)).toBe(1.5);
    expect(computeCostUsd("kimi-k3", 1_000_000, 1_000_000)).toBe(18);
    expect(computeCostUsd("glm-5.3", 1_000_000, 1_000_000)).toBe(5.8);
  });

  it("prices cached input tokens at the published cache-hit rate", () => {
    expect(computeCostUsd("gpt-5.4", 100_000, 1_000_000, 100_000)).toBe(
      15.025,
    );
    expect(computeCostUsd("deepseek-flash", 1_000_000, 1_000_000, 500_000)).toBe(
      1.353,
    );
    expect(computeCostUsd("kimi-k3", 1_000_000, 1_000_000, 1_000_000)).toBe(
      15.3,
    );
    expect(
      computeCostUsd("qwen3.7-plus", 1_000_000, 1_000_000, 1_000_000),
    ).toBe(5.04);
    expect(computeCostUsd("glm-5.3", 1_000_000, 1_000_000, 1_000_000)).toBe(
      4.75,
    );
  });

  it("applies provider context-length price tiers at the published boundaries", () => {
    expect(computeCostUsd("gpt-5.4", 272_000, 0)).toBe(0.68);
    expect(computeCostUsd("gpt-5.4", 272_001, 0)).toBe(1.360005);

    expect(computeCostUsd("gemini-3.1-pro-preview", 200_000, 1_000_000)).toBe(
      12.4,
    );
    expect(
      computeCostUsd("gemini-3.1-pro-preview", 200_001, 1_000_000),
    ).toBe(18.800004);

    expect(computeCostUsd("qwen3.7-plus", 256_000, 0)).toBe(0.1024);
    expect(computeCostUsd("qwen3.7-plus", 256_001, 0)).toBe(0.3072012);
  });

  it("reserves the uncached maximum at the applicable high-context rates", () => {
    const reservation = computeWorstCaseReservationUsd(
      "qwen3.7-plus",
      256_001,
      16_384,
    );
    const completedCachedUsage = computeCostUsd(
      "qwen3.7-plus",
      256_001,
      16_384,
      200_000,
    );

    expect(reservation).toBeCloseTo(0.3858444, 10);
    expect(reservation).toBeGreaterThan(completedCachedUsage);
  });

  it("rejects unsupported models and invalid usage instead of using fallback rates", () => {
    expect(() => computeCostUsd("unlisted-model", 100, 100)).toThrow(
      UnsupportedModelPricingError,
    );
    expect(() => computeCostUsd("gpt-5.4", 100, 100, 101)).toThrow(
      "cachedInputTokens cannot exceed inputTokens",
    );
    expect(() => computeWorstCaseReservationUsd("gpt-5.4", -1, 100)).toThrow(
      "inputTokens must be a non-negative integer",
    );
  });
});