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
 * Parse a `YYYY-MM-DD` env value as midnight UTC of that day. Returns null
 * for missing / malformed input (the policy decision: an unparseable env
 * value means "no grandfather window", same as unset).
 */
function parseUtcDate(value: string | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Read the legacy (pre-cutover) cap for a tier from env, if set.
 * Env keys: `MONTHLY_COST_CAP_LEGACY_<TIER>` (USD).
 */
function legacyTierCapUsd(tier: SubscriberTier): number | null {
  return parsePositiveNumber(process.env[`MONTHLY_COST_CAP_LEGACY_${tier}`]);
}

/**
 * Resolve the **tier-default** cap (USD) for a subscriber, honouring the
 * grandfather window if one is configured. This is the value used when no
 * per-subscriber override is set — overrides always win, regardless of
 * grandfather state.
 *
 * Policy:
 *   - If `COST_CAP_GRANDFATHER_UNTIL` (YYYY-MM-DD UTC) is in the future
 *     AND `COST_CAP_LEGACY_CUTOFF` (YYYY-MM-DD UTC) is set
 *     AND the subscriber's `createdAt` is strictly before the cutoff
 *     AND `MONTHLY_COST_CAP_LEGACY_<TIER>` is set,
 *   then the legacy cap applies. Otherwise the live `MONTHLY_COST_CAP_USD`
 *   value applies.
 *
 * Designed to fail safely toward the **stricter** (live) cap when any env
 * value is missing or malformed — never accidentally elevate a user beyond
 * the configured tier cap.
 */
export function resolveTierDefaultCapUsd(
  tier: SubscriberTier,
  sub: Pick<Subscriber, "createdAt">,
  now: Date = new Date(),
): number {
  const liveCap = MONTHLY_COST_CAP_USD[tier];
  const grandfatherUntil = parseUtcDate(process.env.COST_CAP_GRANDFATHER_UNTIL);
  if (!grandfatherUntil || now >= grandfatherUntil) return liveCap;
  const legacyCutoff = parseUtcDate(process.env.COST_CAP_LEGACY_CUTOFF);
  if (!legacyCutoff) return liveCap;
  const createdAt = sub.createdAt instanceof Date ? sub.createdAt : new Date(sub.createdAt as unknown as string);
  if (!createdAt || Number.isNaN(createdAt.getTime()) || createdAt >= legacyCutoff) return liveCap;
  const legacy = legacyTierCapUsd(tier);
  if (legacy === null) return liveCap;
  return legacy;
}

/**
 * Resolved monthly cost cap (USD) for a subscriber.
 * Per-subscriber override wins over the tier default (including any legacy
 * grandfathered value) when present.
 * Always uses the EFFECTIVE tier (personal max'd against active team-seat orgs).
 */
export function effectiveCostCapUsd(
  sub: Pick<Subscriber, "monthlyCostCapUsdOverride" | "createdAt">,
  effectiveTier: SubscriberTier,
  now: Date = new Date(),
): number {
  if (sub.monthlyCostCapUsdOverride !== null && sub.monthlyCostCapUsdOverride !== undefined) {
    const n = Number(sub.monthlyCostCapUsdOverride);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return resolveTierDefaultCapUsd(effectiveTier, sub, now);
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
  sub: Pick<Subscriber, "monthlyCostCapUsdOverride" | "createdAt">,
  effectiveTier: SubscriberTier,
  now: Date = new Date(),
): Promise<CostStatus> {
  const usedUsd = await currentMonthCostForUser(userId);
  const capUsd = effectiveCostCapUsd(sub, effectiveTier, now);
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
    tierDefaultUsd: resolveTierDefaultCapUsd(effectiveTier, sub, now),
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
