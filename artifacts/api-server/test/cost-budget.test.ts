import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SubscriberTier } from "@workspace/db";
import { effectiveCostCapUsd, resolveTierDefaultCapUsd } from "../src/lib/cost-budget";
import { MONTHLY_COST_CAP_USD } from "../src/lib/tier";

const ANCIENT = new Date("2020-01-01T00:00:00Z");
const RECENT = new Date("2026-06-01T00:00:00Z");
const NOW_INSIDE_WINDOW = new Date("2026-05-28T12:00:00Z");
const NOW_AFTER_WINDOW = new Date("2027-01-01T00:00:00Z");

const ENV_KEYS = [
  "COST_CAP_GRANDFATHER_UNTIL",
  "COST_CAP_LEGACY_CUTOFF",
  "MONTHLY_COST_CAP_LEGACY_EXPLORER",
  "MONTHLY_COST_CAP_LEGACY_PRACTITIONER",
  "MONTHLY_COST_CAP_LEGACY_ARCHITECT",
  "MONTHLY_COST_CAP_LEGACY_INSTITUTION",
];

let snapshot: Record<string, string | undefined> = {};
beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

describe("effectiveCostCapUsd", () => {
  const tiers: SubscriberTier[] = ["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"];

  it("returns the tier default when no override is set", () => {
    for (const t of tiers) {
      expect(
        effectiveCostCapUsd({ monthlyCostCapUsdOverride: null, createdAt: ANCIENT }, t),
      ).toBe(MONTHLY_COST_CAP_USD[t]);
    }
  });

  it("returns the override when set, ignoring tier default", () => {
    expect(
      effectiveCostCapUsd(
        { monthlyCostCapUsdOverride: "750.00", createdAt: ANCIENT },
        "PRACTITIONER",
      ),
    ).toBe(750);
    expect(
      effectiveCostCapUsd(
        { monthlyCostCapUsdOverride: "1.50", createdAt: ANCIENT },
        "INSTITUTION",
      ),
    ).toBe(1.5);
  });

  it("accepts a $0 override (full lockdown)", () => {
    expect(
      effectiveCostCapUsd(
        { monthlyCostCapUsdOverride: "0.00", createdAt: ANCIENT },
        "ARCHITECT",
      ),
    ).toBe(0);
  });

  it("falls back to the tier default for malformed or negative overrides", () => {
    expect(
      effectiveCostCapUsd(
        { monthlyCostCapUsdOverride: "not-a-number", createdAt: ANCIENT },
        "EXPLORER",
      ),
    ).toBe(MONTHLY_COST_CAP_USD.EXPLORER);
    expect(
      effectiveCostCapUsd(
        { monthlyCostCapUsdOverride: "-5", createdAt: ANCIENT },
        "EXPLORER",
      ),
    ).toBe(MONTHLY_COST_CAP_USD.EXPLORER);
  });

  it("tier defaults are monotonic non-decreasing", () => {
    const ordered: SubscriberTier[] = ["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"];
    for (let i = 1; i < ordered.length; i++) {
      expect(MONTHLY_COST_CAP_USD[ordered[i]!]).toBeGreaterThanOrEqual(
        MONTHLY_COST_CAP_USD[ordered[i - 1]!],
      );
    }
  });
});

describe("resolveTierDefaultCapUsd grandfather window", () => {
  it("uses the live cap when no grandfather env is set", () => {
    expect(resolveTierDefaultCapUsd("PRACTITIONER", { createdAt: ANCIENT }, NOW_INSIDE_WINDOW)).toBe(
      MONTHLY_COST_CAP_USD.PRACTITIONER,
    );
  });

  it("uses the legacy cap when in-window AND user predates cutoff AND legacy env set", () => {
    process.env.COST_CAP_GRANDFATHER_UNTIL = "2026-12-31";
    process.env.COST_CAP_LEGACY_CUTOFF = "2026-05-15";
    process.env.MONTHLY_COST_CAP_LEGACY_PRACTITIONER = "50";
    expect(
      resolveTierDefaultCapUsd("PRACTITIONER", { createdAt: ANCIENT }, NOW_INSIDE_WINDOW),
    ).toBe(50);
  });

  it("falls back to live cap once the grandfather window expires", () => {
    process.env.COST_CAP_GRANDFATHER_UNTIL = "2026-12-31";
    process.env.COST_CAP_LEGACY_CUTOFF = "2026-05-15";
    process.env.MONTHLY_COST_CAP_LEGACY_PRACTITIONER = "50";
    expect(
      resolveTierDefaultCapUsd("PRACTITIONER", { createdAt: ANCIENT }, NOW_AFTER_WINDOW),
    ).toBe(MONTHLY_COST_CAP_USD.PRACTITIONER);
  });

  it("falls back to live cap for users created on/after the cutoff (new users get the new cap)", () => {
    process.env.COST_CAP_GRANDFATHER_UNTIL = "2026-12-31";
    process.env.COST_CAP_LEGACY_CUTOFF = "2026-05-15";
    process.env.MONTHLY_COST_CAP_LEGACY_PRACTITIONER = "50";
    expect(
      resolveTierDefaultCapUsd("PRACTITIONER", { createdAt: RECENT }, NOW_INSIDE_WINDOW),
    ).toBe(MONTHLY_COST_CAP_USD.PRACTITIONER);
  });

  it("falls back to live cap when grandfather is set but legacy env for the tier is missing", () => {
    process.env.COST_CAP_GRANDFATHER_UNTIL = "2026-12-31";
    process.env.COST_CAP_LEGACY_CUTOFF = "2026-05-15";
    // No MONTHLY_COST_CAP_LEGACY_ARCHITECT set.
    expect(
      resolveTierDefaultCapUsd("ARCHITECT", { createdAt: ANCIENT }, NOW_INSIDE_WINDOW),
    ).toBe(MONTHLY_COST_CAP_USD.ARCHITECT);
  });

  it("ignores grandfather env that is malformed", () => {
    process.env.COST_CAP_GRANDFATHER_UNTIL = "not-a-date";
    process.env.COST_CAP_LEGACY_CUTOFF = "2026-05-15";
    process.env.MONTHLY_COST_CAP_LEGACY_PRACTITIONER = "50";
    expect(
      resolveTierDefaultCapUsd("PRACTITIONER", { createdAt: ANCIENT }, NOW_INSIDE_WINDOW),
    ).toBe(MONTHLY_COST_CAP_USD.PRACTITIONER);
  });

  it("override still wins over a grandfathered legacy cap", () => {
    process.env.COST_CAP_GRANDFATHER_UNTIL = "2026-12-31";
    process.env.COST_CAP_LEGACY_CUTOFF = "2026-05-15";
    process.env.MONTHLY_COST_CAP_LEGACY_PRACTITIONER = "50";
    expect(
      effectiveCostCapUsd(
        { monthlyCostCapUsdOverride: "12.34", createdAt: ANCIENT },
        "PRACTITIONER",
        NOW_INSIDE_WINDOW,
      ),
    ).toBe(12.34);
  });
});
