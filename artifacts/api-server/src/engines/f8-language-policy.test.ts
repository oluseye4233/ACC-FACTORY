import { describe, expect, it } from "vitest";
import { F8_LANGUAGES, validateF8LanguageBundle, type F8Language } from "./f8-language-policy";
import { CodebaseOutputSchema } from "./f8codedj";

const extensions = { python: "py", javascript: "js", sql: "sql", c: "c", cpp: "cpp", csharp: "cs" };
function bundle(language: F8Language) {
  const entrypoint = `main.${extensions[language]}`;
  return { language, platform: "portable-source", framework: "source",
    files: [{ path: entrypoint, language, content: "synthetic policy fixture; not executable evidence" }] as { path: string; language: string; content: string }[],
    manifest: { language, entrypoint, framework: "source", installCommand: "echo setup", runCommand: "echo see README",
      buildCommand: null, deployTarget: "replit-deployments" }, notes: "Not compiled or executed." };
}
describe("F8 six-language boundary", () => {
  it.each(["javascript", "js"])("accepts %s metadata on a support file only when its contents are valid JSON", language => {
    const b = bundle("javascript");
    b.files.push({ path: "package.json", language, content: "{\"scripts\":{\"build\":\"vite build\"}}" });
    expect(validateF8LanguageBundle(b)).toBeNull();
  });
  it("rejects executable code disguised as JSON even with a JavaScript label", () => {
    const b = bundle("javascript");
    b.files.push({ path: "package.json", language: "javascript", content: "export default {}" });
    expect(validateF8LanguageBundle(b)).toContain("valid JSON");
  });
  it("does not accept TypeScript metadata on JSON support files", () => {
    const b = bundle("javascript");
    b.files.push({ path: "package.json", language: "typescript", content: "{}" });
    expect(validateF8LanguageBundle(b)).toContain("Unsupported");
  });
  it.each(F8_LANGUAGES)("accepts complete %s source metadata without claiming runtime verification", language => {
    expect(CodebaseOutputSchema.safeParse(bundle(language)).success).toBe(true);
    expect(validateF8LanguageBundle(bundle(language), language)).toBeNull();
  });
  it.each(["typescript", "rust", "go", "java", "swift", "kotlin", "bash"])("rejects unsupported primary language %s", language => {
    expect(CodebaseOutputSchema.safeParse({ ...bundle("javascript"), language }).success).toBe(false);
  });
  it.each(["main.ts", "main.tsx", "main.rs", "Main.java", "setup.sh", "main.go", "main.py.js", "..\\main.js"])("rejects unsupported or deceptive source path %s", file => {
    const b = bundle("python");
    b.files.push({ path: file, language: "python", content: "not supported" });
    expect(validateF8LanguageBundle(b)).not.toBeNull();
  });
  it("rejects unsupported code hidden behind a configuration language label", () => {
    const b = bundle("javascript");
    b.files.push({ path: "vite.config.ts", language: "json", content: "export default {}" });
    expect(validateF8LanguageBundle(b)).toContain("Unsupported");
  });
  it("requires consistent request, manifest and entrypoint languages", () => {
    const b = bundle("python");
    expect(validateF8LanguageBundle(b, "c")).toContain("selected");
    b.manifest.language = "sql";
    expect(validateF8LanguageBundle(b)).toContain("Manifest");
    b.manifest.language = "python";
    b.files[0]!.path = "main.sql"; b.files[0]!.language = "sql"; b.manifest.entrypoint = "main.sql";
    expect(validateF8LanguageBundle(b)).toContain("Entrypoint");
  });
  it("permits documentation, configuration and SQL beside supported code", () => {
    const b = bundle("javascript");
    b.files.push({ path: "README.md", language: "markdown", content: "Instructions" },
      { path: ".env.example", language: "env", content: "PORT=3000" },
      { path: "schema.sql", language: "sql", content: "SELECT 1;" });
    expect(validateF8LanguageBundle(b)).toBeNull();
  });
  it("rejects a non-JavaScript primary language masquerading as a JavaScript platform", () => {
    expect(validateF8LanguageBundle({ ...bundle("python"), platform: "nextjs-vercel" })).toContain("portable-source");
  });
});
