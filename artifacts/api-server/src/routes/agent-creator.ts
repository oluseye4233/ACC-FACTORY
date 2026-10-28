import { Router } from "express";
import { z } from "zod/v4";
import { CreateGovernedAgentBody, RunCreatedAgentBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireCostBudget } from "../lib/cost-budget";
import { agentView, createAgent, CreatorError, listAgents, listAgentRuns, ownedAgent, runAgent } from "../lib/agent-creator";

const router = Router();
router.use("/agent-creator", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
const uuid = z.string().uuid();
function failure(res: import("express").Response, err: unknown) {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid agent request." });
  if (err instanceof CreatorError) return res.status(err.status).json({ error: err.message });
  return res.status(502).json({ error: "Agent operation was not confirmed. Check saved status before starting another paid attempt." });
}
router.get("/agent-creator", requireAuth, async (req, res) => {
  try { res.json(await listAgents(req.localUser!.id)); } catch (err) { failure(res, err); }
});
router.get("/agent-creator/:agentId", requireAuth, async (req, res) => {
  try { res.json(await agentView(await ownedAgent(req.localUser!.id, uuid.parse(req.params.agentId)))); } catch (err) { failure(res, err); }
});
router.post("/agent-creator", requireAuth, requireCostBudget, async (req, res) => {
  try { res.json(await createAgent(req.localUser!.id, CreateGovernedAgentBody.parse(req.body))); } catch (err) { failure(res, err); }
});
router.get("/agent-creator/:agentId/runs", requireAuth, async (req, res) => {
  try { res.json(await listAgentRuns(req.localUser!.id, uuid.parse(req.params.agentId))); } catch (err) { failure(res, err); }
});
router.post("/agent-creator/:agentId/runs", requireAuth, requireCostBudget, async (req, res) => {
  try { res.json(await runAgent(req.localUser!.id, uuid.parse(req.params.agentId), RunCreatedAgentBody.parse(req.body))); } catch (err) { failure(res, err); }
});
export default router;
