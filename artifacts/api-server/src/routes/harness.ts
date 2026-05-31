import { Router, type IRouter, type RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, harnessSessionsTable, type SubscriberTier } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { rateLimit, requireTier } from "../lib/tier";
import { requireCostBudget } from "../lib/cost-budget";
import { handleF1 } from "../engines/f1";
import { handleF2 } from "../engines/f2";
import { handleF3Stream } from "../engines/f3";
import { handleF4 } from "../engines/f4";
import { handleF5, handleF5FinalizeStream } from "../engines/f5";
import { handleF6 } from "../engines/f6";
import { handleF6Vdj } from "../engines/f6vdj";
import { handleF7Stream } from "../engines/f7";
import { handleF8CodeDj } from "../engines/f8codedj";
import { handleF8Hdj } from "../engines/f8hdj";
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

/**
 * Canonical gate stack for every HARNESS engine route.
 *
 * Order is load-bearing and enforced here so individual route registrations
 * cannot accidentally drop a gate:
 *
 *   requireAuth          → populate req.localUser / req.subscriber / req.effectiveTier
 *   requireTier?         → tier floor (optional; omit for EXPLORER-reachable engines)
 *   rateLimit(featureId) → per-day, per-engine cap; tick the daily ledger
 *   ...extra?            → engine-specific extras (e.g. badge checks) — mount BEFORE
 *                          requireCostBudget so a refused request still doesn't sum LLM cost
 *   requireCostBudget    → live monthly SUM vs MONTHLY_COST_CAP_USD[effectiveTier]
 *   handler              → the engine itself
 *
 * `requireCostBudget` is always last in the middleware chain so the rate-limit
 * ledger does not tick for a request we're about to refuse on cost, and so
 * `req.subscriber` / `req.effectiveTier` are populated for the lookup.
 *
 * NOTE: when `featureId === null` the engine is not rate-limited per-day
 * (matches today's `f6-vdj`, `atlas-crystallise`, `pfp`, `evolve` behaviour
 * — they're tier-gated and cost-gated but not feature-id-throttled).
 */
type HarnessFeatureId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function harnessRoute(opts: {
  featureId: HarnessFeatureId | null;
  tier?: SubscriberTier;
  extra?: RequestHandler[];
  handler: RequestHandler;
}): RequestHandler[] {
  const stack: RequestHandler[] = [requireAuth];
  if (opts.tier) stack.push(requireTier(opts.tier));
  if (opts.featureId !== null) stack.push(rateLimit(opts.featureId));
  if (opts.extra) stack.push(...opts.extra);
  stack.push(requireCostBudget);
  stack.push(opts.handler);
  return stack;
}

router.post("/harness/f1", ...harnessRoute({ featureId: 1, handler: handleF1 }));
router.post("/harness/f2", ...harnessRoute({ featureId: 2, handler: handleF2 }));
router.post("/harness/f3", ...harnessRoute({ featureId: 3, handler: handleF3Stream }));
router.post("/harness/f4", ...harnessRoute({ featureId: 4, handler: handleF4 }));
router.post(
  "/harness/f5",
  ...harnessRoute({ featureId: 5, tier: "PRACTITIONER", handler: handleF5 }),
);
router.post(
  "/harness/f5-finalize",
  ...harnessRoute({ featureId: 5, tier: "PRACTITIONER", handler: handleF5FinalizeStream }),
);
router.post(
  "/harness/f6",
  ...harnessRoute({ featureId: 6, tier: "PRACTITIONER", handler: handleF6 }),
);
router.post(
  "/harness/f6-vdj",
  ...harnessRoute({ featureId: null, tier: "PRACTITIONER", handler: handleF6Vdj }),
);
router.post(
  "/harness/f7",
  ...harnessRoute({ featureId: 7, tier: "PRACTITIONER", handler: handleF7Stream }),
);
router.post(
  "/harness/f8",
  ...harnessRoute({ featureId: 8, tier: "ARCHITECT", handler: handleF8CodeDj }),
);
router.post(
  "/harness/f8-hdj",
  ...harnessRoute({ featureId: null, tier: "ARCHITECT", handler: handleF8Hdj }),
);
router.post(
  "/harness/atlas-crystallise",
  ...harnessRoute({ featureId: null, tier: "PRACTITIONER", handler: handleAtlasCrystallise }),
);
router.post(
  "/harness/pfp",
  ...harnessRoute({ featureId: null, tier: "PRACTITIONER", handler: handlePfp }),
);
router.post(
  "/harness/evolve",
  ...harnessRoute({
    featureId: null,
    tier: "PRACTITIONER",
    extra: [requireAspeBadge],
    handler: handleEvolve,
  }),
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
