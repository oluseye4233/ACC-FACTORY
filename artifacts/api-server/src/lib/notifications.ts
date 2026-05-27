import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  notificationPreferencesTable,
  organizationMembersTable,
  organizationsTable,
  usersTable,
  type NotificationPreference,
} from "@workspace/db";
import { logger } from "./logger";

function newToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Returns the user's preferences for a given scope (orgId or null for personal),
 * creating a default row with a fresh unsubscribe token on first read.
 */
export async function getOrCreatePreferences(
  userId: string,
  orgId: string | null,
): Promise<NotificationPreference> {
  const where = orgId
    ? and(
        eq(notificationPreferencesTable.userId, userId),
        eq(notificationPreferencesTable.organizationId, orgId),
      )
    : and(
        eq(notificationPreferencesTable.userId, userId),
        isNull(notificationPreferencesTable.organizationId),
      );
  const existing = await db.select().from(notificationPreferencesTable).where(where).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(notificationPreferencesTable)
    .values({
      userId,
      organizationId: orgId,
      unsubscribeToken: newToken(),
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  // Conflict path: race lost — re-read.
  const reread = await db.select().from(notificationPreferencesTable).where(where).limit(1);
  return reread[0]!;
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
}

export function unsubscribeUrl(token: string): string {
  return `${publicBaseUrl()}/api/notifications/unsubscribe/${token}`;
}

export function activityUrl(orgId: string | null): string {
  return orgId ? `${publicBaseUrl()}/orgs/${orgId}/activity` : `${publicBaseUrl()}/activity`;
}

export function billingUrl(orgId: string | null): string {
  return orgId ? `${publicBaseUrl()}/orgs/${orgId}/billing` : `${publicBaseUrl()}/billing`;
}

export interface OwnerAdminContact {
  userId: string;
  email: string;
  orgId: string;
  orgName: string;
  prefs: NotificationPreference;
}

/**
 * Lookup all owner/admin members of the given orgs that have an email, joined to
 * their notification_preferences row (creating it lazily if missing).
 */
export async function ownerAdminContactsForOrg(orgId: string): Promise<OwnerAdminContact[]> {
  const rows = await db
    .select({
      userId: usersTable.id,
      email: usersTable.email,
      orgId: organizationsTable.id,
      orgName: organizationsTable.name,
    })
    .from(organizationMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
    .innerJoin(
      organizationsTable,
      eq(organizationsTable.id, organizationMembersTable.organizationId),
    )
    .where(
      and(
        eq(organizationMembersTable.organizationId, orgId),
        sql`${organizationMembersTable.role} IN ('owner','admin')`,
      ),
    );
  const out: OwnerAdminContact[] = [];
  for (const r of rows) {
    if (!r.email) continue;
    const prefs = await getOrCreatePreferences(r.userId, r.orgId);
    out.push({
      userId: r.userId,
      email: r.email,
      orgId: r.orgId,
      orgName: r.orgName,
      prefs,
    });
  }
  return out;
}

/**
 * Lookup owner/admin contacts for a Stripe customer that may belong to an
 * organization. Returns [] if the customer is not on an org row.
 */
export async function ownerAdminContactsForStripeCustomer(
  customerId: string,
): Promise<OwnerAdminContact[]> {
  const rows = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.stripeCustomerId, customerId))
    .limit(1);
  const org = rows[0];
  if (!org) return [];
  return ownerAdminContactsForOrg(org.id);
}

/**
 * Fire-and-forget wrapper: never throws, always logs.
 */
export async function safeFire(label: string, p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch (err) {
    logger.warn({ err, label }, "notification dispatch failed");
  }
}
