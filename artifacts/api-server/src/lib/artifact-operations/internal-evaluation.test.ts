import { describe, expect, it } from "vitest";
import { internalEvaluation } from "./internal-evaluation";

const base = { kind: "imprima" as const, sourceHash: "a".repeat(64), source: { title: "Source" },
  assessedAt: new Date("2026-10-22T00:00:00Z"), scores: { jcseScore: null, mathmonScore: null } };
describe("internal evaluations never substitute for external workflow evidence", () => {
  it("retains missing scores and editorial review as NOT_RUN", () => {
    const result = internalEvaluation(base);
    expect(result.state).toBe("INCONCLUSIVE");
    expect(result.checks.filter(c => c.state === "NOT_RUN").map(c => c.id)).toEqual(["JCSE", "MATHMON", "EDITORIAL_REVIEW"]);
    expect(result).toMatchObject({ releaseAllowed: false, externalVerification: "NOT_RUN", sourceHash: base.sourceHash });
  });
  it("compares recorded internal scores without asserting certification", () => {
    const result = internalEvaluation({ ...base, scores: { jcseScore: 44, mathmonScore: 80 } });
    expect(result.state).toBe("FAIL");
    expect(result.checks.find(c => c.id === "JCSE")?.state).toBe("FAIL");
    expect(result.checks.find(c => c.id === "MATHMON")?.state).toBe("PASS");
    expect(result.caveat).toContain("Not independently evaluated");
    expect(result.releaseAllowed).toBe(false);
  });
  it("never treats manifest declarations as certified or measured sprint facts", () => {
    const result = internalEvaluation({ ...base, kind: "short-sprints", scores: { jcseScore: 50, mathmonScore: 100 },
      sprint: { circuit: "SC_ONE", target: "SOFTWARE", profile: "STANDARD",
        manifest: { inputContract: {}, outputContract: {}, systemPrompt: "Assist", tools: [], constraints: [] } } });
    expect(result.state).toBe("INCONCLUSIVE");
    expect(result.checks.find(c => c.id === "JSON_CONTRACT")?.state).toBe("PASS");
    const eligibility = result.inheritedEvidence.sprintEligibility!;
    expect(eligibility.state).toBe("INCONCLUSIVE");
    expect(eligibility.results.find(c => c.id === "SOURCE_STAGE_CERTIFIED")?.status).toBe("UNKNOWN");
    expect(eligibility.releaseAllowed).toBe(false);
  });
  it("fails the existing SC ONE tool limit instead of accepting a proposal", () => {
    const result = internalEvaluation({ ...base, kind: "short-sprints",
      sprint: { circuit: "SC_ONE", target: "SOFTWARE", profile: "STANDARD",
        manifest: { inputContract: {}, outputContract: {}, systemPrompt: "Assist", tools: ["one", "two"], constraints: [] } } });
    expect(result.state).toBe("FAIL");
    expect(result.inheritedEvidence.sprintEligibility?.state).toBe("INELIGIBLE");
  });
});
