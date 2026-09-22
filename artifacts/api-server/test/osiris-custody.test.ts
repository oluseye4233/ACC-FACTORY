import { describe, expect, test } from "vitest";
import { custodyAttestationStatus } from "../src/lib/osiris";

describe("OSIRIS custody attestation gate", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  test("fails closed when no custody is registered", () => {
    expect(custodyAttestationStatus(undefined, now)).toEqual({
      active: false,
      reason: "NOT_REGISTERED",
    });
  });

  test("blocks lost and expired custody", () => {
    expect(
      custodyAttestationStatus(
        { custodyState: "lost", expiresAt: new Date("2026-01-02T00:00:00.000Z") },
        now,
      ).active,
    ).toBe(false);
    expect(
      custodyAttestationStatus(
        { custodyState: "active", expiresAt: new Date("2025-12-31T23:59:59.000Z") },
        now,
      ).active,
    ).toBe(false);
  });

  test("allows active, unexpired custody", () => {
    expect(
      custodyAttestationStatus(
        { custodyState: "active", expiresAt: new Date("2026-01-02T00:00:00.000Z") },
        now,
      ),
    ).toEqual({ active: true });
  });
});