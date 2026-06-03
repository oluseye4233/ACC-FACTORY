import { Router, type IRouter } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  harnessEngineRunsTable,
  usersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  commandCentreBadgesTable,
  commandCentreSubscribersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { UpdateMyProfileBody, DeleteMyAccountBody } from "@workspace/api-zod";
import { getUncachableStripeClient, isStripeConfigured } from "../lib/stripe";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const u = req.localUser!;
  const s = req.subscriber!;
  res.json({
    id: u.id,
    clerkUserId: u.clerkUserId,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    subscriber: {
      f1000Member: s.f1000Member,
      tier: s.tier,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      usage: {
        f1: s.f1Today,
        f2: s.f2Today,
        f3: s.f3Today,
        f4: s.f4Today,
        f5: s.f5Today,
        f6: s.f6Today,
        f7: s.f7Today,
        f8: s.f8Today,
      },
    },
  });
});

router.patch("/me/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const displayName = parsed.data.displayName.trim();
  if (displayName.length < 1 || displayName.length > 120) {
    res.status(400).json({ error: "displayName must be 1-120 non-whitespace characters" });
    return;
  }
  const u = req.localUser!;
  const s = req.subscriber!;

  const [updated] = await db
    .update(usersTable)
    .set({ displayName })
    .where(eq(usersTable.id, u.id))
    .returning();

  res.json({
    id: updated!.id,
    clerkUserId: updated!.clerkUserId,
    email: updated!.email,
    displayName: updated!.displayName,
    role: updated!.role,
    subscriber: {
      f1000Member: s.f1000Member,
      tier: s.tier,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      usage: {
        f1: s.f1Today,
        f2: s.f2Today,
        f3: s.f3Today,
        f4: s.f4Today,
        f5: s.f5Today,
        f6: s.f6Today,
        f7: s.f7Today,
        f8: s.f8Today,
      },
    },
  });
});

router.get("/me/export", requireAuth, async (req, res): Promise<void> => {
  const u = req.localUser!;
  const s = req.subscriber!;

  const [sessions, artifacts, badges, runCountRow] = await Promise.all([
    db.select().from(harnessSessionsTable).where(eq(harnessSessionsTable.userId, u.id)),
    db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.userId, u.id)),
    db.select().from(commandCentreBadgesTable).where(eq(commandCentreBadgesTable.userId, u.id)),
    db
      .select({ n: sql<string>`COUNT(*)` })
      .from(harnessEngineRunsTable)
      .where(eq(harnessEngineRunsTable.userId, u.id)),
  ]);

  const filename = `atanda-export-${u.id}-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: u.id,
      clerkUserId: u.clerkUserId,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    },
    subscriber: {
      tier: s.tier,
      status: s.status,
      stripeCustomerId: s.stripeCustomerId,
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    },
    sessions: sessions.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    artifacts: artifacts.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    badges: badges.map((row) => ({
      ...row,
      unlockedAt: row.unlockedAt.toISOString(),
      claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    engineRunCount: Number(runCountRow[0]?.n ?? 0),
  });
});

router.post("/me/delete", requireAuth, async (req, res): Promise<void> => {
  const parsed = DeleteMyAccountBody.safeParse(req.body);
  if (!parsed.success || parsed.data.confirm !== "DELETE") {
    res.status(400).json({ error: "Confirmation phrase 'DELETE' is required" });
    return;
  }
  const u = req.localUser!;
  const s = req.subscriber!;
  const clerkUserId = u.clerkUserId;
  const email = u.email;

  // Ordering rationale: cancel external state BEFORE local hard-delete. If Stripe or Clerk
  // fails we keep local rows intact so the user can retry; this avoids orphaned billing
  // and avoids JIT-recreating a fresh shell on the next authenticated request.
  //
  // CRITICAL: ALL preconditions (sole-org-owner refusal, etc.) must run BEFORE any
  // destructive external call. Otherwise we can delete the Clerk identity, then refuse
  // 409 for sole-owner, stranding the user unable to sign back in to fix the org.

  // 0) Preflight: if the user is the SOLE owner of any organization, refuse to delete —
  //    organizations.createdByUserId is `onDelete: restrict` and (more importantly)
  //    deleting a sole owner would leave the org ownerless. Check every org where
  //    the user currently holds the `owner` role, not just orgs they created.
  try {
    const { db: orgsDb } = await import("@workspace/db");
    const { organizationsTable, organizationMembersTable } = await import("@workspace/db");
    const { sql: sql2 } = await import("drizzle-orm");
    // Union: orgs where the user is currently `owner` (sole-owner check) +
    // orgs where the user is `created_by_user_id` (FK is `onDelete: restrict`,
    // so the local DELETE would otherwise fail AFTER we've already destroyed
    // Stripe + Clerk state, stranding the user). For created-but-not-owned
    // orgs, the only safe remediation is to delete the org first — so they
    // are always blockers, regardless of owner count.
    const r = await orgsDb.execute(
      sql2`
        WITH owned AS (
          SELECT
            o.id,
            o.name,
            'owner'::text AS reason,
            (
              SELECT COUNT(*)::int FROM ${organizationMembersTable} om2
              WHERE om2.organization_id = o.id AND om2.role = 'owner'
            ) AS owner_count
          FROM ${organizationMembersTable} om
          JOIN ${organizationsTable} o ON o.id = om.organization_id
          WHERE om.user_id = ${u.id} AND om.role = 'owner'
        ),
        created AS (
          SELECT
            o.id,
            o.name,
            'creator'::text AS reason,
            0 AS owner_count
          FROM ${organizationsTable} o
          WHERE o.created_by_user_id = ${u.id}
        )
        SELECT id, name, reason, owner_count FROM owned
        UNION
        SELECT id, name, reason, owner_count FROM created
      `,
    );
    const rows =
      (r as unknown as {
        rows: Array<{
          id: string;
          name: string;
          reason: string;
          owner_count: number | string;
        }>;
      }).rows ?? [];
    const blockerMap = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      // Creator rows always block (FK is restrict). Owner rows only block when
      // they're the SOLE owner.
      if (row.reason === "creator" || Number(row.owner_count ?? 0) <= 1) {
        blockerMap.set(row.id, { id: row.id, name: row.name });
      }
    }
    const blockers = Array.from(blockerMap.values());
    if (blockers.length > 0) {
      res.status(409).json({
        error:
          "You are the sole owner of one or more organizations. Promote a co-owner or delete the organization first, then retry account deletion.",
        code: "ORG_SOLE_OWNER",
        organizations: blockers,
      });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "sole-owner check failed during account delete");
    res.status(500).json({ error: "Could not verify organization ownership; please retry." });
    return;
  }

  // 1) Cancel any active Stripe subscription immediately. If a sub id exists but Stripe is
  //    unreachable, hard-fail — we will not orphan billing by deleting local rows.
  if (s.stripeSubscriptionId) {
    if (!(await isStripeConfigured())) {
      req.log.error(
        { subId: s.stripeSubscriptionId, userId: u.id },
        "stripe unavailable during account delete — refusing to orphan subscription",
      );
      res.status(502).json({
        error:
          "Billing service is temporarily unavailable; we cannot cancel your subscription right now. Please retry shortly.",
      });
      return;
    }
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.cancel(s.stripeSubscriptionId);
    } catch (err) {
      // If the subscription is already cancelled or missing, Stripe returns 404 — treat as success.
      const code = (err as { code?: string; statusCode?: number }).code;
      const status = (err as { statusCode?: number }).statusCode;
      const benign = code === "resource_missing" || status === 404;
      if (!benign) {
        req.log.error({ err, subId: s.stripeSubscriptionId }, "stripe cancel failed during account delete");
        res.status(502).json({
          error: "Could not cancel your active subscription. Please cancel from Billing first, then retry.",
        });
        return;
      }
    }
  }

  // 2) Delete Clerk identity. If this fails, abort — do not delete local rows.
  try {
    await clerkClient.users.deleteUser(clerkUserId);
  } catch (err) {
    req.log.error({ err, clerkUserId }, "clerk deleteUser failed during account delete");
    res.status(502).json({ error: "Identity provider could not delete your account. Try again." });
    return;
  }

  // 3) Hard-delete local user — cascades to subscriber, sessions, artifacts, badges, engine runs.
  await db.delete(usersTable).where(eq(usersTable.id, u.id));

  // 4) Send goodbye email — best-effort.
  if (email) {
    try {
      const { sendAccountDeleted } = await import("@workspace/email");
      await sendAccountDeleted({ to: email });
    } catch (err) {
      req.log.warn({ err }, "account-deleted email failed");
    }
  }

  res.json({ ok: true, deletedAt: new Date().toISOString() });
});

router.get("/me/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const dayRow = await db
    .select({
      tokens: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.inputTokens} + ${harnessEngineRunsTable.outputTokens}), 0)`,
      cost: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, dayStart),
      ),
    );

  const monthRow = await db
    .select({
      tokens: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.inputTokens} + ${harnessEngineRunsTable.outputTokens}), 0)`,
      cost: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, monthStart),
      ),
    );

  const byEngineRows = await db
    .select({
      engineId: harnessEngineRunsTable.engineId,
      runs: sql<string>`COUNT(*)`,
      tokens: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.inputTokens} + ${harnessEngineRunsTable.outputTokens}), 0)`,
      cost: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, monthStart),
      ),
    )
    .groupBy(harnessEngineRunsTable.engineId)
    .orderBy(harnessEngineRunsTable.engineId);

  const num = (v: string | number | undefined | null): number =>
    v === undefined || v === null ? 0 : Number(v);

  res.json({
    day: {
      totalTokens: num(dayRow[0]?.tokens),
      totalCostUsd: num(dayRow[0]?.cost),
    },
    month: {
      totalTokens: num(monthRow[0]?.tokens),
      totalCostUsd: num(monthRow[0]?.cost),
    },
    byEngine: byEngineRows.map((r) => ({
      engineId: r.engineId,
      runs: num(r.runs),
      totalTokens: num(r.tokens),
      totalCostUsd: num(r.cost),
    })),
  });
});

// Suppress unused import warning — used implicitly by `commandCentreSubscribersTable` re-export.
void commandCentreSubscribersTable;

export default router;
