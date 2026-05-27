import { describe, test, expect } from "vitest";
import { effectiveTier, type MembershipRow } from "../src/lib/orgs";
import type { SubscriberTier } from "@workspace/db";

function membership(status: string): MembershipRow {
  return {
    organizationId: "00000000-0000-0000-0000-000000000000",
    organizationName: "Acme",
    organizationSlug: "acme",
    role: "member",
    orgStatus: status,
    seatsPurchased: 5,
  };
}

describe("effectiveTier matrix", () => {
  const tiers: SubscriberTier[] = ["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"];

  test("no memberships → personal tier returned unchanged", () => {
    for (const t of tiers) {
      expect(effectiveTier(t, [])).toBe(t);
    }
  });

  test("inactive org memberships do not elevate", () => {
    for (const t of tiers) {
      expect(effectiveTier(t, [membership("canceled"), membership("inactive")])).toBe(t);
      expect(effectiveTier(t, [membership("past_due")])).toBe(t);
    }
  });

  test("an active or trialing org elevates to INSTITUTION when below", () => {
    expect(effectiveTier("EXPLORER", [membership("active")])).toBe("INSTITUTION");
    expect(effectiveTier("PRACTITIONER", [membership("trialing")])).toBe("INSTITUTION");
    expect(effectiveTier("ARCHITECT", [membership("active")])).toBe("INSTITUTION");
  });

  test("INSTITUTION stays INSTITUTION (never demoted)", () => {
    expect(effectiveTier("INSTITUTION", [membership("active")])).toBe("INSTITUTION");
    expect(effectiveTier("INSTITUTION", [])).toBe("INSTITUTION");
  });

  test("mixed memberships: any one active is enough", () => {
    expect(
      effectiveTier("EXPLORER", [
        membership("canceled"),
        membership("active"),
        membership("inactive"),
      ]),
    ).toBe("INSTITUTION");
  });
});
