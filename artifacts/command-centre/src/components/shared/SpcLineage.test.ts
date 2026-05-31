import { describe, it, expect } from "vitest";
import type { HarnessArtifact } from "@workspace/api-client-react";
import { computeLineage } from "./SpcLineage";

function art(
  id: string,
  featureId: number,
  createdAt: string,
  extra: Partial<HarnessArtifact> = {},
): HarnessArtifact {
  return {
    id,
    sessionId: "s1",
    featureId,
    artifactType: "SPC",
    artifactContent: {},
    createdAt: new Date(createdAt),
    ...extra,
  } as HarnessArtifact;
}

describe("computeLineage", () => {
  it("anchors the chain to the target SPC's timestamp across reruns", () => {
    // A session with an older full run (F1–F5) plus a newer rerun of F1–F4
    // that happened AFTER the chosen SPC. The chain for the older SPC must
    // use the older upstream artifacts, not the newer rerun ones.
    const artifacts: HarnessArtifact[] = [
      art("f1-old", 1, "2026-01-01T00:00:00Z"),
      art("f2-old", 2, "2026-01-01T01:00:00Z"),
      art("f3-old", 3, "2026-01-01T02:00:00Z"),
      art("f4-old", 4, "2026-01-01T03:00:00Z"),
      art("spc-old", 5, "2026-01-01T04:00:00Z"),
      // newer rerun upstream, created after the chosen SPC
      art("f1-new", 1, "2026-02-01T00:00:00Z"),
      art("f2-new", 2, "2026-02-01T01:00:00Z"),
      art("f3-new", 3, "2026-02-01T02:00:00Z"),
      art("f4-new", 4, "2026-02-01T03:00:00Z"),
    ];

    const stages = computeLineage(artifacts, "spc-old");
    expect(stages.map((s) => s.artifact?.id)).toEqual([
      "f1-old",
      "f2-old",
      "f3-old",
      "f4-old",
      "spc-old",
    ]);
  });

  it("uses the exact target for the SPC stage even if a later SPC exists", () => {
    const artifacts: HarnessArtifact[] = [
      art("f1", 1, "2026-01-01T00:00:00Z"),
      art("spc-a", 5, "2026-01-01T04:00:00Z"),
      art("spc-b", 5, "2026-01-02T04:00:00Z"),
    ];
    const stages = computeLineage(artifacts, "spc-a");
    expect(stages[4]?.artifact?.id).toBe("spc-a");
  });

  it("falls back to session-global latest per stage with no target", () => {
    const artifacts: HarnessArtifact[] = [
      art("f1-old", 1, "2026-01-01T00:00:00Z"),
      art("f1-new", 1, "2026-02-01T00:00:00Z"),
    ];
    const stages = computeLineage(artifacts);
    expect(stages[0]?.artifact?.id).toBe("f1-new");
    expect(stages[1]?.artifact).toBeNull();
  });

  it("labels stages with engine names", () => {
    const stages = computeLineage([], undefined);
    expect(stages.map((s) => s.engineName)).toEqual([
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
    ]);
  });
});
