import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  db, learningInvitationsTable as invites, learningMembershipsTable as members,
  learningAuditTable as audit, type Subscriber,
} from "@workspace/db";

export const FORGE_CERTIFICATION_ACTION = "FORGE_FIELD_ENGINEER_CERTIFIED";

/**
 * A completed course AND an issued FORGE certification unlock the lifetime grant.
 * Invitation acceptance or a bare COMPLETED state never establishes certification.
 * Issuance evidence is independent of cohort expiry, billing flags and Stripe events.
 */
export async function getForgeCertification(
  userId: string,
  reader: Pick<typeof db, "select"> = db,
  membershipId?: string,
) {
  const [certificate] = await reader.select({
    id: audit.id, membershipId: members.id, issuedAt: audit.createdAt, issuedBy: audit.actorId,
  }).from(audit)
    .innerJoin(members, and(eq(sql<string>`${members.id}::text`, audit.subjectId), eq(members.cohortId, audit.cohortId)))
    .innerJoin(invites, and(eq(invites.cohortId, members.cohortId), eq(invites.acceptedUserId, members.userId)))
    .where(and(
    eq(invites.acceptedUserId, userId),
    eq(invites.state, "ACCEPTED"),
    eq(invites.role, "STUDENT"),
    eq(members.userId, userId),
    eq(members.role, "STUDENT"),
    eq(members.state, "COMPLETED"),
    isNotNull(members.completedAt),
    eq(audit.action, FORGE_CERTIFICATION_ACTION),
    membershipId ? eq(members.id, membershipId) : undefined,
  )).limit(1);
  return certificate ? { ...certificate, title: "FORGE FIELD ENGINEER Certification" } : null;
}

export async function hasForgeLifetimePractitioner(userId: string, reader: Pick<typeof db, "select"> = db) {
  return Boolean(await getForgeCertification(userId, reader));
}

/** An entitlement floor, not a payment subscription or an administrative role. */
export function applyForgePractitioner(subscriber: Subscriber, granted: boolean): Subscriber {
  return granted && subscriber.tier === "EXPLORER"
    ? { ...subscriber, tier: "PRACTITIONER" }
    : subscriber;
}
