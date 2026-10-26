import { describe, expect, it } from "vitest";
import { CodebaseOutputSchema, validateImplementationBundle } from "./f8codedj";
import { ColonizationTargetSchema, colonizationContext } from "./colonization-target";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    platform: "react-vite-static",
    framework: "Vite + React",
    language: "typescript",
    files: [
      {
        path: "package.json",
        language: "json",
        content: "{}",
      },
    ],
    manifest: {
      framework: "Vite + React",
      language: "typescript",
      entrypoint: "src/main.tsx",
      installCommand: "pnpm install",
      runCommand: "pnpm run dev",
      buildCommand: "pnpm run build",
      deployTarget: "static",
    },
    ...overrides,
  };
}

describe("F8 CODE ONE + output schema", () => {
  it("bounds an overlong model-generated notes field instead of rejecting the scaffold", () => {
    const notes = "model note ".repeat(200);
    const parsed = CodebaseOutputSchema.safeParse(validOutput({ notes }));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notes).toHaveLength(800);
      expect(parsed.data.notes).toBe(notes.slice(0, 800));
    }
  });

  it("defaults missing notes to an empty string", () => {
    const parsed = CodebaseOutputSchema.safeParse(validOutput());

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.notes).toBe("");
  });

  it("refuses a missing generated entrypoint instead of presenting a runnable bundle", () => {
    expect(validateImplementationBundle(CodebaseOutputSchema.parse(validOutput()))).toContain("entrypoint");
  });

  it("refuses duplicate generated paths", () => {
    const out = CodebaseOutputSchema.parse(validOutput());
    out.files.push(out.files[0]!);
    expect(validateImplementationBundle(out)).toContain("unique");
  });

  it("refuses a mobile scaffold paired with a static hosting recommendation", () => {
    const out = CodebaseOutputSchema.parse(validOutput({ platform: "expo-mobile" }));
    out.files.push({ path: "src/main.tsx", content: "export default {};", language: "typescript" });
    out.manifest.deployTarget = "cloudflare-pages";
    expect(validateImplementationBundle(out, "cloudflare-pages")).toContain("Expo-compatible");
  });

  it("accepts matching runnable static scaffolding without claiming test approval", () => {
    const out = CodebaseOutputSchema.parse(validOutput());
    out.files.push({ path: "src/main.tsx", content: "export default {};", language: "typescript" });
    out.manifest.deployTarget = "cloudflare-pages";
    expect(validateImplementationBundle(out, "cloudflare-pages")).toBeNull();
  });

  it("refuses a manifest that ignores the actual HOST DJ primary", () => {
    const out = CodebaseOutputSchema.parse(validOutput());
    out.files.push({ path: "src/main.tsx", content: "export default {};", language: "typescript" });
    expect(validateImplementationBundle(out, "cloudflare-pages")).toContain("source-bound HOST DJ");
  });

  it("supports every planning target without interpreting it as deployment consent", () => {
    for (const target of ColonizationTargetSchema.options) {
      expect(colonizationContext(target)).toContain("not an F10 approval");
    }
    expect(ColonizationTargetSchema.safeParse("APPROVED_DEPLOYMENT").success).toBe(false);
  });
});