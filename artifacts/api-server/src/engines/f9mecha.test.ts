import { describe, expect, it } from "vitest";
import { artifactRequiresF9 } from "./f9mecha";

describe("F9 artifact routing", () => {
  it("skips F9 for explicitly classified Software bundles", () => {
    expect(artifactRequiresF9({ artifactClass: "SOFTWARE" })).toBe(false);
  });

  it("keeps Firmware and legacy bundles on the F9 path", () => {
    expect(artifactRequiresF9({ artifactClass: "FIRMWARE" })).toBe(true);
    expect(artifactRequiresF9({ platform: "react-vite-static" })).toBe(true);
  });
});