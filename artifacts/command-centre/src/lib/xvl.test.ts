import { describe, expect, it } from "vitest";
import { parseRuleDraft, runEligibility } from "./xvl";

describe("parseRuleDraft", () => {
  it("exists omits expected", () => {
    expect(parseRuleDraft({ path: "/title", operator: "exists", expected: "x" })).toEqual({
      rule: { path: "/title", operator: "exists" },
    });
  });
  it("root path allowed, bad pointer rejected", () => {
    expect("rule" in parseRuleDraft({ path: "", operator: "type", expected: "object" })).toBe(true);
    expect("error" in parseRuleDraft({ path: "title", operator: "exists", expected: "" })).toBe(true);
  });
  it("type takes a type name string", () => {
    expect(parseRuleDraft({ path: "/a", operator: "type", expected: "null" })).toEqual({
      rule: { path: "/a", operator: "type", expected: "null" },
    });
    expect("error" in parseRuleDraft({ path: "/a", operator: "type", expected: "int" })).toBe(true);
  });
  it("equals parses JSON scalars including null", () => {
    expect(parseRuleDraft({ path: "/a", operator: "equals", expected: "null" })).toEqual({
      rule: { path: "/a", operator: "equals", expected: null },
    });
    expect(parseRuleDraft({ path: "/a", operator: "equals", expected: '"x"' })).toEqual({
      rule: { path: "/a", operator: "equals", expected: "x" },
    });
    expect("error" in parseRuleDraft({ path: "/a", operator: "equals", expected: "[1]" })).toBe(true);
    expect("error" in parseRuleDraft({ path: "/a", operator: "equals", expected: "bare" })).toBe(true);
  });
  it("length needs nonnegative integer", () => {
    expect(parseRuleDraft({ path: "/a", operator: "minLength", expected: "0" })).toEqual({
      rule: { path: "/a", operator: "minLength", expected: 0 },
    });
    expect("error" in parseRuleDraft({ path: "/a", operator: "maxLength", expected: "-1" })).toBe(true);
    expect("error" in parseRuleDraft({ path: "/a", operator: "maxLength", expected: "1.5" })).toBe(true);
  });
});

describe("runEligibility", () => {
  const ev = { id: "e", stage: "F2", title: "t", rules: [], contentHash: "h", registeredAt: "2025-01-02T00:00:00Z" };
  it("requires matching stage and strictly later artifact", () => {
    expect(runEligibility({ id: "a", name: null, stage: "F2", createdAt: "2025-01-03T00:00:00Z" }, ev).ok).toBe(true);
    expect(runEligibility({ id: "a", name: null, stage: "F2", createdAt: "2025-01-02T00:00:00Z" }, ev).ok).toBe(false);
    expect(runEligibility({ id: "a", name: null, stage: "F3", createdAt: "2025-01-03T00:00:00Z" }, ev).ok).toBe(false);
  });
});
