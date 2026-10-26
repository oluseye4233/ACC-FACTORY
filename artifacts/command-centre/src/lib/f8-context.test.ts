import { describe, expect, it } from "vitest";
import { pfpContextMatches } from "./f8-context";

describe("F8 cold-reload PFP context", () => {
  it("does not dereference missing context while saved artifacts load", () => {
    expect(pfpContextMatches(undefined, undefined, undefined)).toBe(false);
    expect(pfpContextMatches(undefined, "bundle", "mvp")).toBe(false);
  });
  it("does not accept unknown source IDs as a match", () => {
    expect(pfpContextMatches({ bundleId: "", sourceId: "" }, "", "")).toBe(false);
  });
  it("rejects another bundle or MVP and accepts only the bound report", () => {
    const context = { bundleId: "bundle", sourceId: "mvp" };
    expect(pfpContextMatches(context, "other", "mvp")).toBe(false);
    expect(pfpContextMatches(context, "bundle", "other")).toBe(false);
    expect(pfpContextMatches(context, "bundle", "mvp")).toBe(true);
  });
});
