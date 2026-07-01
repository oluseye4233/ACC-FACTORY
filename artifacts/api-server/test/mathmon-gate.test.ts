import { describe, test, expect } from "vitest";
import {
  JCSE_PASS_THRESHOLD,
  MATHMON_PASS_THRESHOLD,
  MATHMON_WEIGHTS,
  clampScore,
  computeMathmonScore,
  computeForgeVerified,
} from "../src/lib/mathmon.ts";

describe("MATHMON composite score (server-recomputed, PFP discipline)", () => {
  test("weights sum to 1.0", () => {
    const sum =
      MATHMON_WEIGHTS.mathCoherence +
      MATHMON_WEIGHTS.applicability +
      MATHMON_WEIGHTS.predictiveReliability;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  test("computes the weighted composite and rounds", () => {
    // 80×0.40 + 70×0.35 + 60×0.25 = 32 + 24.5 + 15 = 71.5 → 72
    expect(computeMathmonScore({
      mathCoherence: 80,
      applicability: 70,
      predictiveReliability: 60,
    })).toBe(72);
  });

  test("all-100 → 100, all-0 → 0", () => {
    expect(computeMathmonScore({ mathCoherence: 100, applicability: 100, predictiveReliability: 100 })).toBe(100);
    expect(computeMathmonScore({ mathCoherence: 0, applicability: 0, predictiveReliability: 0 })).toBe(0);
  });

  test("clamps out-of-range sub-scores before weighting", () => {
    expect(computeMathmonScore({ mathCoherence: 200, applicability: -50, predictiveReliability: 50 })).toBe(
      // clamp → 100, 0, 50 : 100×0.40 + 0×0.35 + 50×0.25 = 40 + 0 + 12.5 = 52.5 → 53
      53,
    );
  });
});

describe("clampScore", () => {
  test("bounds to 0–100 and rounds", () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(101)).toBe(100);
    expect(clampScore(49.4)).toBe(49);
    expect(clampScore(49.5)).toBe(50);
  });

  test("non-finite → 0", () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("FORGE VERIFIED gate — computeForgeVerified (absolute, no override)", () => {
  test("thresholds are the documented D26 values", () => {
    expect(JCSE_PASS_THRESHOLD).toBe(45);
    expect(MATHMON_PASS_THRESHOLD).toBe(70);
  });

  test("passes only when BOTH thresholds are met", () => {
    // exactly on both boundaries → pass
    expect(computeForgeVerified(45, 70)).toBe(true);
    // comfortably above both → pass
    expect(computeForgeVerified(50, 100)).toBe(true);
  });

  test("just-below JCSE fails even with a high MATHMON", () => {
    expect(computeForgeVerified(44, 80)).toBe(false);
  });

  test("just-below MATHMON fails even with a high JCSE", () => {
    expect(computeForgeVerified(46, 69)).toBe(false);
  });

  test("boundary pass at 46/72", () => {
    expect(computeForgeVerified(46, 72)).toBe(true);
  });

  test("null / undefined score can never pass", () => {
    expect(computeForgeVerified(50, null)).toBe(false);
    expect(computeForgeVerified(50, undefined)).toBe(false);
    expect(computeForgeVerified(null, 90)).toBe(false);
    expect(computeForgeVerified(undefined, 90)).toBe(false);
    expect(computeForgeVerified(null, null)).toBe(false);
  });
});
