import { describe, expect, it } from "vitest";
import { harnessArtifactsTable } from "@workspace/db";
import { recommendArtifactRework } from "./boomerang-remediation";
type Artifact = typeof harnessArtifactsTable.$inferSelect;
const artifact = { id: "source", name: "Example", artifactType: "SPC", artifactContent: {}, scorecards: [],
  jcseScore: 45, mathmonScore: 70 } as unknown as Artifact;
describe("score-driven Boomerang remediation", () => {
  it("does not trigger at the exact passing boundaries or invent missing scores", () => {
    expect(recommendArtifactRework(artifact, "session", "F5").reingestionRequired).toBe(false);
    expect(recommendArtifactRework({ ...artifact, jcseScore: null, mathmonScore: null }, "session", "F5")).toMatchObject({
      status: "NO_LOW_SCORE", jcseScore: null, mathmonScore: null, reingestionRequired: false,
    });
    expect(recommendArtifactRework(undefined, "session", "F5").status).toBe("NO_STAGE_ARTIFACT");
  });
  it("triggers from either low score and binds exact feedback into a required re-ingestion brief", () => {
    for (const values of [{ jcseScore: 44, mathmonScore: null }, { jcseScore: null, mathmonScore: 69 }]) {
      const result = recommendArtifactRework({ ...artifact, ...values, scorecards: [{ actions: ["Document the input assumptions"] }] }, "session", "F5");
      expect(result.reingestionRequired).toBe(true);
      expect(result.status).toBe("REWORK_RECOMMENDED");
      expect(result.brief).toContain("Document the input assumptions");
      expect(result.brief).toContain("Ingestion (F1)");
      expect(result.brief).toContain("new internal evaluation");
    }
  });
  it("changes the evidence fingerprint when score, feedback or source changes", () => {
    const baseline = recommendArtifactRework({ ...artifact, jcseScore: 40 }, "session", "F5");
    for (const change of [{ jcseScore: 41 }, { artifactContent: { change: true } }, { scorecards: [{ recommendation: "Revise" }] }]) {
      expect(recommendArtifactRework({ ...artifact, jcseScore: 40, ...change }, "session", "F5").sourceHash).not.toBe(baseline.sourceHash);
    }
  });
});
