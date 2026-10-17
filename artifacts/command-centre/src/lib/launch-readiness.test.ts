import { describe, it, expect } from "vitest";
import { deriveReadinessView } from "./launch-readiness";

const ok = {
  checkedAt: "2025-01-01T00:00:00Z",
  database: "available" as const,
  ai: "configured" as const,
  buildReady: true,
  message: "ok",
  deferred: ["Upgrade X"],
};

describe("deriveReadinessView", () => {
  it("shows ready when current request succeeds", () => {
    const v = deriveReadinessView(ok, false, false);
    expect(v.overall).toBe("ready");
    expect(v.database.tone).toBe("good");
    expect(v.deferred).toEqual(["Upgrade X"]);
  });
  it("never retains green when the current request errors", () => {
    const v = deriveReadinessView(ok, true, false);
    expect(v.overall).toBe("unknown");
    expect(v.database.tone).toBe("unknown");
    expect(v.ai.tone).toBe("unknown");
  });
  it("distinguishes unavailable from unknown", () => {
    const v = deriveReadinessView({ ...ok, database: "unavailable", buildReady: false }, false, false);
    expect(v.overall).toBe("not_ready");
    expect(v.database.label).toBe("UNAVAILABLE");
  });
  it("is checking while first load is pending", () => {
    expect(deriveReadinessView(undefined, false, true).overall).toBe("checking");
  });
});
