import { describe, expect, it } from "vitest";
import { CodebaseOutputSchema } from "./f8codedj";

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

describe("F8 Code ORACLE output schema", () => {
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
});