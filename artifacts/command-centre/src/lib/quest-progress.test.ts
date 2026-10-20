import { describe, expect, it } from "vitest";
import { questCompletion } from "./quest-progress";

describe("Quest requirement progress display", () => {
  it("uses the server's requirements and actual counts", () => {
    expect(questCompletion({ requirements: { spcs: 3, mas: 4 }, progress: { spcs: 2, mas: 1 } }))
      .toEqual({ percent: 42, requirements: [
        { key: "spcs", current: 2, target: 3 },
        { key: "mas", current: 1, target: 4 },
      ] });
  });

  it("never substitutes surplus artifacts for a missing category", () => {
    expect(questCompletion({ requirements: { atlas: 1, micro: 1, mvp: 1 }, progress: { atlas: 20 } }).percent)
      .toBe(33);
  });

  it("caps completion but keeps the actual counts for display", () => {
    expect(questCompletion({ requirements: { pwdds: 3 }, progress: { pwdds: 5 } }))
      .toEqual({ percent: 100, requirements: [{ key: "pwdds", current: 5, target: 3 }] });
  });

  it("does not round unfinished requirements up to 100%", () => {
    expect(questCompletion({ requirements: { work: 1000 }, progress: { work: 999 } }).percent).toBe(99);
  });

  it("shows unknown rather than full completion when requirements are absent or invalid", () => {
    for (const requirements of [{}, { work: 0 }, { work: -1 }, { work: NaN }, { work: Infinity }, { work: 1, other: 0 }]) {
      expect(questCompletion({ requirements, progress: { work: 99 } }).percent).toBeNull();
    }
  });

  it("does not count missing, negative or non-finite progress", () => {
    expect(questCompletion({
      requirements: { a: 1, b: 1, c: 1, d: 1 },
      progress: { b: -1, c: NaN, d: Infinity },
    }).percent).toBe(0);
  });
});
