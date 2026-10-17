import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth";
import { evalsetInputSchema } from "../lib/xvl-contract";
import { XvlError, registerEvalset, runVerification, verificationWorkspace } from "../lib/xvl-verification";

const router: IRouter = Router();
const id = z.string().uuid();
const runInput = z.object({ artifactId: id, evalsetId: id }).strict();
function handler(action: (req: Request, sessionId: string) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response) => {
    const session = id.safeParse(req.params.sessionId);
    if (!session.success) { res.status(400).json({ error: "Invalid session ID" }); return; }
    try { res.status(status).json(await action(req, session.data)); }
    catch (error) {
      if (error instanceof XvlError) { res.status(error.status).json({ error: error.message }); return; }
      if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues.map((i) => i.message).join("; ") }); return; }
      req.log.error({ err: error }, "XVL request failed");
      res.status(500).json({ error: "Verification request failed. No successful verdict was issued." });
    }
  };
}
router.get("/harness/sessions/:sessionId/verification", requireAuth, handler(
  (req, sessionId) => verificationWorkspace(req.localUser!.id, sessionId),
));
router.post("/harness/sessions/:sessionId/verification/evalsets", requireAuth, handler(
  (req, sessionId) => registerEvalset(req.localUser!.id, sessionId, evalsetInputSchema.parse(req.body)), 201,
));
router.post("/harness/sessions/:sessionId/verification/runs", requireAuth, handler(
  (req, sessionId) => {
    const input = runInput.parse(req.body);
    return runVerification(req.localUser!.id, sessionId, input.artifactId, input.evalsetId);
  },
));
export default router;
