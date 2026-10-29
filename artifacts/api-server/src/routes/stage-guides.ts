import { Router } from "express";
import { z } from "zod/v4";
import { GetStageGuidesQueryParams, SaveStageGuideBody, GenerateStageGuideBody, SyncStageGuideBody, PublishStageGuideBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";
import { StageGuideError, stageGuideLibrary, saveStageGuide, generateStageGuide, syncStageGuide, publishStageGuide } from "../lib/stage-guides";
const router = Router();
router.use("/stage-guides", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
function fail(res: import("express").Response, error: unknown) {
  if (error instanceof StageGuideError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid stage guide fields." });
  return res.status(503).json({ error: "The guide operation could not be confirmed. Refresh its existing status before taking further action." });
}
router.get("/stage-guides", requireAuth, async (req, res) => {
  try { res.json(await stageGuideLibrary(req.localUser!, GetStageGuidesQueryParams.parse(req.query).stageKey)); } catch (err) { fail(res, err); }
});
router.post("/stage-guides", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await saveStageGuide(req.localUser!, SaveStageGuideBody.parse(req.body))); } catch (err) { fail(res, err); }
});
router.post("/stage-guides/:id/generate", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await generateStageGuide(req.localUser!, z.uuid().parse(req.params.id), GenerateStageGuideBody.parse(req.body))); } catch (err) { fail(res, err); }
});
router.post("/stage-guides/:id/sync", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await syncStageGuide(req.localUser!, z.uuid().parse(req.params.id), SyncStageGuideBody.parse(req.body))); } catch (err) { fail(res, err); }
});
router.post("/stage-guides/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await publishStageGuide(req.localUser!, z.uuid().parse(req.params.id), PublishStageGuideBody.parse(req.body))); } catch (err) { fail(res, err); }
});
export default router;
