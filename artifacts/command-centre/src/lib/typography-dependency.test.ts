import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const typographyRequire = createRequire(
  require.resolve("@tailwindcss/typography"),
);
const { commonTrailingPseudos } = typographyRequire("./utils.js") as {
  commonTrailingPseudos(selector: string): [string | null, string];
};

describe("patched typography selector parser compatibility", () => {
  it("resolves the patched parser through typography, not an unrelated copy", () => {
    const { version } = typographyRequire(
      "postcss-selector-parser/package.json",
    ) as { version: string };
    const [major, minor, patch] = version.split(".").map(Number);
    expect(
      major > 7 || (major === 7 && (minor > 1 || (minor === 1 && patch >= 6))),
    ).toBe(true);
  });

  it("preserves selectors without a common trailing pseudo-element", () => {
    expect(commonTrailingPseudos(".prose p, .prose a:hover")).toEqual([
      null,
      ".prose p, .prose a:hover",
    ]);
    expect(commonTrailingPseudos("p::before,a::after")).toEqual([
      null,
      "p::before,a::after",
    ]);
  });

  it("extracts shared pseudo-elements using typography's AST mutations", () => {
    expect(commonTrailingPseudos("p::before,a::before")).toEqual([
      "::before",
      "p,a",
    ]);
    expect(commonTrailingPseudos("p::before::marker,a::before::marker")).toEqual([
      "::before::marker",
      "p,a",
    ]);
  });
});
