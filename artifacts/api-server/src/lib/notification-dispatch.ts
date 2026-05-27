import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  harnessEngineRunsTable,
  harnessSessionsTable,
  notificationPreferencesTable,
  organizationsTable,
  stripeWebhookEventsTable,
  usersTable,
} from "@workspace/db";
import {
  sendBillingFailureAlert,
  sendHighCostRunAlert,
  sendOrgActivityDigest,
  type DigestRow,
} from "@workspace/email";
import {
  activityUrl,
  billingUrl,
  getOrCreatePreferences,
  ownerAdminContactsForOrg,
  ownerAdminContactsForStripeCustomer,
  safeFire,
  unsubscribeUrl,
} from "./notifications";
import { logger } from "./logger";
import { memberUserIdsForOrgs } from "./orgs";

/**
 * Called from `engines/shared.ts#recordRun` after a successful engine run.
 * Looks up every org the user belongs to that has at least one owner/admin
 * subscribed to high-cost alerts with a threshold crossed by this run, and
 * dispatches alerts. Fire-and-forget — never throws.
 */
export async function maybeDispatchHighCostAlerts(args: {
  sessionId: string;
  userId: string;
  engineId: number;
  costUsd: number;
  occurredAt: Date;
}): Promise<void> {
  try {
    // Only org-visible sessions can leak into an org's alert stream.
    const sessRows = await db
      .select({ orgId: harnessSessionsTable.orgId, orgVisible: harnessSessionsTable.orgVisible })
      .from(harnessSessionsTable)
      .where(eq(harnessSessionsTable.id, args.sessionId))
      .limit(1);
    const sess = sessRows[0];
    if (!sess || !sess.orgId || !sess.orgVisible) return;
    const orgId = sess.orgId;

    // Actor email (for the alert body) and org name.
    const ctxRows = await db
      .select({ email: usersTable.email, orgName: organizationsTable.name })
      .from(usersTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, orgId))
      .where(eq(usersTable.id, args.userId))
      .limit(1);
    const ctx = ctxRows[0];
    if (!ctx) return;

    const contacts = await ownerAdminContactsForOrg(orgId);
    for (const c of contacts) {
      if (!c.prefs.highCostAlertsEnabled) continue;
      const threshold = Number(c.prefs.highCostThresholdUsd);
      if (!Number.isFinite(threshold) || args.costUsd < threshold) continue;
      void safeFire(
        "high-cost-alert",
        sendHighCostRunAlert({
          to: c.email,
          orgName: ctx.orgName,
          actorEmail: ctx.email,
          engineId: args.engineId,
          sessionId: args.sessionId,
          costUsd: args.costUsd,
          thresholdUsd: threshold,
          occurredAt: args.occurredAt,
          activityUrl: activityUrl(orgId),
          unsubscribeUrl: unsubscribeUrl(c.prefs.unsubscribeToken),
        }),
      );
    }
  } catch (err) {
    logger.warn({ err }, "maybeDispatchHighCostAlerts failed");
  }
}

/**
 * Called from the Stripe webhook after an org-scoped billing-failure event.
 * Notifies every owner/admin who has billing alerts enabled. The personal-tier
 * `invoice.payment_failed` email to the paying user is unchanged and continues
 * to flow from the webhook handler itself.
 */
export async function dispatchBillingFailureForCustomer(args: {
  stripeCustomerId: string;
  eventType: string;
  occurredAt: Date;
}): Promise<void> {
  try {
    const contacts = await ownerAdminContactsForStripeCustomer(args.stripeCustomerId);
    if (contacts.length === 0) return;
    for (const c of contacts) {
      if (!c.prefs.billingAlertsEnabled) continue;
      void safeFire(
        "billing-alert",
        sendBillingFailureAlert({
          to: c.email,
          orgName: c.orgName,
          eventType: args.eventType,
          occurredAt: args.occurredAt,
          billingUrl: billingUrl(c.orgId),
          unsubscribeUrl: unsubscribeUrl(c.prefs.unsubscribeToken),
        }),
      );
    }
  } catch (err) {
    logger.warn({ err }, "dispatchBillingFailureForCustomer failed");
  }
}

interface DigestSummary {
  totalRuns: number;
  totalCostUsd: number;
  byEngine: DigestRow[];
  byMember: DigestRow[];
  billingEvents: Array<{ ts: Date; type: string }>;
}

async function summarizeForOrg(
  orgId: string,
  stripeCustomerId: string | null,
  windowStart: Date,
  windowEnd: Date,
): Promise<DigestSummary> {
  const memberIds = await memberUserIdsForOrgs([orgId]);
  if (memberIds.length === 0) {
    return { totalRuns: 0, totalCostUsd: 0, byEngine: [], byMember: [], billingEvents: [] };
  }

  // Engine runs scoped to org-visible sessions pinned to this org.
  const engineRows = await db.execute(sql`
    SELECT
      r.engine_id AS engine_id,
      u.email AS email,
      COUNT(*)::int AS n,
      COALESCE(SUM(r.cost_usd), 0)::text AS cost
    FROM ${harnessEngineRunsTable} r
    JOIN ${usersTable} u ON u.id = r.user_id
    JOIN ${harnessSessionsTable} s ON s.id = r.session_id
    WHERE s.org_id = ${orgId}
      AND s.org_visible = true
      AND r.created_at >= ${windowStart}
      AND r.created_at < ${windowEnd}
    GROUP BY r.engine_id, u.email
  `);
  const rows = (engineRows as unknown as { rows: Array<Record<string, unknown>> }).rows;

  let totalRuns = 0;
  let totalCostUsd = 0;
  const engineMap = new Map<number, { count: number; cost: number }>();
  const memberMap = new Map<string, { count: number; cost: number }>();
  for (const r of rows) {
    const engineId = Number(r.engine_id);
    const email = String(r.email ?? "(unknown)");
    const n = Number(r.n);
    const cost = Number(r.cost);
    totalRuns += n;
    totalCostUsd += cost;
    const e = engineMap.get(engineId) ?? { count: 0, cost: 0 };
    e.count += n;
    e.cost += cost;
    engineMap.set(engineId, e);
    const m = memberMap.get(email) ?? { count: 0, cost: 0 };
    m.count += n;
    m.cost += cost;
    memberMap.set(email, m);
  }
  const byEngine: DigestRow[] = [...engineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, v]) => ({ label: `F${id}`, count: v.count, costUsd: v.cost }));
  const byMember: DigestRow[] = [...memberMap.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([email, v]) => ({ label: email, count: v.count, costUsd: v.cost }));

  let billingEvents: Array<{ ts: Date; type: string }> = [];
  if (stripeCustomerId) {
    const billing = await db
      .select({
        ts: stripeWebhookEventsTable.receivedAt,
        type: stripeWebhookEventsTable.type,
      })
      .from(stripeWebhookEventsTable)
      .where(
        and(
          eq(stripeWebhookEventsTable.customerId, stripeCustomerId),
          gte(stripeWebhookEventsTable.receivedAt, windowStart),
          lte(stripeWebhookEventsTable.receivedAt, windowEnd),
        ),
      )
      .orderBy(stripeWebhookEventsTable.receivedAt);
    billingEvents = billing.map((b) => ({ ts: b.ts as Date, type: b.type }));
  }
  return { totalRuns, totalCostUsd, byEngine, byMember, billingEvents };
}

/**
 * Cron-driven: send a 7-day digest to every owner/admin with digestEnabled,
 * skipping orgs that have already been digested within the last 6 days
 * (so an extra cron tick can't double-mail).
 */
export async function runWeeklyDigest(now: Date = new Date()): Promise<{
  orgsProcessed: number;
  emailsSent: number;
  emailsSkipped: number;
}> {
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minIntervalCutoff = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

  const orgs = await db
    .select({
      id: organizationsTable.id,
      name: organizationsTable.name,
      stripeCustomerId: organizationsTable.stripeCustomerId,
    })
    .from(organizationsTable);

  let emailsSent = 0;
  let emailsSkipped = 0;
  for (const org of orgs) {
    const contacts = await ownerAdminContactsForOrg(org.id);
    if (contacts.length === 0) continue;
    let needSummary = false;
    for (const c of contacts) {
      if (!c.prefs.digestEnabled) continue;
      if (c.prefs.lastDigestSentAt && c.prefs.lastDigestSentAt > minIntervalCutoff) continue;
      needSummary = true;
      break;
    }
    if (!needSummary) continue;
    const summary = await summarizeForOrg(org.id, org.stripeCustomerId, windowStart, windowEnd);
    for (const c of contacts) {
      if (!c.prefs.digestEnabled) {
        emailsSkipped++;
        continue;
      }
      if (c.prefs.lastDigestSentAt && c.prefs.lastDigestSentAt > minIntervalCutoff) {
        emailsSkipped++;
        continue;
      }
      const prefs = await getOrCreatePreferences(c.userId, c.orgId);
      try {
        await sendOrgActivityDigest({
          to: c.email,
          orgName: c.orgName,
          periodStart: windowStart,
          periodEnd: windowEnd,
          totalRuns: summary.totalRuns,
          totalCostUsd: summary.totalCostUsd,
          byEngine: summary.byEngine,
          byMember: summary.byMember,
          billingEvents: summary.billingEvents,
          activityUrl: activityUrl(c.orgId),
          unsubscribeUrl: unsubscribeUrl(prefs.unsubscribeToken),
        });
        emailsSent++;
        await db
          .update(notificationPreferencesTable)
          .set({ lastDigestSentAt: windowEnd })
          .where(eq(notificationPreferencesTable.id, prefs.id));
      } catch (err) {
        logger.warn({ err, orgId: c.orgId, userId: c.userId }, "weekly digest send failed");
      }
    }
  }
  return { orgsProcessed: orgs.length, emailsSent, emailsSkipped };
}
