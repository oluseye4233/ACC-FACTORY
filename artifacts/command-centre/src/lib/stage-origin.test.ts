import { describe, expect, it } from "vitest";
import { f0OriginHref, parseStageOrigin, sessionStageHref, spcPlayerOriginHref } from "./stage-origin";

describe("stage origin", () => {
  it("parses a valid origin", () => {
    const o = parseStageOrigin("?originSessionId=abc-123&originFeatureId=4");
    expect(o?.sessionId).toBe("abc-123");
    expect(o?.featureId).toBe(4);
    expect(o?.stageLabel).toBeTruthy();
  });
  it("rejects unsafe or missing values", () => {
    expect(parseStageOrigin("?originSessionId=a/../b&originFeatureId=4")).toBeNull();
    expect(parseStageOrigin("?originSessionId=abc&originFeatureId=99")).toBeNull();
    expect(parseStageOrigin("?originFeatureId=4")).toBeNull();
  });
  it("builds hrefs", () => {
    expect(sessionStageHref("s1", 4)).toBe("/session/s1?featureId=4#stage-optional-tools");
    expect(f0OriginHref("s1", 4)).toBe("/f0?originSessionId=s1&originFeatureId=4");
    expect(spcPlayerOriginHref("s1", 4)).toBe("/spc-player/new?sourceSessionId=s1&originFeatureId=4");
  });
});
