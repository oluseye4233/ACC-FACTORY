import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  organizationMembersTable,
  organizationsTable,
  type OrgMemberRole,
  type Organization,
  type SubscriberTier,
} from "@workspace/db";

const TIER_RANK: Record<SubscriberTier, number> = {
  EXPLORER: 0,
  PRACTITIONER: 1,
  ARCHITECT: 2,
  INSTITUTION: 3,
};

export interface MembershipRow {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrgMemberRole;
  orgStatus: string;
  seatsPurchased: number;
}

/**
 * Loads every org the user belongs to with the org's current sub status.
 * Used both for tier elevation and for listing the user's orgs.
 */
export async function loadMembershipsForUser(userId: string): Promise<MembershipRow[]> {
  const rows = await db
    .select({
      organizationId: organizationsTable.id,
      organizationName: organizationsTable.name,
      organizationSlug: organizationsTable.slug,
      role: organizationMembersTable.role,
      orgStatus: organizationsTable.status,
      seatsPurchased: organizationsTable.seatsPurchased,
    })
    .from(organizationMembersTable)
    .innerJoin(
      organizationsTable,
      eq(organizationsTable.id, organizationMembersTable.organizationId),
    )
    .where(eq(organizationMembersTable.userId, userId))
    .orderBy(organizationsTable.name);
  return rows as MembershipRow[];
}

/**
 * Effective tier = max(personalTier, INSTITUTION-if-in-any-active-team-org).
 * An "active" team org is one with sub status in {active, trialing}.
 */
export function effectiveTier(
  personalTier: SubscriberTier,
  memberships: MembershipRow[],
): SubscriberTier {
  const orgElevation = memberships.some(
    (m) => m.orgStatus === "active" || m.orgStatus === "trialing",
  );
  if (!orgElevation) return personalTier;
  return TIER_RANK[personalTier] >= TIER_RANK["INSTITUTION"]
    ? personalTier
    : "INSTITUTION";
}

/**
 * Returns the user's role in the org, or null if they are not a member.
 */
export async function memberRole(
  userId: string,
  organizationId: string,
): Promise<OrgMemberRole | null> {
  const rows = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.userId, userId),
        eq(organizationMembersTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  return (rows[0]?.role as OrgMemberRole | undefined) ?? null;
}

/**
 * Counts how many owners an org has. Used to refuse demotion/removal of the last owner.
 */
export async function ownerCount(organizationId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<string>`COUNT(*)` })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.organizationId, organizationId),
        eq(organizationMembersTable.role, "owner"),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Lookup an org by stripe_customer_id, used by the webhook handler.
 */
export async function orgForStripeCustomer(
  customerId: string,
): Promise<Organization | null> {
  const rows = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.stripeCustomerId, customerId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns the user ids of every member of the given orgs. Used by the org-visible
 * session-listing path.
 */
export async function memberUserIdsForOrgs(orgIds: string[]): Promise<string[]> {
  if (orgIds.length === 0) return [];
  const rows = await db
    .select({ userId: organizationMembersTable.userId })
    .from(organizationMembersTable)
    .where(inArray(organizationMembersTable.organizationId, orgIds));
  const set = new Set<string>();
  for (const r of rows) set.add(r.userId);
  return Array.from(set);
}
