import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExport, validateProfile } from "./f10-export";

const source = (type: any = "SPC", content: unknown = { title: "demo" }, id = "00000000-0000-0000-0000-000000000001") =>
  ({ id, type, content, name: "demo" });

describe("F10 deterministic exports", () => {
  it("validates target options and honest internal handoffs", () => {
    expect(validateProfile({ outputKind: "SPC", family: "IDE", target: "Cursor" })).toBeUndefined();
    expect(validateProfile({ outputKind: "SPC", family: "IDE", target: "unknown" })).toContain("IDE");
    const result = buildExport(source(), { outputKind: "SPC", family: "F0", target: "F0" });
    expect((result.manifest.profile as any).deliveryMode).toBe("INTERNAL_HANDOFF");
    expect(result.files.some(f => f.path === "import.json")).toBe(true);
    expect(validateProfile({ outputKind: "SPC", family: "PROGRAMMING_ENVIRONMENT", target: "Python" })).toContain("CODE_DJ");
  });
  it("uses closed native provider target schemas", () => {
    expect(validateProfile({ outputKind: "SPC", family: "AWS", target: "AWS_LAMBDA" })).toBeUndefined();
    expect(validateProfile({ outputKind: "SPC", family: "AWS", target: "us-east-1" })).toContain("AWS");
    expect(validateProfile({ outputKind: "SPC", family: "AZURE", target: "AZURE_FUNCTIONS" })).toBeUndefined();
    expect(validateProfile({ outputKind: "SPC", family: "OPENAI_AGENTS", target: "OPENAI_AGENTS_SDK" })).toBeUndefined();
    const result = buildExport(source(), { outputKind: "SPC", family: "GEMINI_AGENTS", target: "GEMINI_ADK" });
    expect(result.files.some(file => file.path === "deployment/provider-target.json")).toBe(true);
    expect(result.files.find(file => file.path === "deployment/provider-target.json")?.content.toString()).toContain("NOT_PERFORMED");
  });
  it("rejects mismatched output ownership", () => {
    expect(() => buildExport(source("MVP_PDD"), { outputKind: "SPC", family: "IDE", target: "Cursor" })).toThrow(/does not match/);
  });
  it("produces byte-identical ZIPs and a readable local header", () => {
    const profile = { outputKind: "CODE_DJ" as const, family: "IDE" as const, target: "VS Code" };
    const a = buildExport(source("CODEBASE_BUNDLE", { files: { "src/main.ts": "export const ok = true;" } }), profile);
    const b = buildExport(source("CODEBASE_BUNDLE", { files: { "src/main.ts": "export const ok = true;" } }), profile);
    expect(a.bundle.equals(b.bundle)).toBe(true);
    expect(a.bundle.readUInt32LE(0)).toBe(0x04034b50);
    expect(a.bundle.readUInt32LE(14)).not.toBe(0);
    expect(a.files.some(f => f.path === "src/main.ts")).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), "f10-zip-"));
    const file = join(dir, "bundle.zip");
    try {
      writeFileSync(file, a.bundle);
      expect(() => execFileSync("unzip", ["-t", file], { stdio: "ignore" })).not.toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("preserves the validated CODE DJ files array shape", () => {
    const result = buildExport(source("CODEBASE_BUNDLE", {
      platform: "node", framework: "express", language: "typescript",
      files: [{ path: "src/index.ts", language: "typescript", content: "export default 1;" }, { path: "package.json", language: "json", content: "{}" }],
    }), { outputKind: "CODE_DJ", family: "IDE", target: "VS Code" });
    expect(result.files.map(file => file.path)).toContain("src/index.ts");
    expect(result.files.map(file => file.path)).toContain("package.json");
    expect(result.manifest.files).toEqual(expect.arrayContaining([expect.objectContaining({ path: "src/index.ts", role: "scaffold" })]));
  });
  it("rejects traversal in CODE DJ scaffolds", () => {
    for (const path of ["../escape.txt", "..\\escape.txt", "/tmp/escape", "C:\\escape.txt", "%2e%2e/escape.txt", "./same.txt", "a//b.txt"]) {
      expect(() => buildExport(source("CODEBASE_BUNDLE", { files: { [path]: "no" } }), { outputKind: "CODE_DJ", family: "IDE", target: "Cursor" })).toThrow(/unsafe/);
    }
  });
  it("rejects duplicate paths after separator normalization", () => {
    expect(() => buildExport(source("CODEBASE_BUNDLE", { files: [
      { path: "src/main.ts", content: "one" },
      { path: "src\\main.ts", content: "two" },
    ] }), { outputKind: "CODE_DJ", family: "GITHUB", target: "GITHUB" })).toThrow(/duplicate/);
  });
  it("has a non-circular bundle hash scope", () => {
    const result = buildExport(source(), { outputKind: "SPC", family: "SPC_PLAYER", target: "SPC_PLAYER" });
    expect(result.manifest).toHaveProperty("bundleSha256Scope");
    expect((result.manifest.profile as any).deliveryMode).toBe("INTERNAL_HANDOFF");
  });
});
