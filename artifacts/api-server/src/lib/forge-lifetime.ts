import { and, eq } from "drizzle-orm";
import { db, learningInvitationsTable as invites, type Subscriber } from "@workspace/db";

/**
 * Accepted, server-issued trainee invitations are the durable grant record.
 * Deliberately independent of cohort end dates, completion, membership state,
 * billing flags and Stripe events. Issued/revoked/expired invitations grant nothing.
 */
export async function hasForgeLifetimePractitioner(
  userId: string,
  reader: Pick<typeof db, "select"> = db,
): Promise<boolean> {
  const [grant] = await reader.select({ id: invites.id }).from(invites).where(and(
    eq(invites.acceptedUserId, userId),
    eq(invites.state, "ACCEPTED"),
    eq(invites.role, "STUDENT"),
  )).limit(1);
  return Boolean(grant);
}

/** An entitlement floor, not a payment subscription or an administrative role. */
export function applyForgePractitioner(subscriber: Subscriber, granted: boolean): Subscriber {
  return granted && subscriber.tier === "EXPLORER"
    ? { ...subscriber, tier: "PRACTITIONER" }
    : subscriber;
}
