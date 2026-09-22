import { describe, expect, it } from "vitest";
import { colonizationWriteHash, evaluateColonization, evaluatePromotionGate, UCG_COL_APPROVED_THRESHOLD, type ColonizationInput } from "./f10-colonization";

const base: ColonizationInput = {
  requestClass: "RUN", artifactRef: "artifact-1", artifactHash: `sha256:${"a".repeat(64)}`,
  artifactClass: "SPC", ucgCertificateRef: "UCG-SPC-1", target: "runtime-1",
  targetClass: "SOFTWARE_PLATFORM", connectorAdapter: "target-adapter", consentChannel: "operator",
};

describe("SAVANT CONNECTOR fail-closed intake", () => {
  it("refuses software targets at C1 when external adapters are unwired", () => {
    const result = evaluateColonization(base);
    expect(result.state).toBe("REFUSED");
    expect(result.phase).toBe("C1");
    expect(result.refusal.constraintCited).toBe("C-SAVCON-12");
    expect(result.refusal.groMode).toBe("SAFE_LIFE");
    expect(result.adapterReadiness.savant).toBe("UNWIRED");
  });

  it("routes physical targets through the F9 guard at C0", () => {
    const result = evaluateColonization({ ...base, targetClass: "ROBOTICS", f9AttestationRef: null });
    expect(result.phase).toBe("C0");
    expect(result.refusal.constraintCited).toBe("C-SAVCON-10");
    expect(result.refusal.invariantCited).toBe("SPARTAN #25");
  });

  it("records the manual ceiling for agent-gateway targets", () => {
    const result = evaluateColonization({ ...base, targetClass: "AGENT_GATEWAY" });
    expect(result.maxReachablePhase).toBe("C4");
    expect(result.groMode).toBe("SAFE_LIFE");
  });

  it("refuses an explicitly invalid physical attestation without erasing its cause", () => {
    const result = evaluateColonization({ ...base, targetClass: "FIRMWARE", f9AttestationRef: "MECHA-F9-bad", f9AttestationValidated: false });
    expect(result.phase).toBe("C0");
    expect(result.refusal.cause).toContain("not a valid owned emitted artifact");
    expect(result.refusal.invariantCited).toBe("SPARTAN #25");
  });
});

describe("UCG-COL promotion gate", () => {
  const deploymentSubject = "production:tenant-1:service-1";
  const artifactHash = `sha256:${"b".repeat(64)}`;
  const certificate = {
    certificateRef: "UCG-COL-1", artifactHash, deploymentSubject, score: 0.97,
    threshold: UCG_COL_APPROVED_THRESHOLD, verdict: "PASS" as const, expiresAt: "2099-01-01T00:00:00.000Z",
  };
  const consent = {
    consentId: "c876b243-8d4a-4a0a-8acd-dc015c6a45aa", purpose: "PROMOTION" as const, deploymentSubject,
    exactWriteHash: colonizationWriteHash("PROMOTION", deploymentSubject, artifactHash),
  };
  const vaultHandle = { handle: "vault-handle:opaque_reference_1234", scope: "F10_PROMOTION" as const, deploymentSubject, expiresAt: "2099-01-01T00:00:00.000Z" };

  it("rejects replay of a consumed promotion consent", () => {
    expect(evaluatePromotionGate({ artifactHash, deploymentSubject, certificate, certificateAuthorityAvailable: true, consent, consumedConsentIds: new Set([consent.consentId]), vaultAvailable: true, vaultHandle })).toMatchObject({ ok: false, code: "CONSENT_REPLAY" });
  });

  it("rejects a certificate for the wrong deployment subject", () => {
    expect(evaluatePromotionGate({ artifactHash, deploymentSubject, certificate: { ...certificate, deploymentSubject: "production:other" }, certificateAuthorityAvailable: true, consent, vaultAvailable: true, vaultHandle })).toMatchObject({ ok: false, code: "WRONG_DEPLOYMENT_SUBJECT" });
  });

  it("rejects a certificate with no approved threshold", () => {
    expect(evaluatePromotionGate({ artifactHash, deploymentSubject, certificate: { ...certificate, threshold: Number.NaN }, certificateAuthorityAvailable: true, consent, vaultAvailable: true, vaultHandle })).toMatchObject({ ok: false, code: "MISSING_THRESHOLD" });
  });

  it("fails closed when Vault is unavailable", () => {
    expect(evaluatePromotionGate({ artifactHash, deploymentSubject, certificate, certificateAuthorityAvailable: true, consent, vaultAvailable: false, vaultHandle })).toMatchObject({ ok: false, code: "VAULT_UNAVAILABLE" });
  });

  it("accepts only a valid certificate, fresh exact-write consent, and opaque scoped Vault handle", () => {
    expect(evaluatePromotionGate({ artifactHash, deploymentSubject, certificate, certificateAuthorityAvailable: true, consent, vaultAvailable: true, vaultHandle })).toEqual({ ok: true });
  });
});