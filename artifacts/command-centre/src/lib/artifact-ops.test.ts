import { describe, expect, it } from "vitest";
import { filenamePreview, imprimaView, isActiveState, overridePolicy, safeDownloadUrl, ssView, MANIFEST_FIELDS, MANIFEST_SAMPLE, PREPARATION_MANIFEST_SAMPLE } from "./artifact-ops";

describe("artifact-ops view models", () => {
  it("offers a nonempty preparation sample without pretending a runtime is configured or weakening the full template", () => {
    expect(Object.keys(PREPARATION_MANIFEST_SAMPLE).sort()).toEqual([...MANIFEST_FIELDS].sort());
    for (const value of Object.values(PREPARATION_MANIFEST_SAMPLE)) if (typeof value === "string") expect(value.trim().length).toBeGreaterThan(0);
    expect(PREPARATION_MANIFEST_SAMPLE).toMatchObject({ model: "NOT_CONFIGURED", provider: "NOT_CONFIGURED", tools: [], monitoring: "Not connected" });
    expect(MANIFEST_SAMPLE.model).toBe("");
  });
  it("keeps truth/detect as not-run nulls", () => {
    const v = imprimaView({ clarity: { clarity: 71.4, truthfulness: null, detectability: null, method: "readability" } });
    expect(v.clarity).toEqual({ score: 71.4, truthfulness: null, detectability: null, method: "readability" });
    expect(imprimaView("junk").review).toBeNull();
  });
  it("never allows secret override", () => {
    expect(overridePolicy(imprimaView({ review: { verdict: "HOLD", flags: ["SECRET_DETECTED"] } })).allowed).toBe(false);
    expect(overridePolicy(imprimaView({ review: { verdict: "HOLD", flags: [] } }))).toMatchObject({ needed: true, allowed: true });
  });
  it("polls only active states", () => {
    expect(isActiveState("rendering")).toBe(true);
    expect(isActiveState("PUBLISHED")).toBe(false);
  });
  it("five-token filenames and safe paths", () => {
    expect(filenamePreview({ project: "Atlas", title: "Q3 Plan", audience: "TECHNICAL", mode: "DRAFT" }, new Date("2025-01-02")).split("_")).toHaveLength(5);
    expect(safeDownloadUrl("/api/artifact-operations/imprima/files/x")).toBeTruthy();
    expect(safeDownloadUrl("https://evil.example/x")).toBeNull();
  });
  it("reads missing requirements defensively", () => {
    expect(ssView({ missingRequirements: ["custody"] }).missing).toEqual(["custody"]);
    expect(ssView(null).missing).toEqual([]);
  });
});
