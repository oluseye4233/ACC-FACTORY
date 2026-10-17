import { describe, expect, it } from "vitest";
import { evaluateSprintEligibility, SPRINT_POLICY_VERSION } from "../src/lib/short-sprint-eligibility";
const hash = "a".repeat(64);
const measured = (value: number | boolean) => ({ value, evidenceHash: hash });
const input = () => ({
  circuit: "SC_ONE", target: "SOFTWARE", profile: "STANDARD",
  sourceArtifactHash: hash,
  facts: {
    sourceStageCertified: measured(true), regulatedTracksAdded: measured(true), toolPermissionsDeclared: measured(true),
    atomicPromptCount: measured(3), toolCount: measured(1), buildElapsedMinutes: measured(90),
    interfaceContractPresent: measured(true), hasCodebase: measured(false), openCriticalCount: measured(0),
    f2Certified: measured(true), jsonIoContractsValid: measured(true),
    hostDeployableByConfiguration: measured(true), singleAgent: measured(true),
  },
});
describe("derived SHORT SPRINTS eligibility ruling", () => {
  it("accepts exactly 90 minutes structurally without clearing a release", () => {
    const result = evaluateSprintEligibility(input());
    expect(result).toMatchObject({ state: "ELIGIBLE", policyVersion: SPRINT_POLICY_VERSION, releaseAllowed: false });
    expect(result.requiredPostStages).toEqual(["F9.5", "F10", "F11", "F12"]);
  });
  it("rejects 90+ minutes without blocking the full route", () => {
    const data = input(); data.facts.buildElapsedMinutes = measured(90.001);
    const result = evaluateSprintEligibility(data);
    expect(result.state).toBe("INELIGIBLE");
    expect(result.results.find((r) => r.id === "BUILD_TIME_LIMIT")?.remedy).toContain("Continue to F5");
  });
  it("keeps unknown duration or missing provenance inconclusive", () => {
    for (const observation of [{ value: null, evidenceHash: null }, { value: 45, evidenceHash: null }]) {
      const data = input();
      const result = evaluateSprintEligibility({ ...data, facts: { ...data.facts, buildElapsedMinutes: observation } });
      expect(result.state).toBe("INCONCLUSIVE");
      expect(result.releaseAllowed).toBe(false);
    }
  });
  it.each([
    ["atomicPromptCount", 4], ["toolCount", 2], ["interfaceContractPresent", false],
    ["hasCodebase", true], ["openCriticalCount", 1],
  ])("fails the %s limit", (field, value) => {
    const data = input();
    expect(evaluateSprintEligibility({ ...data, facts: { ...data.facts, [field]: measured(value) } }).state).toBe("INELIGIBLE");
  });
  it("SC TWO has no 90-minute ceiling, but requires certified configuration facts", () => {
    const data = input(); data.circuit = "SC_TWO"; data.facts.buildElapsedMinutes = measured(500);
    expect(evaluateSprintEligibility(data).state).toBe("ELIGIBLE");
    data.facts.jsonIoContractsValid = measured(false);
    expect(evaluateSprintEligibility(data).state).toBe("INELIGIBLE");
  });
  it("retains MECHA for firmware and H/C for regulated work", () => {
    const data = input(); data.target = "FIRMWARE"; data.profile = "REGULATED";
    const result = evaluateSprintEligibility(data);
    expect(result.requiredPostStages).toEqual(["F9", "F9.5", "F10", "F11", "F12"]);
    expect(result.additionalRegulatedTracks).toEqual(["H", "C"]);
  });
  it("changes the eligibility digest when evidence changes", () => {
    const a = input(); const b = input(); b.facts.toolCount.evidenceHash = "b".repeat(64);
    expect(evaluateSprintEligibility(a).eligibilityHash).not.toBe(evaluateSprintEligibility(b).eligibilityHash);
  });
  it("rejects forged release status and invalid counts", () => {
    expect(() => evaluateSprintEligibility({ ...input(), releaseAllowed: true })).toThrow();
    const data = input(); data.facts.atomicPromptCount = measured(-1);
    expect(() => evaluateSprintEligibility(data)).toThrow();
  });
  it("does not qualify a structurally suitable but uncertified source stage", () => {
    const data = input();
    const unverified = { ...data, facts: { ...data.facts, sourceStageCertified: { value: null, evidenceHash: null } } };
    expect(evaluateSprintEligibility(unverified).state).toBe("INCONCLUSIVE");
    data.facts.sourceStageCertified = measured(false);
    expect(evaluateSprintEligibility(data).state).toBe("INELIGIBLE");
  });
  it("requires both governed H and C track inclusion for Regulated eligibility", () => {
    const data = input(); data.profile = "REGULATED"; data.facts.regulatedTracksAdded = measured(false);
    expect(evaluateSprintEligibility(data).state).toBe("INELIGIBLE");
    expect(evaluateSprintEligibility({ ...data, facts: { ...data.facts, regulatedTracksAdded: { value: null, evidenceHash: null } } }).state).toBe("INCONCLUSIVE");
  });
  it("requires SC TWO tool permission declarations", () => {
    const data = input(); data.circuit = "SC_TWO"; data.facts.toolPermissionsDeclared = measured(false);
    expect(evaluateSprintEligibility(data).state).toBe("INELIGIBLE");
  });
  it("binds assessment hashes to the selected source version even for unknown facts", () => {
    const data = input();
    expect(evaluateSprintEligibility({ ...data, sourceArtifactHash: "b".repeat(64) }).eligibilityHash)
      .not.toBe(evaluateSprintEligibility(data).eligibilityHash);
  });
  it("never qualifies without a selected source version even when all asserted facts look positive", () => {
    const result = evaluateSprintEligibility({ ...input(), sourceArtifactHash: null });
    expect(result.state).toBe("INCONCLUSIVE");
    expect(result.results.find((r) => r.id === "SOURCE_VERSION_BOUND")?.status).toBe("UNKNOWN");
  });
});
