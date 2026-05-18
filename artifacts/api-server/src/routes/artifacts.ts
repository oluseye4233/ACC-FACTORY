import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, harnessArtifactsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { serializeArtifact } from "./sessions";

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
  res.json(serializeArtifact(rows[0]!));
});

export default router;
