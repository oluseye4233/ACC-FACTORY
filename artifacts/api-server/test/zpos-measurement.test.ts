import { describe, expect, it } from "vitest";
import { measureZposCompression } from "../src/lib/zpos-measurement";

const sections = (body: string) => [{ key: "summary", title: "Summary", body }];
describe("server-measured ZPOS document compression", () => {
  it("counts both documents deterministically, with hashes and arithmetic", () => {
    const result = measureZposCompression("source-id", sections("A detailed requirement. ".repeat(100)), sections("Keep the requirement."));
    expect(result).toMatchObject({ sourceArtifactId: "source-id", tokenizer: "cl100k_base", version: "zpos-document-v1" });
    expect(result!.sourceTokens).toBeGreaterThan(result!.resultTokens);
    expect(result!.tokensReduced).toBe(result!.sourceTokens - result!.resultTokens);
    expect(result!.reductionPct).toBe(Math.round(result!.tokensReduced / result!.sourceTokens * 10000) / 100);
    expect(result!.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result!.resultHash).not.toBe(result!.sourceHash);
  });
  it("records expansion as negative reduction rather than clipping to zero", () => {
    const result = measureZposCompression("s", sections("short"), sections("long ".repeat(100)));
    expect(result!.tokensReduced).toBeLessThan(0);
    expect(result!.reductionPct).toBeLessThan(0);
  });
  it("ignores metadata and property insertion order but not content", () => {
    const a = [{ body: "Same", key: "summary", title: "Summary", other: "not measured" }];
    const result = measureZposCompression("s", a, sections("Same"));
    expect(result!.reductionPct).toBe(0);
    expect(result!.sourceHash).toBe(result!.resultHash);
  });
  it("does not invent measurements for missing or empty documents", () => {
    for (const source of [undefined, null, [], {}, sections(" "), [{ body: "no title" }]]) {
      expect(measureZposCompression("s", source, sections("output"))).toBeNull();
    }
    expect(measureZposCompression("s", sections("valid"), [])).toBeNull();
  });
  it("counts Unicode and literal special-token strings without failure", () => {
    const result = measureZposCompression("s", sections("你好 🌍 <|endoftext|>"), sections("你好"));
    expect(result!.sourceTokens).toBeGreaterThan(0);
  });
  it("measures actual four-part F6 documents while excluding metadata", () => {
    const source = {
      cheatSheet: "Pitch", execSummary: "Summary", worksheet: "Plan", implementation: "Build",
      colonizationTarget: "UNDECIDED", sourceArtifactId: "ignored",
    };
    const a = measureZposCompression("s", source, sections("Short"));
    const b = measureZposCompression("s", { ...source, colonizationTarget: "changed" }, sections("Short"));
    expect(a).not.toBeNull();
    expect(a!.sourceHash).toBe(b!.sourceHash);
    expect(a!.scope).toBe("document-content-json");
  });
});
