import { describe, test, expect } from "vitest";
import { scoreJst } from "../src/lib/ascension";

describe("scoreJst — composite normalisation (3..30 → 0..100)", () => {
  test("minimum scores map to composite 0 / SEEKER", () => {
    const { composite, band } = scoreJst(1, 1, 1);
    expect(composite).toBe(0);
    expect(band).toBe("SEEKER");
  });

  test("maximum scores map to composite 100 / ASCENDANT", () => {
    const { composite, band } = scoreJst(10, 10, 10);
    expect(composite).toBe(100);
    expect(band).toBe("ASCENDANT");
  });

  test("mid scores land mid-scale", () => {
    // sum 18 -> (15/27)*100 = 55.56
    const { composite, band } = scoreJst(6, 6, 6);
    expect(composite).toBeCloseTo(55.56, 2);
    expect(band).toBe("BUILDER");
  });
});

describe("scoreJst — band thresholds", () => {
  test("just below 40 is SEEKER, at/above 40 is BUILDER", () => {
    // composite < 40 -> sum-3 < 10.8 -> sum < 13.8 -> sum 13 (10,2,1)
    expect(scoreJst(10, 2, 1).band).toBe("SEEKER"); // sum 13 -> 37.04
    // sum 14 -> 40.74 -> BUILDER
    expect(scoreJst(10, 3, 1).band).toBe("BUILDER");
  });

  test("OPERATOR and ASCENDANT bands are reachable", () => {
    expect(scoreJst(8, 8, 8).band).toBe("OPERATOR"); // sum 24 -> 77.78
    expect(scoreJst(9, 9, 9).band).toBe("ASCENDANT"); // sum 27 -> 88.89
  });
});
