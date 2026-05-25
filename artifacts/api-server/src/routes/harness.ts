import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, harnessSessionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { rateLimit, requireTier } from "../lib/tier";
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

router.post("/harness/f1", requireAuth, rateLimit(1), handleF1);
router.post("/harness/f2", requireAuth, rateLimit(2), handleF2);
router.post("/harness/f3", requireAuth, rateLimit(3), handleF3Stream);
router.post("/harness/f4", requireAuth, rateLimit(4), handleF4);
router.post(
  "/harness/f5",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(5),
  handleF5,
);
router.post(
  "/harness/f6",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(6),
  handleF6,
);
router.post(
  "/harness/f6-vdj",
  requireAuth,
  requireTier("PRACTITIONER"),
  handleF6Vdj,
);
router.post(
  "/harness/f7",
  requireAuth,
  requireTier("PRACTITIONER"),
  rateLimit(7),
  handleF7Stream,
);

router.post(
  "/harness/f8",
  requireAuth,
  requireTier("ARCHITECT"),
  rateLimit(8),
  handleF8CodeDj,
);

router.post(
  "/harness/atlas-crystallise",
  requireAuth,
  requireTier("PRACTITIONER"),
  handleAtlasCrystallise,
);

router.post(
  "/harness/pfp",
  requireAuth,
  requireTier("PRACTITIONER"),
  handlePfp,
);

router.post(
  "/harness/evolve",
  requireAuth,
  requireTier("PRACTITIONER"),
  requireAspeBadge,
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
