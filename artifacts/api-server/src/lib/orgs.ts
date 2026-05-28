import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  organizationMembersTable,
  organizationsTable,
  type OrgMemberRole,
  type OrgPlan,
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
  plan: OrgPlan;
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
      plan: organizationsTable.plan,
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
 * Effective tier = max(personalTier, best-of(active org elevations)).
 *
 * Each active org membership confers a tier based on the org's plan:
 *   - plan = 'team'      → INSTITUTION (unlimited everything, incl. F8)
 *   - plan = 'team_lite' → ARCHITECT   (unlimited F1–F7, F8 capped at 2/day)
 *
 * "Active" means org sub status in {active, trialing}. The user always
 * benefits from the highest-ranked tier across their personal tier + every
 * active membership.
 */
export function effectiveTier(
  personalTier: SubscriberTier,
  memberships: MembershipRow[],
): SubscriberTier {
  let best: SubscriberTier = personalTier;
  for (const m of memberships) {
    if (m.orgStatus !== "active" && m.orgStatus !== "trialing") continue;
    // Whitelist plan → conferred tier. Unknown plan values confer NO elevation
    // (fail-closed) so an out-of-band bad write to organizations.plan can never
    // silently over-elevate a member to INSTITUTION.
    let conferred: SubscriberTier | null = null;
    if (m.plan === "team") conferred = "INSTITUTION";
    else if (m.plan === "team_lite") conferred = "ARCHITECT";
    if (conferred && TIER_RANK[conferred] > TIER_RANK[best]) best = conferred;
  }
  return best;
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
