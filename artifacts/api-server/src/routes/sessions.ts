import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  harnessSessionsTable,
  harnessArtifactsTable,
  harnessFeatureStateTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { CreateSessionBody, UpdateSessionBody } from "@workspace/api-zod";
import type { Response } from "express";

function rejectProviderIfExplorer(
  res: Response,
  provider: string | null | undefined,
  tier: string,
): boolean {
  if (!provider || provider === "claude") return false;
  if (tier === "EXPLORER") {
    res.status(403).json({
      error: "PROVIDER_REQUIRES_TIER",
      code: "PROVIDER_REQUIRES_TIER",
      detail: `Provider '${provider}' requires PRACTITIONER tier or above`,
      provider,
    });
    return true;
  }
  return false;
}

const router: IRouter = Router();

function serializeSession(s: typeof harnessSessionsTable.$inferSelect) {
  return {
    id: s.id,
    sessionName: s.sessionName,
    status: s.status,
    origin: s.origin,
    ingestionId: s.ingestionId,
    preferredModelProvider: s.preferredModelProvider,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function serializeFeatureState(f: typeof harnessFeatureStateTable.$inferSelect) {
  return {
    id: f.id,
    sessionId: f.sessionId,
    featureId: f.featureId,
    status: f.status,
    unlockedAt: f.unlockedAt ? f.unlockedAt.toISOString() : null,
    updatedAt: f.updatedAt.toISOString(),
  };
}

function serializeArtifact(a: typeof harnessArtifactsTable.$inferSelect) {
  return {
    id: a.id,
    sessionId: a.sessionId,
    featureId: a.featureId,
    artifactType: a.artifactType,
    artifactContent: a.artifactContent as Record<string, unknown>,
    jcseScore: a.jcseScore,
    certTier: a.certTier,
    groState: a.groState,
    spartanCert: (a.spartanCert ?? null) as Record<string, unknown> | null,
    provider: a.provider,
    modelId: a.modelId,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/sessions", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(harnessSessionsTable)
    .where(eq(harnessSessionsTable.userId, req.localUser!.id))
    .orderBy(desc(harnessSessionsTable.updatedAt));
  res.json(rows.map(serializeSession));
});

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tier = req.subscriber?.tier ?? "EXPLORER";
  if (rejectProviderIfExplorer(res, parsed.data.preferredModelProvider, tier)) return;
  const [created] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: req.localUser!.id,
      sessionName: parsed.data.sessionName,
      ...(parsed.data.preferredModelProvider
        ? { preferredModelProvider: parsed.data.preferredModelProvider }
        : {}),
    })
    .returning();
  await db.insert(harnessFeatureStateTable).values(
    [1, 2, 3, 4, 5, 6, 7].map((featureId) => ({
      sessionId: created!.id,
      featureId,
      status: featureId === 1 ? ("AVAILABLE" as const) : ("LOCKED" as const),
      unlockedAt: featureId === 1 ? new Date() : null,
    })),
  );
  res.status(201).json(serializeSession(created!));
});

async function ownedSession(
  sessionId: string,
  userId: string,
): Promise<typeof harnessSessionsTable.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(harnessSessionsTable)
    .where(
      and(
        eq(harnessSessionsTable.id, sessionId),
        eq(harnessSessionsTable.userId, userId),
      ),
    )
    .limit(1);
  return rows[0];
}

router.get("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const session = await ownedSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [fs, arts] = await Promise.all([
    db
      .select()
      .from(harnessFeatureStateTable)
      .where(eq(harnessFeatureStateTable.sessionId, id))
      .orderBy(harnessFeatureStateTable.featureId),
    db
      .select()
      .from(harnessArtifactsTable)
      .where(eq(harnessArtifactsTable.sessionId, id))
      .orderBy(desc(harnessArtifactsTable.createdAt)),
  ]);
  res.json({
    session: serializeSession(session),
    featureState: fs.map(serializeFeatureState),
    artifacts: arts.map(serializeArtifact),
  });
});

router.patch("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const session = await ownedSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const updates: Partial<typeof harnessSessionsTable.$inferInsert> = {};
  if (parsed.data.sessionName !== undefined) updates.sessionName = parsed.data.sessionName;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.preferredModelProvider !== undefined) {
    const tier = req.subscriber?.tier ?? "EXPLORER";
    if (rejectProviderIfExplorer(res, parsed.data.preferredModelProvider, tier)) return;
    updates.preferredModelProvider = parsed.data.preferredModelProvider;
  }
  const [updated] = await db
    .update(harnessSessionsTable)
    .set(updates)
    .where(eq(harnessSessionsTable.id, id))
    .returning();
  res.json(serializeSession(updated!));
});

router.delete("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const session = await ownedSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, id));
  res.status(204).send();
});

router.get("/sessions/:id/feature-state", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const session = await ownedSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const rows = await db
    .select()
    .from(harnessFeatureStateTable)
    .where(eq(harnessFeatureStateTable.sessionId, id))
    .orderBy(harnessFeatureStateTable.featureId);
  res.json(rows.map(serializeFeatureState));
});

router.get("/sessions/:id/artifacts", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const session = await ownedSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(eq(harnessArtifactsTable.sessionId, id))
    .orderBy(desc(harnessArtifactsTable.createdAt));
  res.json(rows.map(serializeArtifact));
});

export default router;
export { serializeArtifact, serializeSession, serializeFeatureState };
