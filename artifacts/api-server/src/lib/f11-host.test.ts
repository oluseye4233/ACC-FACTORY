import { describe, expect, it } from "vitest";
import {
  buildUcgHostEvidence,
  checkF11ProviderAdapter,
  f11StageWriteHash,
  getF11ProviderAdapter,
  validateF11HumanAttestations,
  validateF11VaultHandle,
} from "./f11-host";

describe("F11 provider onboarding", () => {
  it("does not qualify an adapter until its execution lift is explicitly released", () => {
    const adapter = getF11ProviderAdapter("replit-deployments")!;
    const readiness = checkF11ProviderAdapter(adapter);
    expect(readiness.onboardingPassed).toBe(true);
    expect(readiness.qualified).toBe(false);
    expect(readiness.checks.executionLift.passed).toBe(false);
  });

  it("rejects unknown providers", () => {
    expect(getF11ProviderAdapter("unknown")).toBeNull();
  });
});

describe("F11 consent and evidence gates", () => {
  const write = {
    source: "F8_BUNDLE" as const,
    planArtifactId: "plan",
    sourceArtifactId: "bundle",
    provider: "replit-deployments",
    accountRef: "acct-1",
    region: "us-east",
    exactContentHash: `sha256:${"a".repeat(64)}`,
    costCeilingCents: 1000,
    deploymentSubject: "staging:session:run",
    rollbackPlan: "restore previous immutable version",
  };

  it("hashes the exact stage write deterministically", () => {
    expect(f11StageWriteHash(write)).toBe(f11StageWriteHash({ ...write }));
  });

  it("requires an unexpired handle scoped to the exact deployment", () => {
    const base = {
      handle: "vault-handle:opaque_reference_1234",
      scope: "F11_STAGE" as const,
      deploymentSubject: write.deploymentSubject,
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
    expect(validateF11VaultHandle(base, "F11_STAGE", write.deploymentSubject)).toMatchObject({ ok: true });
    expect(validateF11VaultHandle({ ...base, scope: "F11_PROMOTION" }, "F11_STAGE", write.deploymentSubject)).toMatchObject({ ok: false });
  });

  it("requires distinct human attestations and UCG-HOST roles", () => {
    expect(validateF11HumanAttestations([
      { attestationId: "a", actorId: "one", statement: "reviewed" },
      { attestationId: "b", actorId: "two", statement: "approved" },
    ])).toEqual({ ok: true });
    expect(() => buildUcgHostEvidence({
      hostRunId: "run",
      exactContentHash: write.exactContentHash,
      stageEvidence: { smoke: true },
      authorId: "same",
      scorerId: "same",
      adjudicatorId: "third",
    })).toThrow("distinct");
  });
});