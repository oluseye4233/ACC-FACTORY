import { describe, expect, it } from "vitest";
import {
  computeCostUsd,
  computeWorstCaseReservationUsd,
  UnsupportedModelPricingError,
} from "../src/lib/pricing";

describe("provider token pricing", () => {
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