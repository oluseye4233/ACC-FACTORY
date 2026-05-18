import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  harnessSessionsTable,
} from "@workspace/db";
import { mapSpcToBiRow, writeSpcCsv, writeSpcPdf, type SpcArtifactLike } from "@workspace/export";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function loadUserSpcRows(userId: string) {
  const spcs = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.userId, userId),
        eq(harnessArtifactsTable.artifactType, "SPC"),
      ),
    )
    .orderBy(desc(harnessArtifactsTable.createdAt));

  if (spcs.length === 0) return [];

  const sessionIds = Array.from(new Set(spcs.map((s) => s.sessionId)));
  const sessions = await db
    .select({ id: harnessSessionsTable.id, sessionName: harnessSessionsTable.sessionName })
    .from(harnessSessionsTable)
    .where(inArray(harnessSessionsTable.id, sessionIds));
  const sessionName = new Map(sessions.map((s) => [s.id, s.sessionName]));

  const maCounts = await db
    .select({
      sessionId: harnessArtifactsTable.sessionId,
      c: sql<string>`count(*)`,
    })
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.userId, userId),
        eq(harnessArtifactsTable.artifactType, "MA_BIRTH_PACKAGE"),
        inArray(harnessArtifactsTable.sessionId, sessionIds),
      ),
    )
    .groupBy(harnessArtifactsTable.sessionId);
  const maCountBySession = new Map(maCounts.map((r) => [r.sessionId, Number(r.c)]));

  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? null;

  return spcs.map((s) =>
    mapSpcToBiRow(s as SpcArtifactLike, {
      sessionName: sessionName.get(s.sessionId) ?? null,
      publicBaseUrl,
      maCount: maCountBySession.get(s.sessionId) ?? 0,
    }),
  );
}

router.get("/me/spcs/export.csv", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const rows = await loadUserSpcRows(userId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="bi_spc_alpha_${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  await writeSpcCsv(rows, res);
});

router.get("/me/spcs/export.pdf", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const rows = await loadUserSpcRows(userId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="bi_spc_alpha_${new Date().toISOString().slice(0, 10)}.pdf"`,
  );
  await writeSpcPdf(rows, res);
});

export default router;
