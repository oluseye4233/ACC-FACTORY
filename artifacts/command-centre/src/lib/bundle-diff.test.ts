import { describe, expect, it } from "vitest";
import { bundleChanges, bundleFiles, lineChanges } from "./bundle-diff";

describe("F8 file evidence comparison", () => {
  it("retains exact paths and distinguishes added, removed, changed and unchanged files", () => {
    expect(bundleChanges([{ path: "gone", content: "old" }, { path: "same", content: "a" }, { path: "changed", content: "b" }],
      [{ path: "new", content: "x" }, { path: "same", content: "a" }, { path: "changed", content: "c" }])
      .map(f => [f.path, f.status])).toEqual([["changed", "changed"], ["gone", "removed"], ["new", "added"], ["same", "unchanged"]]);
  });
  it("renders exact line changes including blank lines and HTML as plain text", () => {
    expect(lineChanges("a\n<script>\n", "a\nfixed\n").lines).toEqual([
      { kind: "same", text: "a" }, { kind: "removed", text: "<script>" },
      { kind: "added", text: "fixed" }, { kind: "same", text: "" },
    ]);
  });
  it("bounds computation without silently omitting large file content", () => {
    const result = lineChanges("x\n".repeat(600), "y\n".repeat(600));
    expect(result.fullReplacement).toBe(true); expect(result.lines).toHaveLength(1202);
  });
  it("rejects invalid or duplicate file records instead of guessing", () => {
    expect(bundleFiles({ files: [{ path: "x" }] })).toBeNull();
    expect(bundleFiles({ files: [{ path: "x", content: "a" }, { path: "x", content: "b" }] })).toBeNull();
    expect(bundleFiles({ files: [{ path: "x", content: "" }] })).toEqual([{ path: "x", content: "" }]);
  });
});
