import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, harnessArtifactsTable } from "@workspace/db";
import { RenameArtifactBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeArtifact, loadArtifactRunMap } from "./sessions";

const router: IRouter = Router();

router.get("/artifacts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.id, id),
        eq(harnessArtifactsTable.userId, req.localUser!.id),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  const artifact = rows[0]!;
  const runMap = await loadArtifactRunMap(artifact.sessionId, [artifact]);
  res.json(serializeArtifact(artifact, runMap.get(artifact.id) ?? null));
});

router.patch("/artifacts/:id/name", requireAuth, async (req, res): Promise<void> => {
  const parsed = RenameArtifactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Name must not be empty" });
    return;
  }
  const id = String(req.params.id);
  const [updated] = await db
    .update(harnessArtifactsTable)
    .set({ name })
    .where(
      and(
        eq(harnessArtifactsTable.id, id),
        eq(harnessArtifactsTable.userId, req.localUser!.id),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  const runMap = await loadArtifactRunMap(updated.sessionId, [updated]);
  res.json(serializeArtifact(updated, runMap.get(updated.id) ?? null));
});

export default router;
