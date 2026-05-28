import type { NextFunction, Request, Response } from "express";
import { and, gte, sql } from "drizzle-orm";
import {
  db,
  harnessEngineRunsTable,
  type Subscriber,
  type SubscriberTier,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { MONTHLY_COST_CAP_USD } from "./tier";

/**
 * Resolved monthly cost cap (USD) for a subscriber.
 * Per-subscriber override wins over the tier default when present.
 * Always uses the EFFECTIVE tier (personal max'd against active team-seat orgs).
 */
export function effectiveCostCapUsd(
  sub: Pick<Subscriber, "monthlyCostCapUsdOverride">,
  effectiveTier: SubscriberTier,
): number {
  if (sub.monthlyCostCapUsdOverride !== null && sub.monthlyCostCapUsdOverride !== undefined) {
    const n = Number(sub.monthlyCostCapUsdOverride);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return MONTHLY_COST_CAP_USD[effectiveTier];
}

/**
 * Sum of `harness_engine_runs.cost_usd` for `userId` in the current calendar
 * month (UTC). Backed by `harness_engine_runs_user_created_idx`. Returns USD
 * as a JS number — costs are stored at 6-dp precision, so totals stay
 * well within double precision for any realistic monthly volume.
 */
export async function currentMonthCostForUser(userId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd})::numeric, 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, sql`date_trunc('month', now() at time zone 'utc')`),
      ),
    );
  const total = rows[0]?.total;
  if (!total) return 0;
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

export interface CostStatus {
  usedUsd: number;
  capUsd: number;
  percentUsed: number;
  overCap: boolean;
  tierDefaultUsd: number;
  overrideUsd: number | null;
}

export async function loadCostStatus(
  userId: string,
  sub: Pick<Subscriber, "monthlyCostCapUsdOverride">,
  effectiveTier: SubscriberTier,
): Promise<CostStatus> {
  const usedUsd = await currentMonthCostForUser(userId);
  const capUsd = effectiveCostCapUsd(sub, effectiveTier);
  const percentUsed = capUsd > 0 ? Math.min(100, (usedUsd / capUsd) * 100) : 100;
  const overrideUsd =
    sub.monthlyCostCapUsdOverride !== null && sub.monthlyCostCapUsdOverride !== undefined
      ? Number(sub.monthlyCostCapUsdOverride)
      : null;
  return {
    usedUsd,
    capUsd,
    percentUsed,
    overCap: usedUsd >= capUsd,
    tierDefaultUsd: MONTHLY_COST_CAP_USD[effectiveTier],
    overrideUsd: overrideUsd !== null && Number.isFinite(overrideUsd) ? overrideUsd : null,
  };
}

/**
 * Middleware: refuse the request with 402 COST_CAP_EXCEEDED if the user's
 * current-month LLM spend has already reached their effective cap. Mount
 * AFTER `requireAuth` + (any) `rateLimit` so the rate-limit ledger does not
 * tick for a request that we're about to refuse, and so `req.subscriber` /
 * `req.effectiveTier` are populated.
 */
export async function requireCostBudget(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sub = req.subscriber;
  const userId = req.localUser?.id;
  if (!sub || !userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const tier = req.effectiveTier ?? sub.tier;
  try {
    const status = await loadCostStatus(userId, sub, tier);
    if (status.overCap) {
      res.status(402).json({
        error: "Monthly LLM cost cap reached",
        code: "COST_CAP_EXCEEDED",
        usedUsd: status.usedUsd,
        capUsd: status.capUsd,
        tierDefaultUsd: status.tierDefaultUsd,
        overrideUsd: status.overrideUsd,
        detail:
          "This account has hit its monthly LLM spend cap. The cap resets at the start of next month UTC. Contact an admin to raise it sooner.",
      });
      return;
    }
    next();
  } catch (err) {
    // Cost-budget lookup must never harden into a hard failure mode — if the
    // SUM query fails (DB blip), log and let the request through. Rate-limit
    // gates on the personal subscriber row still apply, so the worst case is
    // a brief window where one engine call slips past the spend ceiling.
    req.log.warn({ err, userId }, "requireCostBudget lookup failed; allowing request");
    next();
  }
}
