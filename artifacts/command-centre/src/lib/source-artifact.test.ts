import { describe, expect, it } from "vitest";
import { artifactDisplayName, resolveSpcPlayerSource } from "@workspace/artifact-naming";

const artifact = (id: string, featureId = 5, overrides: Record<string, unknown> = {}) => ({
  id, sessionId: "project-a", featureId, artifactType: "SPC", name: "SPC",
  artifactContent: {}, createdAt: "2026-10-18T01:00:00Z", ...overrides,
});

describe("readable artifact identity", () => {
  it("uses a real saved name before embedded metadata", () => {
    expect(artifactDisplayName(artifact("a", 5, { name: "CODE TWO", artifactContent: { title: "Old title" } }))).toBe("CODE TWO");
  });
  it("replaces generic type names with the embedded product name", () => {
    expect(artifactDisplayName(artifact("a", 4, {
      artifactType: "MICRO_PDD", name: "MICRO PDD",
      artifactContent: { card_identity_metadata: { product_name: "Solar Field Manager" } },
    }))).toBe("Solar Field Manager");
  });
  it("does not invent a title when the saved file has none", () => {
    expect(artifactDisplayName(artifact("a"))).toBe("Untitled artifact");
  });
});

describe("retained SPC Player origin", () => {
  it("chooses the origin stage, never another project or a newer downstream stage", () => {
    expect(resolveSpcPlayerSource([
      artifact("other", 5, { sessionId: "project-b" }),
      artifact("future", 6), artifact("source"), artifact("upstream", 4),
    ], { sessionId: "project-a", featureId: 5 })?.id).toBe("source");
  });
  it("uses the saved upstream artifact if the originating stage has no output yet", () => {
    expect(resolveSpcPlayerSource([artifact("upstream", 4)], { sessionId: "project-a", featureId: 5 })?.id).toBe("upstream");
  });
  it("retains the exact departure even when a newer artifact exists", () => {
    expect(resolveSpcPlayerSource([
      artifact("departure"), artifact("newer", 5, { createdAt: "2026-10-19T01:00:00Z" }),
    ], { sessionId: "project-a", featureId: 5, sourceArtifactId: "departure" })?.id).toBe("departure");
  });
  it("refuses a missing, foreign or future explicit source rather than substituting one", () => {
    for (const sourceArtifactId of ["missing", "foreign", "future"]) {
      expect(resolveSpcPlayerSource([
        artifact("valid"), artifact("foreign", 5, { sessionId: "project-b" }), artifact("future", 6),
      ], { sessionId: "project-a", featureId: 5, sourceArtifactId })).toBeUndefined();
    }
  });
  it("orders the VDJ side-step by its real stage rather than its numeric ID", () => {
    expect(resolveSpcPlayerSource([artifact("vdj", 8), artifact("pdd", 6)],
      { sessionId: "project-a", featureId: 7 })?.id).toBe("vdj");
  });
  it("does not pick a Boomerang supporting attachment as a production source", () => {
    expect(resolveSpcPlayerSource([artifact("support", 5, { artifactType: "BOOMERANG_SUPPORT" }), artifact("real", 4)],
      { sessionId: "project-a", featureId: 5 })?.id).toBe("real");
  });
});
