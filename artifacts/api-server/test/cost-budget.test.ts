import { describe, expect, it } from "vitest";
import type { SubscriberTier } from "@workspace/db";
import { effectiveCostCapUsd } from "../src/lib/cost-budget";
import { MONTHLY_COST_CAP_USD } from "../src/lib/tier";

describe("effectiveCostCapUsd", () => {
  const tiers: SubscriberTier[] = ["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"];

  it("returns the tier default when no override is set", () => {
    for (const t of tiers) {
      expect(effectiveCostCapUsd({ monthlyCostCapUsdOverride: null }, t)).toBe(
        MONTHLY_COST_CAP_USD[t],
      );
    }
  });

  it("returns the override when set, ignoring tier default", () => {
    expect(
      effectiveCostCapUsd({ monthlyCostCapUsdOverride: "750.00" }, "PRACTITIONER"),
    ).toBe(750);
    expect(
      effectiveCostCapUsd({ monthlyCostCapUsdOverride: "1.50" }, "INSTITUTION"),
    ).toBe(1.5);
  });

  it("accepts a $0 override (full lockdown)", () => {
    expect(
      effectiveCostCapUsd({ monthlyCostCapUsdOverride: "0.00" }, "ARCHITECT"),
    ).toBe(0);
  });

  it("falls back to the tier default for malformed or negative overrides", () => {
    expect(
      effectiveCostCapUsd({ monthlyCostCapUsdOverride: "not-a-number" }, "EXPLORER"),
    ).toBe(MONTHLY_COST_CAP_USD.EXPLORER);
    expect(
      effectiveCostCapUsd({ monthlyCostCapUsdOverride: "-5" }, "EXPLORER"),
    ).toBe(MONTHLY_COST_CAP_USD.EXPLORER);
  });

  it("tier defaults are monotonic non-decreasing (Explorer ≤ Practitioner ≤ Architect ≤ Institution)", () => {
    const ordered: SubscriberTier[] = ["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"];
    for (let i = 1; i < ordered.length; i++) {
      expect(MONTHLY_COST_CAP_USD[ordered[i]!]).toBeGreaterThanOrEqual(
        MONTHLY_COST_CAP_USD[ordered[i - 1]!],
      );
    }
  });
});
