import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

function palette(selector: string) {
  const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%;/g)]
      .map(([, name, h, s, l]) => [name, [Number(h), Number(s) / 100, Number(l) / 100]]),
  ) as Record<string, number[]>;
}

function luminance([h, s, l]: number[]) {
  const a = s * Math.min(l, 1 - l);
  const rgb = [0, 8, 4].map(n => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(first: number[], second: number[]) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const selector of [":root", ".dark"]) {
  describe(`${selector} shared palette`, () => {
    const colors = palette(selector);
    for (const surface of ["background", "card", "popover", "muted", "accent", "sidebar", "sidebar-accent", "primary", "secondary", "destructive", "sidebar-primary"]) {
      const text = surface === "background" ? "foreground" : `${surface}-foreground`;
      it(`${text} has at least 4.5:1 contrast on ${surface}`, () => {
        expect(contrast(colors[text], colors[surface])).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const surface of ["background", "card", "popover", "muted", "accent"]) {
      it(`primary labels have 4.5:1 contrast on ${surface}`, () => {
        expect(contrast(colors.primary, colors[surface])).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const surface of ["background", "card"]) {
      for (const indicator of ["ring", "input"]) {
        it(`${indicator} has at least 3:1 contrast on ${surface}`, () => {
          expect(contrast(colors[indicator], colors[surface])).toBeGreaterThanOrEqual(3);
        });
      }
    }
  });
}

it("provides a keyboard focus outline and respects reduced-motion preferences", () => {
  expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  expect(css).toMatch(/animation-iteration-count: 1 !important/);
  expect(css).toMatch(/scroll-behavior: auto !important/);
});
