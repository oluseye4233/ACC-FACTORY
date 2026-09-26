import type { NextFunction, Request, Response } from "express";
import { and, gte, lt, sql } from "drizzle-orm";
import {
  db,
  costBudgetReservationsTable,
  harnessEngineRunsTable,
  type Subscriber,
  type SubscriberTier,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { MONTHLY_COST_CAP_USD } from "./tier";
import { maybeDispatchCostCapAlerts } from "./cost-cap-alerts";

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

/**
 * The single company-wide monthly LLM spend cap (USD). In internal-staff mode
 * there are no per-tier subscriber caps — one ceiling protects the whole org
 * against runaway spend. Configured via `STAFF_MONTHLY_COST_CAP_USD`
 * (default 1000). This is the only cost gate `requireCostBudget` enforces.
 */
export function globalMonthlyCostCapUsd(): number {
  const n = Number(process.env.STAFF_MONTHLY_COST_CAP_USD);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

/**
 * Sum of `harness_engine_runs.cost_usd` across ALL users for the current
 * calendar month (UTC) — the org-wide spend used against the single cap.
 */
export async function currentMonthCostGlobal(): Promise<number> {
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd})::numeric, 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(gte(harnessEngineRunsTable.createdAt, sql`date_trunc('month', now() at time zone 'utc')`));
  const total = rows[0]?.total;
  if (!total) return 0;
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

export interface GlobalMonthlyCostBreakdown {
  /** Completed provider charges recorded in the run ledger. */
  usedUsd: number;
  /** Active, unexpired worst-case estimates reserved for in-flight calls. */
  reservedUsd: number;
}

/**
 * Read completed charges and active reservations from one database snapshot.
 * A successful call replaces its reservation with a run row transactionally,
 * so this query cannot observe an artificial gap between those two states.
 */
export async function currentMonthCostGlobalBreakdown(): Promise<GlobalMonthlyCostBreakdown> {
  const result = await db.execute<{
    used_usd: string;
    reserved_usd: string;
  }>(sql`
    SELECT
      COALESCE((
        SELECT SUM(${harnessEngineRunsTable.costUsd})::numeric
        FROM ${harnessEngineRunsTable}
        WHERE ${harnessEngineRunsTable.createdAt} >= date_trunc('month', now() at time zone 'utc')
      ), 0)::numeric AS used_usd,
      COALESCE((
        SELECT SUM(${costBudgetReservationsTable.amountUsd})::numeric
        FROM ${costBudgetReservationsTable}
        WHERE ${costBudgetReservationsTable.createdAt} >= date_trunc('month', now() at time zone 'utc')
          AND ${costBudgetReservationsTable.expiresAt} >= now()
      ), 0)::numeric AS reserved_usd
  `);
  const row = result.rows[0];
  const used = Number(row?.used_usd ?? 0);
  const reserved = Number(row?.reserved_usd ?? 0);
  return {
    usedUsd: Number.isFinite(used) ? used : 0,
    reservedUsd: Number.isFinite(reserved) ? reserved : 0,
  };
}

/**
 * Committed spend plus live in-flight reservations for the current UTC month.
 * One SQL statement gives a consistent snapshot while a reservation is
 * atomically replaced by its recorded provider run.
 */
export async function currentMonthCostGlobalWithReservations(): Promise<number> {
  const { usedUsd, reservedUsd } = await currentMonthCostGlobalBreakdown();
  return usedUsd + reservedUsd;
}

export interface CostBudgetDenial {
  status: 402;
  body: {
    error: "Monthly LLM cost cap reached";
    code: "COST_CAP_EXCEEDED";
    usedUsd: number;
    capUsd: number;
    detail: string;
  };
}

export class CostBudgetExceededError extends Error {
  constructor(readonly denial: CostBudgetDenial) {
    super(denial.body.error);
    this.name = "CostBudgetExceededError";
  }
}

export type CostBudgetReservationResult =
  | { ok: true; reservationId: string }
  | { ok: false; denial: CostBudgetDenial };

const COST_BUDGET_RESERVATION_TTL_MS = 60 * 60 * 1000;

function costBudgetDenial(usedUsd: number, capUsd: number): CostBudgetDenial {
  return {
    status: 402,
    body: {
      error: "Monthly LLM cost cap reached",
      code: "COST_CAP_EXCEEDED",
      usedUsd,
      capUsd,
      detail:
        "The company-wide monthly LLM spend cap has been reached or does not have enough remaining balance for a safe model call. It resets at the start of next month UTC. Contact an admin to raise STAFF_MONTHLY_COST_CAP_USD sooner.",
    },
  };
}

/**
 * Reserve a conservative upper bound for one provider request. A transaction-
 * scoped PostgreSQL advisory lock makes the sum-and-insert atomic across API
 * workers. Amounts are rounded upward to the ledger's six decimal places.
 */
export async function reserveCostBudget(
  estimatedCostUsd: number,
): Promise<CostBudgetReservationResult> {
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd <= 0) {
    throw new Error("A positive finite model-call cost estimate is required.");
  }
  const amountUsd = (Math.ceil(estimatedCostUsd * 1_000_000) / 1_000_000).toFixed(6);

  return db.transaction(async (tx) => {
    // All workers use the same lock key. Keep the lock transaction short; it
    // covers only counting and inserting, never the external provider call.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(742193, 1)`);
    await tx
      .delete(costBudgetReservationsTable)
      .where(lt(costBudgetReservationsTable.expiresAt, sql`now()`));

    const [spentRows, reservationRows] = await Promise.all([
      tx
        .select({
          total: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd})::numeric, 0)`,
        })
        .from(harnessEngineRunsTable)
        .where(gte(harnessEngineRunsTable.createdAt, sql`date_trunc('month', now() at time zone 'utc')`)),
      tx
        .select({
          total: sql<string>`COALESCE(SUM(${costBudgetReservationsTable.amountUsd})::numeric, 0)`,
        })
        .from(costBudgetReservationsTable)
        .where(
          and(
            gte(costBudgetReservationsTable.createdAt, sql`date_trunc('month', now() at time zone 'utc')`),
            gte(costBudgetReservationsTable.expiresAt, sql`now()`),
          ),
        ),
    ]);
    const spentUsd = Number(spentRows[0]?.total ?? 0);
    const reservedUsd = Number(reservationRows[0]?.total ?? 0);
    const usedUsd = spentUsd + reservedUsd;
    const capUsd = globalMonthlyCostCapUsd();
    maybeDispatchCostCapAlerts(usedUsd, capUsd);

    if (usedUsd >= capUsd || usedUsd + Number(amountUsd) > capUsd) {
      return { ok: false, denial: costBudgetDenial(usedUsd, capUsd) };
    }

    const [reservation] = await tx
      .insert(costBudgetReservationsTable)
      .values({
        amountUsd,
        expiresAt: new Date(Date.now() + COST_BUDGET_RESERVATION_TTL_MS),
      })
      .returning({ id: costBudgetReservationsTable.id });
    if (!reservation) throw new Error("Failed to persist model-call cost reservation.");
    return { ok: true, reservationId: reservation.id };
  });
}

/** Release a reservation after a provider call fails before returning usage. */
export async function releaseCostBudgetReservation(reservationId: string): Promise<void> {
  await db
    .delete(costBudgetReservationsTable)
    .where(eq(costBudgetReservationsTable.id, reservationId));
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
  const userId = req.localUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const denial = await getCostBudgetDenial(req, userId);
  if (denial) {
    res.status(denial.status).json(denial.body);
    return;
  }
  next();
}

/**
 * Anonymous variant of {@link requireCostBudget} for the pre-auth acquisition
 * magnets (D25). The magnet routes call the LLM without a signed-in user, so the
 * per-user 401 guard would reject every request. This gate enforces the SAME
 * company-wide monthly spend cap (the magnet's LLM spend is recorded into
 * `harness_engine_runs`, so it counts toward the global SUM) without requiring a
 * local user. Mount AFTER the per-IP rate limiter, matching the ordering rule
 * for `requireCostBudget`.
 */
export async function requireGlobalCostBudget(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const denial = await getCostBudgetDenial(req, null);
  if (denial) {
    res.status(denial.status).json(denial.body);
    return;
  }
  next();
}

/**
 * Return the standard global-cap response when spend has reached the cap.
 * Callers that make multiple model calls in one request can recheck between
 * calls and preserve their own execution state before sending this response.
 */
export async function getCostBudgetDenial(
  req: Request,
  userId: string | null,
): Promise<CostBudgetDenial | null> {
  try {
    const usedUsd = await currentMonthCostGlobalWithReservations();
    const capUsd = globalMonthlyCostCapUsd();
    // Fire-and-forget: email admins the first time spend crosses 80/95/100%
    // of the cap this UTC month (exactly-once via cost_cap_notifications).
    maybeDispatchCostCapAlerts(usedUsd, capUsd);
    if (usedUsd >= capUsd) {
      return costBudgetDenial(usedUsd, capUsd);
    }
  } catch (err) {
    // Cost-budget lookup must never harden into a hard failure mode — if the
    // SUM query fails (DB blip), log and let the request through. The worst
    // case is a brief window where one engine call slips past the spend ceiling.
    req.log.warn({ err, userId }, "requireCostBudget lookup failed; allowing request");
  }
  return null;
}
