import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import {
  db,
  f10BundleDeploymentsTable,
  notificationPreferencesTable,
  organizationMembersTable,
  organizationsTable,
  usersTable,
  type NotificationPreference,
} from "@workspace/db";
import { sendF10ReconciliationPaused } from "@workspace/email";
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

export async function notifyF10ReconciliationPaused(args: {
  deploymentId: string;
  ownerUserId: string;
  provider: string;
  target: string;
  reason: string;
  pausedAt: Date;
}): Promise<boolean> {
  const claimedAt = new Date();
  const expiredClaimBefore = new Date(claimedAt.getTime() - 10 * 60_000);
  try {
    const [claimed] = await db
      .update(f10BundleDeploymentsTable)
      .set({ reconciliationPauseNotificationClaimedAt: claimedAt })
      .where(and(
        eq(f10BundleDeploymentsTable.id, args.deploymentId),
        eq(f10BundleDeploymentsTable.reconciliationPausedAt, args.pausedAt),
        eq(f10BundleDeploymentsTable.reconciliationPauseNotificationRequired, true),
        isNull(f10BundleDeploymentsTable.reconciliationPauseNotifiedAt),
        or(
          isNull(f10BundleDeploymentsTable.reconciliationPauseNotificationClaimedAt),
          lt(f10BundleDeploymentsTable.reconciliationPauseNotificationClaimedAt, expiredClaimBefore),
        ),
      ))
      .returning({ id: f10BundleDeploymentsTable.id });
    if (!claimed) return false;

    const [owner] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, args.ownerUserId))
      .limit(1);
    if (!owner?.email) {
      await releaseF10PauseNotificationClaim(args.deploymentId, claimedAt);
      return false;
    }

    const result = await sendF10ReconciliationPaused({
      to: owner.email,
      provider: args.provider,
      target: args.target,
      reason: args.reason,
      reconnectUrl: `${publicBaseUrl()}/f10`,
    });
    if (!result.ok) {
      logger.warn(
        { deploymentId: args.deploymentId, error: result.error },
        "F10 reconciliation pause notification failed",
      );
      await releaseF10PauseNotificationClaim(args.deploymentId, claimedAt);
      return false;
    }
    await db
      .update(f10BundleDeploymentsTable)
      .set({
        reconciliationPauseNotifiedAt: new Date(),
        reconciliationPauseNotificationClaimedAt: null,
      })
      .where(and(
        eq(f10BundleDeploymentsTable.id, args.deploymentId),
        eq(f10BundleDeploymentsTable.reconciliationPauseNotificationClaimedAt, claimedAt),
      ));
    return true;
  } catch (err) {
    await releaseF10PauseNotificationClaim(args.deploymentId, claimedAt).catch(() => undefined);
    logger.warn(
      { err, deploymentId: args.deploymentId },
      "F10 reconciliation pause notification failed",
    );
    return false;
  }
}

async function releaseF10PauseNotificationClaim(deploymentId: string, claimedAt: Date): Promise<void> {
  await db
    .update(f10BundleDeploymentsTable)
    .set({ reconciliationPauseNotificationClaimedAt: null })
    .where(and(
      eq(f10BundleDeploymentsTable.id, deploymentId),
      eq(f10BundleDeploymentsTable.reconciliationPauseNotificationClaimedAt, claimedAt),
    ));
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
 * Fire-and-forget wrapper: never throws, always logs. The email lib's send()
 * converts provider errors into `{ ok: false }` instead of rejecting, so a
 * resolved-but-failed result must be inspected too — otherwise failed sends
 * are silently treated as delivered.
 */
export async function safeFire(label: string, p: Promise<unknown>): Promise<void> {
  try {
    const result = await p;
    if (
      typeof result === "object" &&
      result !== null &&
      "ok" in result &&
      (result as { ok: unknown }).ok === false
    ) {
      const error = (result as { error?: unknown }).error;
      logger.warn({ label, error }, "notification dispatch failed (provider error)");
    }
  } catch (err) {
    logger.warn({ err, label }, "notification dispatch failed");
  }
}
