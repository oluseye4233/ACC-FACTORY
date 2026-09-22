import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  db,
  harnessSessionsTable,
  harnessArtifactsTable,
  harnessEngineRunsTable,
  harnessFeatureStateTable,
  LLM_PROVIDERS,
  SESSION_ORIGINS,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { loadMembershipsForUser } from "../lib/orgs";
import {
  computeForgeVerified,
  computeMathmonScore,
  FORGE_VERIFIED_DISCLAIMER,
} from "../lib/mathmon";
import {
  loadLatestIntake,
  loadLatestMap,
  sessionMaxJcse,
} from "../lib/mathmon-store";
import { CreateSessionBody, UpdateSessionBody } from "@workspace/api-zod";
import type { Response } from "express";
import { z } from "zod/v4";

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

/**
 * Contract for every session representation returned by this router.
 *
 * The database columns are non-null for the core fields, but validating at
 * this boundary also protects consumers from old/corrupt rows and from
 * accidental changes to the serializer. We intentionally reject a malformed
 * row (rather than filtering it out), so the standard API error handler logs
 * the contract failure instead of silently hiding a user's session.
 */
export const SessionResponseSchema = z.object({
  id: z.string().uuid(),
  sessionName: z.string().trim().min(1).max(255),
  status: z.string().trim().min(1),
  origin: z.enum(SESSION_ORIGINS),
  ingestionId: z.string().uuid().nullable(),
  cartridgeId: z.string().uuid().nullable(),
  orgId: z.string().uuid().nullable(),
  orgVisible: z.boolean(),
  userId: z.string().uuid(),
  preferredModelProvider: z.enum(LLM_PROVIDERS),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

function serializeSessionTimestamp(value: Date | null | undefined): unknown {
  // Leave missing/invalid values for the schema to reject with a useful field
  // path instead of allowing Date#toISOString to throw an unrelated TypeError.
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value;
  return value.toISOString();
}

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export function serializeSession(
  s: typeof harnessSessionsTable.$inferSelect,
): SessionResponse {
  return SessionResponseSchema.parse({
    id: s.id,
    sessionName: s.sessionName,
    status: s.status,
    origin: s.origin,
    ingestionId: s.ingestionId,
    cartridgeId: s.cartridgeId,
    orgId: s.orgId,
    orgVisible: s.orgVisible,
    userId: s.userId,
    preferredModelProvider: s.preferredModelProvider,
    createdAt: serializeSessionTimestamp(s.createdAt),
    updatedAt: serializeSessionTimestamp(s.updatedAt),
  });
}

async function memberOrgIds(userId: string): Promise<string[]> {
  try {
    const m = await loadMembershipsForUser(userId);
    return m.map((x) => x.organizationId);
  } catch {
    return [];
  }
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

export interface ArtifactRunMeta {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
}

function serializeArtifact(
  a: typeof harnessArtifactsTable.$inferSelect,
  run?: ArtifactRunMeta | null,
) {
  return {
    id: a.id,
    sessionId: a.sessionId,
    featureId: a.featureId,
    artifactType: a.artifactType,
    name: a.name,
    artifactContent: a.artifactContent as Record<string, unknown>,
    sku: a.sku,
    jcseScore: a.jcseScore,
    certTier: a.certTier,
    groState: a.groState,
    spartanCert: (a.spartanCert ?? null) as Record<string, unknown> | null,
    mathmonScore: a.mathmonScore,
    forgeVerified: a.forgeVerified,
    provider: a.provider,
    modelId: a.modelId,
    runDurationMs: run ? run.durationMs : null,
    runInputTokens: run ? run.inputTokens : null,
    runOutputTokens: run ? run.outputTokens : null,
    runAt: run ? run.createdAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

async function loadArtifactRunMap(
  sessionId: string,
  artifacts: Array<typeof harnessArtifactsTable.$inferSelect>,
): Promise<Map<string, ArtifactRunMeta>> {
  const map = new Map<string, ArtifactRunMeta>();
  if (artifacts.length === 0) return map;
  const runs = await db
    .select({
      engineId: harnessEngineRunsTable.engineId,
      provider: harnessEngineRunsTable.provider,
      modelId: harnessEngineRunsTable.modelId,
      inputTokens: harnessEngineRunsTable.inputTokens,
      outputTokens: harnessEngineRunsTable.outputTokens,
      durationMs: harnessEngineRunsTable.durationMs,
      createdAt: harnessEngineRunsTable.createdAt,
    })
    .from(harnessEngineRunsTable)
    .where(eq(harnessEngineRunsTable.sessionId, sessionId))
    .orderBy(desc(harnessEngineRunsTable.createdAt));
  for (const a of artifacts) {
    const match = runs.find(
      (r) =>
        r.createdAt.getTime() <= a.createdAt.getTime() &&
        (a.provider == null || r.provider === a.provider) &&
        (a.modelId == null || r.modelId === a.modelId),
    );
    if (match) {
      map.set(a.id, {
        durationMs: match.durationMs,
        inputTokens: match.inputTokens,
        outputTokens: match.outputTokens,
        createdAt: match.createdAt,
      });
    }
  }
  return map;
}

router.get("/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const orgIds = await memberOrgIds(userId);
  // Owner can always see their sessions; org members get read-only access to
  // any session pinned to one of their orgs AND marked org-visible.
  const ownerClause = eq(harnessSessionsTable.userId, userId);
  const orgClause =
    orgIds.length > 0
      ? and(
          eq(harnessSessionsTable.orgVisible, true),
          inArray(harnessSessionsTable.orgId, orgIds),
        )
      : undefined;
  const rows = await db
    .select()
    .from(harnessSessionsTable)
    .where(orgClause ? or(ownerClause, orgClause) : ownerClause)
    .orderBy(desc(harnessSessionsTable.updatedAt));
  res.json(rows.map(serializeSession));
});

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tier = req.effectiveTier ?? req.subscriber?.tier ?? "EXPLORER";
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

/**
 * Readable session: owner OR an org member of the session's `orgId` when the
 * session is `orgVisible=true`. Used for read-only routes (GET detail,
 * artifacts, feature-state). Mutating routes still use `ownedSession`.
 */
async function readableSession(
  sessionId: string,
  userId: string,
): Promise<typeof harnessSessionsTable.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(harnessSessionsTable)
    .where(eq(harnessSessionsTable.id, sessionId))
    .limit(1);
  const s = rows[0];
  if (!s) return undefined;
  if (s.userId === userId) return s;
  if (!s.orgVisible || !s.orgId) return undefined;
  const orgIds = await memberOrgIds(userId);
  if (!orgIds.includes(s.orgId)) return undefined;
  return s;
}

router.get("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const session = await readableSession(id, req.localUser!.id);
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
  const runMap = await loadArtifactRunMap(id, arts);
  res.json({
    session: serializeSession(session),
    featureState: fs.map(serializeFeatureState),
    artifacts: arts.map((a) => serializeArtifact(a, runMap.get(a.id) ?? null)),
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
    const tier = req.effectiveTier ?? req.subscriber?.tier ?? "EXPLORER";
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
  const session = await readableSession(id, req.localUser!.id);
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
  const session = await readableSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(eq(harnessArtifactsTable.sessionId, id))
    .orderBy(desc(harnessArtifactsTable.createdAt));
  const runMap = await loadArtifactRunMap(id, rows);
  res.json(rows.map((a) => serializeArtifact(a, runMap.get(a.id) ?? null)));
});

router.get("/sessions/:id/mathmon", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const session = await readableSession(id, req.localUser!.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [intake, map, sessionJcse] = await Promise.all([
    loadLatestIntake(id, session.userId),
    loadLatestMap(id, session.userId),
    sessionMaxJcse(id),
  ]);
  const mathmonScore = map
    ? computeMathmonScore({
        mathCoherence: map.mathCoherence,
        applicability: map.applicability,
        predictiveReliability: map.predictiveReliability,
      })
    : null;
  const forgeVerified = computeForgeVerified(sessionJcse, mathmonScore);
  res.json({
    intake: intake
      ? {
          id: intake.id,
          sessionId: intake.sessionId,
          report: intake.report,
          provider: intake.provider,
          modelId: intake.modelId,
          createdAt: intake.createdAt.toISOString(),
        }
      : null,
    map: map
      ? {
          id: map.id,
          sessionId: map.sessionId,
          sections: (map.map as { sections?: unknown }).sections ?? [],
          mathCoherence: map.mathCoherence,
          applicability: map.applicability,
          predictiveReliability: map.predictiveReliability,
          mathmonScore: mathmonScore ?? 0,
          disclaimer: map.disclaimer,
          provider: map.provider,
          modelId: map.modelId,
          createdAt: map.createdAt.toISOString(),
        }
      : null,
    forgeVerified,
    mathmonScore,
    sessionJcse,
    disclaimer: FORGE_VERIFIED_DISCLAIMER,
  });
});

export default router;
export { serializeArtifact, serializeFeatureState, loadArtifactRunMap };
