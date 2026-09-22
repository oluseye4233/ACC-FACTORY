// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { F9MachineFloor } from "./F9MachineFloor";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGet(...args), post: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const artifacts = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    sessionId: "33333333-3333-4333-8333-333333333333",
    userId: "44444444-4444-4444-8444-444444444444",
    featureId: 7,
    artifactType: "MVP_PDD",
    artifactContent: {},
    spartanCert: { verdict: "PASS" },
    createdAt: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    sessionId: "33333333-3333-4333-8333-333333333333",
    userId: "44444444-4444-4444-8444-444444444444",
    featureId: 8,
    artifactType: "CODEBASE_BUNDLE",
    artifactContent: {},
    createdAt: "2026-09-20T11:00:00.000Z",
  },
] as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("F9MachineFloor persisted run reload", () => {
  it("displays persisted identity, gate evidence, hash, and signature after refresh", async () => {
    apiGet.mockResolvedValue([{
      mechaRunId: "MECHA-F9-persisted-emission",
      status: "EMITTED",
      phase: 7,
      evidence: [
        { phase: 1, evidence: { target_profile: "FIRMWARE_MCU" } },
        { phase: 2, evidence: { candidates: ["cutout"] } },
        { phase: 3, evidence: { hazard_class: "NON_SAFETY_RELATED" } },
        { phase: 4, evidence: { fail_safe_default: "OPEN_CIRCUIT" } },
        { phase: 5, evidence: { mm_verdict: "MATH_VERIFIED" } },
        { phase: 6, evidence: { hold_ip: false } },
        { phase: 7, evidence: { osiris_custody: true } },
      ],
      refusal: null,
      artifactContent: {
        machine_artifact_id: "MA-F9-persisted",
        artifact_version: "1.0.0",
        payload_hash: "abc123hash",
        artifact_signature: "signed-value",
        spk_id: "SPK-F9-persisted",
        reverification_due: "2099-01-01T00:00:00.000Z",
      },
    }]);

    render(<F9MachineFloor sessionId="33333333-3333-4333-8333-333333333333" artifacts={artifacts} />);

    await waitFor(() => expect(screen.getByTestId("f9-run-identity").textContent).toContain("MECHA-F9-persisted-emission"));
    expect(screen.getByTestId("f9-phase-1").textContent).toContain("target_profile: FIRMWARE_MCU");
    expect(screen.getByTestId("f9-phase-7").textContent).toContain("osiris_custody: true");
    expect(screen.getByTestId("f9-artifact-payload_hash").textContent).toContain("abc123hash");
    expect(screen.getByTestId("f9-artifact-artifact_signature").textContent).toContain("signed-value");
  });

  it("displays persisted refusal citations after refresh", async () => {
    apiGet.mockResolvedValue([{
      mechaRunId: "MECHA-F9-persisted-refusal",
      status: "REFUSED",
      phase: 3,
      evidence: [
        { phase: 1, evidence: { target_profile: "FIRMWARE_MCU" } },
        { phase: 2, evidence: { candidates: [] } },
        { phase: 3, evidence: { hazard_class: "SAFETY_RELATED" } },
        { phase: 4, evidence: {} },
        { phase: 5, evidence: {} },
        { phase: 6, evidence: {} },
        { phase: 7, evidence: {} },
      ],
      artifactContent: null,
      refusal: {
        phase_halted: 3,
        constraint_cited: "C-MECHA-02",
        invariant_cited: "SPARTAN #21",
        cause: "The hazard classification is SAFETY_RELATED.",
        required_to_proceed: "Record an externally qualified reviewer.",
      },
    }]);

    render(<F9MachineFloor sessionId="33333333-3333-4333-8333-333333333333" artifacts={artifacts} />);

    await waitFor(() => expect(screen.getByTestId("f9-refusal")).toBeTruthy());
    expect(screen.getByTestId("f9-run-identity").textContent).toContain("MECHA-F9-persisted-refusal");
    expect(screen.getByTestId("f9-refusal").textContent).toContain("C-MECHA-02");
    expect(screen.getByTestId("f9-refusal").textContent).toContain("SPARTAN #21");
    expect(screen.getByTestId("f9-phase-3").textContent).toContain("SAFETY_RELATED");
  });
});