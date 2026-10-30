import { Router } from "express";
import { z } from "zod/v4";
import { RunJevShadowBody, GetJevShadowReportsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireCostBudget } from "../lib/cost-budget";
import { JevError, listJevShadow, runJevShadow } from "../lib/jev-shadow";

const router = Router();
router.use("/llm/jev-shadow", requireAuth, (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
function failure(res: import("express").Response, error: unknown) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid shadow check input." });
  return res.status(error instanceof JevError ? error.status : 503)
    .json({ error: error instanceof JevError ? error.message : "Shadow advice is unavailable; existing production decisions are unchanged." });
}
router.get("/llm/jev-shadow", async (req, res) => {
  try { res.json(await listJevShadow(req.localUser!.id, GetJevShadowReportsQueryParams.parse(req.query))); }
  catch (err) { failure(res, err); }
});
router.post("/llm/jev-shadow", requireCostBudget, async (req, res) => {
  try { res.json(await runJevShadow(req.localUser!.id, req.subscriber?.tier ?? "EXPLORER", RunJevShadowBody.parse(req.body))); }
  catch (err) { failure(res, err); }
});
export default router;
