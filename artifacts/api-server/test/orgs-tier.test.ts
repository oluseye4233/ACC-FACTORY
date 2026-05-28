import { describe, test, expect } from "vitest";
import { effectiveTier, type MembershipRow } from "../src/lib/orgs";
import type { OrgPlan, SubscriberTier } from "@workspace/db";

function membership(status: string, plan: OrgPlan = "team"): MembershipRow {
  return {
    organizationId: "00000000-0000-0000-0000-000000000000",
    organizationName: "Acme",
    organizationSlug: "acme",
    role: "member",
    orgStatus: status,
    seatsPurchased: 5,
    plan,
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

  test("team_lite plan elevates to ARCHITECT, not INSTITUTION", () => {
    expect(effectiveTier("EXPLORER", [membership("active", "team_lite")])).toBe("ARCHITECT");
    expect(effectiveTier("PRACTITIONER", [membership("trialing", "team_lite")])).toBe("ARCHITECT");
    // Personal ARCHITECT stays ARCHITECT (no demotion, no elevation).
    expect(effectiveTier("ARCHITECT", [membership("active", "team_lite")])).toBe("ARCHITECT");
    // Personal INSTITUTION outranks a team_lite membership.
    expect(effectiveTier("INSTITUTION", [membership("active", "team_lite")])).toBe("INSTITUTION");
  });

  test("max-rank across mixed plans: team beats team_lite", () => {
    expect(
      effectiveTier("EXPLORER", [
        membership("active", "team_lite"),
        membership("active", "team"),
      ]),
    ).toBe("INSTITUTION");
  });

  test("unknown plan value confers no elevation (fail-closed)", () => {
    const bad = { ...membership("active"), plan: "bogus" as OrgPlan };
    expect(effectiveTier("EXPLORER", [bad])).toBe("EXPLORER");
  });
});
