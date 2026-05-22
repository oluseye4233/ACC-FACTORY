import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  db,
  commandCentreBadgesTable,
  usersTable,
  badgeRevocationsTable,
  type BadgeRevocationRecord,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  classifyAiseUrl,
  computeBadgeProgress,
  headOk,
  listContextCraftBadges,
} from "../lib/badges";

const BADGE_DISPLAY_NAMES: Record<"AISE" | "AISE_BUILD", string> = {
  AISE: "AI Solution Engineer (AISE)",
  AISE_BUILD: "Advanced Intelligent Systems Engineer (AISE_BUILD)",
};

/** Fields to clear on the badge row when a user successfully re-claims after a revoke. */
const CLEAR_REVOCATION = {
  revokedAt: null,
  revokedReason: null,
  revokedByUserId: null,
} as const;

/** Wipe any prior admin-restore notice (so it doesn't linger on a fresh re-claim). */
const CLEAR_RESTORATION = {
  restoredAt: null,
  restoredByUserId: null,
  restoredNote: null,
} as const;

const router: IRouter = Router();

router.get("/me/badges", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const progress = await computeBadgeProgress(userId);
  res.json(progress);
});

router.get(
  "/me/context-craft-badges",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.localUser!.id;
    const progress = await listContextCraftBadges(userId);
    res.json(progress);
  },
);

const AiseClaimBody = z.object({
  spcDnaAgentUrl: z.string().url().optional(),
  gptUrl: z.string().url().optional(),
  copilotUrl: z.string().url().optional(),
  nativeAppUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

router.post("/me/badges/aise/claim", requireAuth, async (req, res): Promise<void> => {
  const parsed = AiseClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  const candidates: { field: string; url: string }[] = [];
  for (const [field, url] of Object.entries(parsed.data)) {
    if (field === "notes" || typeof url !== "string") continue;
    candidates.push({ field, url });
  }
  if (candidates.length === 0) {
    res.status(400).json({ error: "Provide at least one URL" });
    return;
  }

  const verified: Array<{ field: string; url: string; kind: string; reachable: boolean }> = [];
  const rejected: Array<{ field: string; url: string; reason: string }> = [];

  for (const c of candidates) {
    const cls = classifyAiseUrl(c.url);
    if (!cls.ok) {
      rejected.push({ ...c, reason: "URL not on allowlist" });
      continue;
    }
    const reachable = await headOk(c.url);
    if (!reachable) {
      rejected.push({ ...c, reason: "URL not reachable (HEAD/GET failed)" });
      continue;
    }
    verified.push({ ...c, kind: cls.kind!, reachable: true });
  }

  if (verified.length === 0) {
    res.status(422).json({
      error: "No verifiable evidence supplied",
      detail: JSON.stringify(rejected),
    });
    return;
  }

  const now = new Date();
  const evidence = {
    verified,
    rejected,
    notes: parsed.data.notes ?? null,
    verifiedAt: now.toISOString(),
  };

  const existing = await db
    .select()
    .from(commandCentreBadgesTable)
    .where(
      and(eq(commandCentreBadgesTable.userId, userId), eq(commandCentreBadgesTable.badgeId, "AISE")),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(commandCentreBadgesTable).values({
      userId,
      badgeId: "AISE",
      status: "CLAIMED",
      evidence,
      unlockedAt: now,
      claimedAt: now,
    });
  } else {
    await db
      .update(commandCentreBadgesTable)
      .set({ status: "CLAIMED", evidence, claimedAt: now, ...CLEAR_REVOCATION, ...CLEAR_RESTORATION })
      .where(eq(commandCentreBadgesTable.id, existing[0]!.id));
  }

  const progress = await computeBadgeProgress(userId);
  res.json(progress);
});

const EngineerClaimBody = z.object({
  url: z.string().url(),
  evidenceNote: z.string().min(1).max(500),
  sessionId: z.string().uuid().optional(),
});

router.post("/me/badges/engineer", requireAuth, async (req, res): Promise<void> => {
  const parsed = EngineerClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  const { url, evidenceNote, sessionId } = parsed.data;

  const reachable = await headOk(url);
  if (!reachable) {
    res.status(422).json({
      error: "URL not reachable",
      detail: "Must be a public HTTPS URL that responds to HEAD/GET (private/loopback/metadata addresses are refused).",
    });
    return;
  }

  const now = new Date();
  const evidence = {
    verifiedUrl: url,
    evidenceNote,
    sessionId: sessionId ?? null,
    verifiedAt: now.toISOString(),
  };

  const existing = await db
    .select()
    .from(commandCentreBadgesTable)
    .where(
      and(
        eq(commandCentreBadgesTable.userId, userId),
        eq(commandCentreBadgesTable.badgeId, "AISE_BUILD"),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(commandCentreBadgesTable).values({
      userId,
      badgeId: "AISE_BUILD",
      status: "CLAIMED",
      evidence,
      unlockedAt: now,
      claimedAt: now,
    });
  } else {
    await db
      .update(commandCentreBadgesTable)
      .set({ status: "CLAIMED", evidence, claimedAt: now, ...CLEAR_REVOCATION, ...CLEAR_RESTORATION })
      .where(eq(commandCentreBadgesTable.id, existing[0]!.id));
  }

  const progress = await computeBadgeProgress(userId);
  res.json(progress);
});

const AdminRevokeBadgeBody = z.object({
  userId: z.string().uuid(),
  badgeId: z.enum(["AISE", "AISE_BUILD"]),
  reason: z.string().min(1).max(1000),
});

router.post(
  "/admin/badges/revoke",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = AdminRevokeBadgeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
      return;
    }
    const { userId, badgeId, reason } = parsed.data;
    const adminUserId = req.localUser!.id;

    const targetRows = await db
      .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (targetRows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const targetUser = targetRows[0]!;

    const existing = await db
      .select()
      .from(commandCentreBadgesTable)
      .where(
        and(
          eq(commandCentreBadgesTable.userId, userId),
          eq(commandCentreBadgesTable.badgeId, badgeId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Badge not found for that user" });
      return;
    }

    const row = existing[0]!;
    if (row.status === "REVOKED") {
      res.status(409).json({ error: "Badge is already revoked", revokedAt: row.revokedAt });
      return;
    }

    const revokedAt = new Date();
    const record: BadgeRevocationRecord = {
      revokedAt: revokedAt.toISOString(),
      revokedByUserId: adminUserId,
      reason,
    };

    const updated = await db
      .update(commandCentreBadgesTable)
      .set({
        status: "REVOKED",
        revokedAt,
        revokedReason: reason,
        revokedByUserId: adminUserId,
        revokeHistory: sql`COALESCE(${commandCentreBadgesTable.revokeHistory}, '[]'::jsonb) || ${JSON.stringify([record])}::jsonb`,
      })
      .where(eq(commandCentreBadgesTable.id, row.id))
      .returning({ id: commandCentreBadgesTable.id, revokeHistory: commandCentreBadgesTable.revokeHistory });

    const historyLength = updated[0]?.revokeHistory?.length ?? 1;

    const insertedRevocation = await db
      .insert(badgeRevocationsTable)
      .values({
        adminUserId,
        targetUserId: userId,
        badgeId,
        reason,
        revokedAt,
      })
      .returning({ id: badgeRevocationsTable.id });

    req.log.info(
      {
        event: "badge.revoke",
        adminUserId,
        targetUserId: userId,
        badgeId,
        reason,
        revokedBadgeRowId: row.id,
        revocationId: insertedRevocation[0]?.id ?? null,
        revokedAt: revokedAt.toISOString(),
        revocationCount: historyLength,
        repeat: historyLength > 1,
      },
      "Admin revoked badge",
    );

    if (targetUser.email) {
      try {
        const { sendBadgeRevoked } = await import("@workspace/email");
        const appealUrl = `${process.env.PUBLIC_BASE_URL ?? ""}/quests`;
        sendBadgeRevoked({
          to: targetUser.email,
          badgeId,
          badgeName: BADGE_DISPLAY_NAMES[badgeId],
          reason,
          appealUrl,
          isRepeat: historyLength > 1,
        }).catch((err) => req.log.warn({ err }, "sendBadgeRevoked failed"));
      } catch (err) {
        req.log.warn({ err }, "sendBadgeRevoked import failed");
      }
    }

    res.json({
      ok: true,
      userId,
      badgeId,
      revokedAt: revokedAt.toISOString(),
      reason,
      revocationCount: historyLength,
    });
  },
);

const AdminRestoreBadgeBody = z.object({
  userId: z.string().uuid(),
  badgeId: z.enum(["AISE", "AISE_BUILD"]),
  note: z.string().max(1000).optional(),
});

router.post(
  "/admin/badges/restore",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = AdminRestoreBadgeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
      return;
    }
    const { userId, badgeId, note } = parsed.data;
    const adminUserId = req.localUser!.id;

    const targetRows = await db
      .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (targetRows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const targetUser = targetRows[0]!;

    const existing = await db
      .select()
      .from(commandCentreBadgesTable)
      .where(
        and(
          eq(commandCentreBadgesTable.userId, userId),
          eq(commandCentreBadgesTable.badgeId, badgeId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Badge not found for that user" });
      return;
    }

    const row = existing[0]!;
    if (row.status !== "REVOKED") {
      res.status(409).json({ error: "Badge is not currently revoked", status: row.status });
      return;
    }

    const restoredAt = new Date();

    // Preserve revoke_history untouched so the audit trail isn't lost.
    // Persist restored_at / restored_by / restored_note so the user-facing
    // /me/badges endpoint can surface an in-app "badge restored" notice
    // (with the admin's optional note) until the user next re-claims.
    await db
      .update(commandCentreBadgesTable)
      .set({
        status: "CLAIMED",
        ...CLEAR_REVOCATION,
        restoredAt,
        restoredByUserId: adminUserId,
        restoredNote: note ?? null,
      })
      .where(eq(commandCentreBadgesTable.id, row.id));

    const revocationCount = row.revokeHistory?.length ?? 0;

    req.log.info(
      {
        event: "badge.restore",
        adminUserId,
        targetUserId: userId,
        badgeId,
        note: note ?? null,
        badgeRowId: row.id,
        restoredAt: restoredAt.toISOString(),
        priorRevocationCount: revocationCount,
      },
      "Admin restored badge",
    );

    if (targetUser.email) {
      try {
        const { sendBadgeRestored } = await import("@workspace/email");
        const badgesUrl = `${process.env.PUBLIC_BASE_URL ?? ""}/quests`;
        sendBadgeRestored({
          to: targetUser.email,
          badgeId,
          badgeName: BADGE_DISPLAY_NAMES[badgeId],
          note: note ?? null,
          badgesUrl,
        }).catch((err) => req.log.warn({ err }, "sendBadgeRestored failed"));
      } catch (err) {
        req.log.warn({ err }, "sendBadgeRestored import failed");
      }
    }

    res.json({
      ok: true,
      userId,
      badgeId,
      restoredAt: restoredAt.toISOString(),
      status: "CLAIMED" as const,
      revocationCount,
      note: note ?? null,
    });
  },
);

const AdminPreviewQuery = z.object({
  userId: z.string().uuid(),
  badgeId: z.enum(["AISE", "AISE_BUILD"]),
});

router.get(
  "/admin/badges/revocation-preview",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = AdminPreviewQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query", detail: parsed.error.message });
      return;
    }
    const { userId, badgeId } = parsed.data;

    const targetRows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (targetRows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const existing = await db
      .select({
        status: commandCentreBadgesTable.status,
        revokeHistory: commandCentreBadgesTable.revokeHistory,
      })
      .from(commandCentreBadgesTable)
      .where(
        and(
          eq(commandCentreBadgesTable.userId, userId),
          eq(commandCentreBadgesTable.badgeId, badgeId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      res.json({
        userId,
        badgeId,
        badgeExists: false,
        currentStatus: null,
        revocationCount: 0,
        lastRevokedAt: null,
        lastReason: null,
        history: [],
      });
      return;
    }

    const row = existing[0]!;
    const history = (row.revokeHistory ?? []) as BadgeRevocationRecord[];
    const last = history.length > 0 ? history[history.length - 1]! : null;

    res.json({
      userId,
      badgeId,
      badgeExists: true,
      currentStatus: row.status,
      revocationCount: history.length,
      lastRevokedAt: last?.revokedAt ?? null,
      lastReason: last?.reason ?? null,
      history: history.map((h) => ({
        revokedAt: h.revokedAt,
        revokedByUserId: h.revokedByUserId ?? null,
        reason: h.reason,
      })),
    });
  },
);

router.get(
  "/admin/badges/revocations",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const limitParam = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);

    const adminUsers = alias(usersTable, "admin_users");
    const targetUsers = alias(usersTable, "target_users");

    const rows = await db
      .select({
        id: badgeRevocationsTable.id,
        badgeId: badgeRevocationsTable.badgeId,
        reason: badgeRevocationsTable.reason,
        revokedAt: badgeRevocationsTable.revokedAt,
        adminUserId: badgeRevocationsTable.adminUserId,
        adminEmail: adminUsers.email,
        adminDisplayName: adminUsers.displayName,
        targetUserId: badgeRevocationsTable.targetUserId,
        targetEmail: targetUsers.email,
        targetDisplayName: targetUsers.displayName,
      })
      .from(badgeRevocationsTable)
      .leftJoin(adminUsers, eq(adminUsers.id, badgeRevocationsTable.adminUserId))
      .leftJoin(targetUsers, eq(targetUsers.id, badgeRevocationsTable.targetUserId))
      .orderBy(desc(badgeRevocationsTable.revokedAt))
      .limit(limit);

    res.json({
      revocations: rows.map((r) => ({
        id: r.id,
        badgeId: r.badgeId,
        reason: r.reason,
        revokedAt: r.revokedAt.toISOString(),
        admin: {
          userId: r.adminUserId,
          email: r.adminEmail,
          displayName: r.adminDisplayName,
        },
        target: {
          userId: r.targetUserId,
          email: r.targetEmail,
          displayName: r.targetDisplayName,
        },
      })),
    });
  },
);

export default router;
