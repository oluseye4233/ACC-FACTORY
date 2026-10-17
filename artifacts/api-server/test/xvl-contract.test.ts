import { describe, expect, it } from "vitest";
import { evalsetInputSchema, evaluateJsonContract, evalsetDigest } from "../src/lib/xvl-contract";

describe("bounded independent JSON contract adapter", () => {
  it("checks types, lengths, scalar equality and escaped JSON pointers without exposing actual values", () => {
    const content = { title: "PRIVATE TITLE", items: [1, 2], flag: false, empty: null, "a/b": { "~": 1 } };
    const result = evaluateJsonContract(content, [
      { path: "/title", operator: "type", expected: "string" },
      { path: "/title", operator: "minLength", expected: 2 },
      { path: "/items", operator: "maxLength", expected: 2 },
      { path: "/flag", operator: "equals", expected: false },
      { path: "/empty", operator: "equals", expected: null },
      { path: "/a~1b/~0", operator: "equals", expected: 1 },
    ]);
    expect(result.outcome).toBe("PASS");
    expect(result.results).toHaveLength(6);
    expect(JSON.stringify(result)).not.toContain("PRIVATE TITLE");
  });
  it("does not confuse missing, null, false, zero or inherited properties", () => {
    expect(evaluateJsonContract({}, [{ path: "/missing", operator: "equals", expected: null }]).outcome).toBe("FAIL");
    expect(evaluateJsonContract({ a: null }, [{ path: "/a", operator: "exists" }]).outcome).toBe("PASS");
    expect(evaluateJsonContract({}, [{ path: "/toString", operator: "exists" }]).outcome).toBe("FAIL");
    expect(evaluateJsonContract({ a: 0 }, [{ path: "/a", operator: "equals", expected: false }]).outcome).toBe("FAIL");
    expect(evaluateJsonContract([], [{ path: "/length", operator: "exists" }]).outcome).toBe("FAIL");
    expect(evaluateJsonContract("😀", [{ path: "", operator: "maxLength", expected: 1 }]).outcome).toBe("PASS");
  });
  it("invalid contracts and oversized artifacts are inconclusive, never successful", () => {
    for (const rules of [[], [{ path: "/a", operator: "equals" }], [{ path: "/a", operator: "minLength", expected: -1 }]]) {
      expect(evaluateJsonContract({}, rules).outcome).toBe("INCONCLUSIVE");
    }
    expect(evaluateJsonContract({ a: "x".repeat(512001) }, [{ path: "/a", operator: "exists" }]))
      .toMatchObject({ outcome: "INCONCLUSIVE", reason: "ARTIFACT_SIZE_LIMIT" });
  });
  it("rejects supplied verdicts and ambiguous contract inputs", () => {
    const input = { stage: "F2", title: "Contract", rules: [{ path: "/a", operator: "exists" }] };
    expect(evalsetInputSchema.safeParse({ ...input, outcome: "PASS" }).success).toBe(false);
    expect(evalsetInputSchema.safeParse({ ...input, rules: [{ path: "/a~broken", operator: "exists" }] }).success).toBe(false);
    expect(evalsetInputSchema.safeParse({ ...input, rules: [{ path: "/a", operator: "exists", expected: true }] }).success).toBe(false);
  });
  it("hashes the exact stage and rule semantics, independent of object key order", () => {
    expect(evalsetDigest("F2", [{ path: "/a", operator: "exists" }]))
      .toBe(evalsetDigest("F2", [{ operator: "exists", path: "/a" }]));
    expect(evalsetDigest("F2", [{ path: "/a", operator: "exists" }]))
      .not.toBe(evalsetDigest("F3", [{ path: "/a", operator: "exists" }]));
  });
});
