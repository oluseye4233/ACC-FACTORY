import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  harnessSessionsTable,
  type ArtifactType,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const PROMPT_TYPES = ["ATOMIC_PROMPT", "PROMPT_DIAGNOSTIC", "SPC"] as const satisfies readonly ArtifactType[];
type PromptType = (typeof PROMPT_TYPES)[number];

router.get("/me/prompts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const kindParam = typeof req.query.kind === "string" ? req.query.kind : "";
  const kinds: readonly PromptType[] =
    kindParam && (PROMPT_TYPES as readonly string[]).includes(kindParam)
      ? [kindParam as PromptType]
      : PROMPT_TYPES;

  const whereClause = and(
    eq(harnessArtifactsTable.userId, userId),
    inArray(harnessArtifactsTable.artifactType, kinds),
    q ? sql`${harnessArtifactsTable.artifactContent}::text ilike ${"%" + q + "%"}` : sql`true`,
  );

  const totalRow = await db
    .select({ c: sql<string>`count(*)` })
    .from(harnessArtifactsTable)
    .where(whereClause);
  const total = Number(totalRow[0]?.c ?? 0);

  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(whereClause)
    .orderBy(desc(harnessArtifactsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const sessionIds = Array.from(new Set(rows.map((r) => r.sessionId)));
  const sessions = sessionIds.length
    ? await db
        .select({ id: harnessSessionsTable.id, name: harnessSessionsTable.sessionName })
        .from(harnessSessionsTable)
        .where(inArray(harnessSessionsTable.id, sessionIds))
    : [];
  const nameById = new Map(sessions.map((s) => [s.id, s.name]));

  res.json({
    page,
    pageSize,
    total,
    items: rows.map((r) => {
      const content = (r.artifactContent ?? {}) as Record<string, unknown>;
      const tuple = (content["atomicPrompt"] ?? content["tuple"]) as Record<string, unknown> | undefined;
      const preview =
        (typeof content["title"] === "string" && content["title"]) ||
        (typeof content["objective"] === "string" && content["objective"]) ||
        (tuple && typeof tuple["instruction"] === "string" && tuple["instruction"]) ||
        "(untitled)";
      return {
        id: r.id,
        sessionId: r.sessionId,
        sessionName: nameById.get(r.sessionId) ?? null,
        artifactType: r.artifactType,
        certTier: r.certTier,
        jcseScore: r.jcseScore,
        spcOrigin: r.spcOrigin,
        preview: String(preview).slice(0, 240),
        createdAt: r.createdAt.toISOString(),
      };
    }),
  });
});

export default router;
