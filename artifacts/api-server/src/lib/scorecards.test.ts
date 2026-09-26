import { describe, expect, it } from "vitest";
import { computeMathmonScore } from "./mathmon";
import { buildJcseScorecard, buildMathmonScorecard } from "./scorecards";

describe("scorecard builders", () => {
  it("explains all seven JCSE pillars and orders concrete improvement actions", () => {
    const scorecard = buildJcseScorecard({
      score: 21,
      scores: {
        SYSTEM: 3,
        ROLE: 4,
        INSTRUCTION: 5,
        EXAMPLE: 1,
        CONSTRAINT: 2,
        FORMAT: 6,
        DATA: 0,
      },
      feedback: {
        data: {
          explanation: "The prompt does not name required source material.",
          gaps: ["Inputs are not identified."],
          actions: ["List the input fields and their sources."],
        },
      },
    });

    expect(scorecard.kind).toBe("JCSE");
    expect(scorecard.dimensions).toHaveLength(7);
    expect(scorecard.dimensions.find((dimension) => dimension.key === "DATA")).toMatchObject({
      score: 0,
      explanation: "The prompt does not name required source material.",
      actions: ["List the input fields and their sources."],
    });
    expect(scorecard.advisoryReport.steps).toHaveLength(7);
    expect(scorecard.advisoryReport.steps[0]).toMatchObject({
      title: "Improve Data",
      priority: "HIGH",
      action: "List the input fields and their sources.",
    });
  });

  it("documents MAP weights and builds actions for each sub-score", () => {
    const scores = {
      mathCoherence: 80,
      applicability: 70,
      predictiveReliability: 60,
    };
    const scorecard = buildMathmonScorecard({
      scores,
      score: computeMathmonScore(scores),
      feedback: {
        predictiveReliability: {
          explanation: "No observed outcomes are available for validation.",
          gaps: ["The model has not been tested against held-out data."],
          actions: ["Collect held-out outcomes and compare them with predictions."],
        },
      },
    });

    expect(scorecard.score).toBe(72);
    expect(scorecard.calculation).toContain("80 × 40% + 70 × 35% + 60 × 25%");
    expect(scorecard.dimensions).toHaveLength(3);
    expect(scorecard.dimensions.find((dimension) => dimension.key === "predictiveReliability")).toMatchObject({
      score: 60,
      weightPercent: 25,
      explanation: "No observed outcomes are available for validation.",
      actions: ["Collect held-out outcomes and compare them with predictions."],
    });
    expect(scorecard.advisoryReport.steps).toHaveLength(3);
    expect(scorecard.advisoryReport.steps[0]?.title).toBe("Improve Predictive reliability");
  });
});