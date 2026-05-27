import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  organizationsTable,
  organizationMembersTable,
} from "@workspace/db";
import { memberRole, ownerCount, loadMembershipsForUser, effectiveTier } from "../src/lib/orgs";

let userAId = "";
let userBId = "";
let orgId = "";
const aEmail = `last-owner-a-${Date.now()}@example.test`;
const bEmail = `last-owner-b-${Date.now()}@example.test`;

beforeAll(async () => {
  const [a] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_lo_a_${randomUUID()}`, email: aEmail })
    .returning();
  const [b] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_lo_b_${randomUUID()}`, email: bEmail })
    .returning();
  userAId = a!.id;
  userBId = b!.id;
  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: userAId, email: aEmail, tier: "EXPLORER" });
  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: userBId, email: bEmail, tier: "PRACTITIONER" });
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: "Acme Test", slug: `acme-lo-${Date.now()}`, createdByUserId: userAId })
    .returning();
  orgId = org!.id;
  await db
    .insert(organizationMembersTable)
    .values({ organizationId: orgId, userId: userAId, role: "owner" });
  await db
    .insert(organizationMembersTable)
    .values({ organizationId: orgId, userId: userBId, role: "member" });
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${userAId}, ${userBId})`);
});

describe("orgs helpers — last-owner protection", () => {
  test("memberRole returns the correct role", async () => {
    expect(await memberRole(userAId, orgId)).toBe("owner");
    expect(await memberRole(userBId, orgId)).toBe("member");
    expect(await memberRole(randomUUID(), orgId)).toBeNull();
  });

  test("ownerCount === 1 on a single-owner org", async () => {
    expect(await ownerCount(orgId)).toBe(1);
  });

  test("ownerCount === 2 after promoting another member", async () => {
    await db.execute(
      sql`UPDATE organization_members SET role='owner' WHERE organization_id=${orgId} AND user_id=${userBId}`,
    );
    expect(await ownerCount(orgId)).toBe(2);
    await db.execute(
      sql`UPDATE organization_members SET role='member' WHERE organization_id=${orgId} AND user_id=${userBId}`,
    );
  });

  test("loadMembershipsForUser returns the org with its status", async () => {
    const m = await loadMembershipsForUser(userAId);
    expect(m.length).toBeGreaterThanOrEqual(1);
    const row = m.find((x) => x.organizationId === orgId)!;
    expect(row.role).toBe("owner");
    expect(row.orgStatus).toBe("inactive");
  });

  test("effectiveTier does NOT elevate for inactive org membership", async () => {
    const m = await loadMembershipsForUser(userAId);
    expect(effectiveTier("EXPLORER", m)).toBe("EXPLORER");
  });

  test("effectiveTier elevates to INSTITUTION once org sub becomes active", async () => {
    await db.execute(sql`UPDATE organizations SET status='active' WHERE id=${orgId}`);
    const m = await loadMembershipsForUser(userAId);
    expect(effectiveTier("EXPLORER", m)).toBe("INSTITUTION");
    expect(effectiveTier("PRACTITIONER", m)).toBe("INSTITUTION");
    await db.execute(sql`UPDATE organizations SET status='inactive' WHERE id=${orgId}`);
  });
});
