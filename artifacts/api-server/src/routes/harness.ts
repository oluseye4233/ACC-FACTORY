import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth";
import { rateLimit, requireTier } from "../lib/tier";

const router: IRouter = Router();

// Stage 1: tier + rate-limit gates wired; engine bodies are stubbed and
// will be implemented in Stage 3 when the system prompts + Anthropic
// integration land.
function notImplemented(_req: Request, res: Response): void {
  res.status(501).json({ error: "Engine not yet implemented" });
}

router.post("/harness/f1", requireAuth, rateLimit(1), notImplemented);
router.post("/harness/f2", requireAuth, rateLimit(2), notImplemented);
router.post("/harness/f3", requireAuth, rateLimit(3), notImplemented);
router.post("/harness/f4", requireAuth, rateLimit(4), notImplemented);
router.post(
  "/harness/f5",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(5),
  notImplemented,
);
router.post(
  "/harness/f6",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(6),
  notImplemented,
);
router.post(
  "/harness/f6-vdj",
  requireAuth,
  requireTier("PRACTITIONER"),
  notImplemented,
);
router.post(
  "/harness/f7",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(7),
  notImplemented,
);

router.get("/harness/escalations/stream", requireAuth, async (req, res): Promise<void> => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  if (!sessionId) {
    res.status(400).json({ error: "sessionId query param required" });
    return;
  }
  // Ownership check: only stream for a session owned by this user.
  const { db, harnessSessionsTable } = await import("@workspace/db");
  const { and, eq } = await import("drizzle-orm");
  const owns = await db
    .select({ id: harnessSessionsTable.id })
    .from(harnessSessionsTable)
    .where(
      and(
        eq(harnessSessionsTable.id, sessionId),
        eq(harnessSessionsTable.userId, req.localUser!.id),
      ),
    )
    .limit(1);
  if (owns.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`: connected\n\n`);
  const interval = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);
  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

export default router;
