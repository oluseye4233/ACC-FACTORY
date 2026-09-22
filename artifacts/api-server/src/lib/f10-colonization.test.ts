import { describe, expect, it } from "vitest";
import { evaluateColonization, type ColonizationInput } from "./f10-colonization";

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