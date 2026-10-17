import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth";
import { shortSprintPreflight, SprintPreflightError } from "../lib/short-sprint-preflight";

const router: IRouter = Router();
router.get("/harness/sessions/:sessionId/short-sprints/preflight", requireAuth, async (req, res) => {
  const sessionId = z.string().uuid().safeParse(req.params.sessionId);
  if (!sessionId.success) { res.status(400).json({ error: "Invalid session ID" }); return; }
  try {
    res.json(await shortSprintPreflight(req.localUser!.id, sessionId.data, req.query));
  } catch (error) {
    if (error instanceof SprintPreflightError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ error: "Invalid preflight options" }); return; }
    req.log.error({ err: error }, "SHORT SPRINTS preflight failed");
    res.status(500).json({ error: "Preflight failed. No gate decision or successful verdict was issued." });
  }
});
export default router;
