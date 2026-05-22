import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, commandCentreBadgesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  classifyAiseUrl,
  computeBadgeProgress,
  headOk,
  listContextCraftBadges,
} from "../lib/badges";

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
      .set({ status: "CLAIMED", evidence, claimedAt: now })
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
      .set({ status: "CLAIMED", evidence, claimedAt: now })
      .where(eq(commandCentreBadgesTable.id, existing[0]!.id));
  }

  const progress = await computeBadgeProgress(userId);
  res.json(progress);
});

export default router;
