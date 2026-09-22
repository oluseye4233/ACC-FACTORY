import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SpcPlayerOutputPackageSchema } from "@workspace/api-zod";

describe("SPC Player output-package score schema", () => {
  const completePackage = {
    content: [],
    governanceEvaluation: {
      kind: "governance_evaluation",
      invoked: true,
      verdict: "PASS",
      content: "Governance evaluation",
      evidence: ["evidence"],
      scores: { clarity: 80, truthfulness: 90, detectability: 70 },
      completedAt: "2026-07-01T09:00:00.000Z",
    },
    advisory: {
      authority: "user-authorized REVERB v3 derivation",
      status: "PRE_BUILD",
      profile: "full",
      invokedStages: [],
      governanceEvaluationInvoked: true,
      evidenceTrail: [],
      distribution: "plan-only; no connector invoked",
    },
    scores: {
      clarity: 80,
      truthfulness: 90,
      detectability: 70,
    },
    distributionPlan: {
      status: "plan_only",
      connectorInvoked: false,
      externalSend: false,
    },
  };

  test("accepts separate nullable 0-100 axes and rejects composite fields", () => {
    expect(
      SpcPlayerOutputPackageSchema.safeParse({
        ...completePackage,
      }).success,
    ).toBe(true);
    expect(
      SpcPlayerOutputPackageSchema.safeParse({
        ...completePackage,
        scores: { ...completePackage.scores, composite: 80 },
      }).success,
    ).toBe(false);
    expect(
      SpcPlayerOutputPackageSchema.safeParse({
        ...completePackage,
        scores: { ...completePackage.scores, compositeScore: 80 },
      }).success,
    ).toBe(false);
    expect(
      SpcPlayerOutputPackageSchema.safeParse({
        ...completePackage,
        compositeScore: 0.8,
      }).success,
    ).toBe(false);
  });

  test("OpenAPI cookie authentication names the actual signed staff cookie", () => {
    const openapi = readFileSync(
      fileURLToPath(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url)),
      "utf8",
    );
    expect(openapi).toMatch(
      /cookieAuth:\s*\n\s*type: apiKey\s*\n\s*in: cookie\s*\n\s*name: atanda_staff/,
    );
  });
});
