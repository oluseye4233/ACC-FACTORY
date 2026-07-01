import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, notificationPreferencesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { memberRole } from "../lib/orgs";
import { getOrCreatePreferences } from "../lib/notifications";

const router: IRouter = Router();

const PrefsBody = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  digestEnabled: z.boolean().optional(),
  billingAlertsEnabled: z.boolean().optional(),
  highCostAlertsEnabled: z.boolean().optional(),
  retainerAlertsEnabled: z.boolean().optional(),
  highCostThresholdUsd: z.number().min(0.01).max(10000).optional(),
});

router.get("/me/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : null;
  if (orgId) {
    const role = await memberRole(userId, orgId);
    if (!role) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
  }
  const prefs = await getOrCreatePreferences(userId, orgId);
  res.json({
    organizationId: prefs.organizationId,
    digestEnabled: prefs.digestEnabled,
    billingAlertsEnabled: prefs.billingAlertsEnabled,
    highCostAlertsEnabled: prefs.highCostAlertsEnabled,
    retainerAlertsEnabled: prefs.retainerAlertsEnabled,
    highCostThresholdUsd: Number(prefs.highCostThresholdUsd),
    lastDigestSentAt: prefs.lastDigestSentAt?.toISOString() ?? null,
  });
});

router.patch("/me/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const parsed = PrefsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const userId = req.localUser!.id;
  const orgId = parsed.data.organizationId ?? null;
  if (orgId) {
    const role = await memberRole(userId, orgId);
    if (!role) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
  }
  await getOrCreatePreferences(userId, orgId);
  const updates: Record<string, unknown> = {};
  if (parsed.data.digestEnabled !== undefined) updates.digestEnabled = parsed.data.digestEnabled;
  if (parsed.data.billingAlertsEnabled !== undefined)
    updates.billingAlertsEnabled = parsed.data.billingAlertsEnabled;
  if (parsed.data.highCostAlertsEnabled !== undefined)
    updates.highCostAlertsEnabled = parsed.data.highCostAlertsEnabled;
  if (parsed.data.retainerAlertsEnabled !== undefined)
    updates.retainerAlertsEnabled = parsed.data.retainerAlertsEnabled;
  if (parsed.data.highCostThresholdUsd !== undefined)
    updates.highCostThresholdUsd = parsed.data.highCostThresholdUsd.toFixed(2);
  if (Object.keys(updates).length > 0) {
    await db
      .update(notificationPreferencesTable)
      .set(updates)
      .where(
        orgId
          ? and(
              eq(notificationPreferencesTable.userId, userId),
              eq(notificationPreferencesTable.organizationId, orgId),
            )
          : and(
              eq(notificationPreferencesTable.userId, userId),
              isNull(notificationPreferencesTable.organizationId),
            ),
      );
  }
  const fresh = await getOrCreatePreferences(userId, orgId);
  res.json({
    organizationId: fresh.organizationId,
    digestEnabled: fresh.digestEnabled,
    billingAlertsEnabled: fresh.billingAlertsEnabled,
    highCostAlertsEnabled: fresh.highCostAlertsEnabled,
    retainerAlertsEnabled: fresh.retainerAlertsEnabled,
    highCostThresholdUsd: Number(fresh.highCostThresholdUsd),
    lastDigestSentAt: fresh.lastDigestSentAt?.toISOString() ?? null,
  });
});

/**
 * Public, token-gated unsubscribe link. Flips all three flags off in one shot
 * for the scope (user×org or user×personal) keyed by the opaque token. The
 * token is preserved so a follow-up "resubscribe" via the prefs page still
 * works without minting a new token.
 */
router.get("/notifications/unsubscribe/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  if (token.length < 16) {
    res.status(400).type("html").send(unsubPage("Invalid unsubscribe link."));
    return;
  }
  const updated = await db
    .update(notificationPreferencesTable)
    .set({
      digestEnabled: false,
      billingAlertsEnabled: false,
      highCostAlertsEnabled: false,
      retainerAlertsEnabled: false,
    })
    .where(eq(notificationPreferencesTable.unsubscribeToken, token))
    .returning({ id: notificationPreferencesTable.id });
  if (updated.length === 0) {
    res.status(404).type("html").send(unsubPage("This unsubscribe link is no longer valid."));
    return;
  }
  res.type("html").send(
    unsubPage(
      "You're unsubscribed. We won't send any further digests or alerts for this scope. " +
        "You can re-enable them at any time from your notification preferences.",
    ),
  );
});

function unsubPage(message: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0d0d0d;color:#f2f2f2;padding:48px;">
    <div style="max-width:480px;margin:0 auto;border:1px solid #262626;border-radius:8px;padding:32px;background:#121212;">
      <h1 style="font-size:18px;letter-spacing:0.1em;color:#1A6B3A;margin:0 0 16px;">UNSUBSCRIBE</h1>
      <p>${message}</p>
      <p style="margin-top:32px;font-size:11px;color:#888;letter-spacing:0.1em;">ATANDA · FORGE.BONSAI HARNESS</p>
    </div>
  </body></html>`;
}

export default router;
