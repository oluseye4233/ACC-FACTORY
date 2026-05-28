import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, harnessSessionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { rateLimit, requireTier } from "../lib/tier";
import { requireCostBudget } from "../lib/cost-budget";
import { handleF1 } from "../engines/f1";
import { handleF2 } from "../engines/f2";
import { handleF3Stream } from "../engines/f3";
import { handleF4 } from "../engines/f4";
import { handleF5 } from "../engines/f5";
import { handleF6 } from "../engines/f6";
import { handleF6Vdj } from "../engines/f6vdj";
import { handleF7Stream } from "../engines/f7";
import { handleF8CodeDj } from "../engines/f8codedj";
import { handleEvolve } from "../engines/de";
import { handleAtlasCrystallise } from "../engines/atlas-crystallise";
import { handlePfp } from "../engines/pfp";
import { hasBadge } from "./badges-gate";

const router: IRouter = Router();

async function requireAspeBadge(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const userId = req.localUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (await hasBadge(userId, "ASPE")) {
    next();
    return;
  }
  res.status(403).json({ error: "ASPE badge required", detail: "Unlock ASPE (≥3 SPCs + ≥4 MAs) to evolve." });
}

// Note: `requireCostBudget` is mounted AFTER `rateLimit` so the rate-limit
// ledger does not tick for a request that we're about to refuse, and BEFORE
// the engine handler so a cap-hit user never burns LLM tokens. It applies to
// every engine route — there is no tier exemption (INSTITUTION has a $2000
// monthly default which is effectively unlimited for normal use).
router.post("/harness/f1", requireAuth, rateLimit(1), requireCostBudget, handleF1);
router.post("/harness/f2", requireAuth, rateLimit(2), requireCostBudget, handleF2);
router.post("/harness/f3", requireAuth, rateLimit(3), requireCostBudget, handleF3Stream);
router.post("/harness/f4", requireAuth, rateLimit(4), requireCostBudget, handleF4);
router.post(
  "/harness/f5",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(5),
  requireCostBudget,
  handleF5,
);
router.post(
  "/harness/f6",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(6),
  requireCostBudget,
  handleF6,
);
router.post(
  "/harness/f6-vdj",
  requireAuth,
  requireTier("PRACTITIONER"),
  requireCostBudget,
  handleF6Vdj,
);
router.post(
  "/harness/f7",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(7),
  requireCostBudget,
  handleF7Stream,
);

router.post(
  "/harness/f8",
  requireAuth,
  requireTier("ARCHITECT"),
  rateLimit(8),
  requireCostBudget,
  handleF8CodeDj,
);

router.post(
  "/harness/atlas-crystallise",
  requireAuth,
  requireTier("PRACTITIONER"),
  requireCostBudget,
  handleAtlasCrystallise,
);

router.post(
  "/harness/pfp",
  requireAuth,
  requireTier("PRACTITIONER"),
  requireCostBudget,
  handlePfp,
);

router.post(
  "/harness/evolve",
  requireAuth,
  requireTier("PRACTITIONER"),
  requireAspeBadge,
  requireCostBudget,
  handleEvolve,
);

router.get("/harness/escalations/stream", requireAuth, async (req, res): Promise<void> => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  if (!sessionId) {
    res.status(400).json({ error: "sessionId query param required" });
    return;
  }
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
