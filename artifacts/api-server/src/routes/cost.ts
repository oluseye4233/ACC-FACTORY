import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  harnessEngineRunsTable,
  commandCentreSubscribersTable,
  usersTable,
} from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";
import { loadCostStatus } from "../lib/cost-budget";

const router: IRouter = Router();

interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  costUsd: number;
  runs: number;
}
interface EnginePoint {
  engineId: number;
  costUsd: number;
  runs: number;
}
interface RecentRun {
  id: string;
  ts: string;
  engineId: number;
  sessionId: string;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

/**
 * GET /api/me/cost-summary
 *
 * Returns the caller's month-to-date LLM cost rollup:
 *   - monthToDate: usedUsd + capUsd + percentUsed + overCap (live SUM)
 *   - dailyBreakdown: last 30 days (UTC) of cost + run count
 *   - byEngine: per-engine totals for the current month
 *   - recentRuns: most recent 20 engine runs
 */
router.get("/me/cost-summary", requireAuth, async (req, res) => {
  const userId = req.localUser!.id;
  const sub = req.subscriber!;
  const effectiveTier = req.effectiveTier ?? sub.tier;

  const status = await loadCostStatus(userId, sub, effectiveTier);

  // Daily breakdown — last 30 days UTC, including zero-cost days so the chart
  // can render a full month even for low-volume users.
  const dailyRows = await db.execute(
    sql`
      SELECT
        to_char(d, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(r.cost_usd), 0)::float8 AS cost_usd,
        COUNT(r.id)::int AS runs
      FROM generate_series(
        (date_trunc('day', now() at time zone 'utc') - interval '29 days')::date,
        (date_trunc('day', now() at time zone 'utc'))::date,
        interval '1 day'
      ) AS d
      LEFT JOIN ${harnessEngineRunsTable} r
        ON r.user_id = ${userId}::uuid
       AND date_trunc('day', r.created_at at time zone 'utc')::date = d::date
      GROUP BY d
      ORDER BY d ASC
    `,
  );
  const dailyBreakdown: DailyPoint[] = (
    dailyRows as unknown as { rows: Array<{ date: string; cost_usd: number; runs: number }> }
  ).rows.map((r) => ({
    date: r.date,
    costUsd: Number(r.cost_usd) || 0,
    runs: Number(r.runs) || 0,
  }));

  // Per-engine totals for the current month.
  const monthStart = sql`date_trunc('month', now() at time zone 'utc')`;
  const byEngineRows = await db
    .select({
      engineId: harnessEngineRunsTable.engineId,
      costUsd: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)::numeric`,
      runs: sql<number>`COUNT(*)::int`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, monthStart),
      ),
    )
    .groupBy(harnessEngineRunsTable.engineId)
    .orderBy(harnessEngineRunsTable.engineId);
  const byEngine: EnginePoint[] = byEngineRows.map((r) => ({
    engineId: r.engineId,
    costUsd: Number(r.costUsd) || 0,
    runs: Number(r.runs) || 0,
  }));

  const recentRows = await db
    .select({
      id: harnessEngineRunsTable.id,
      ts: harnessEngineRunsTable.createdAt,
      engineId: harnessEngineRunsTable.engineId,
      sessionId: harnessEngineRunsTable.sessionId,
      provider: harnessEngineRunsTable.provider,
      modelId: harnessEngineRunsTable.modelId,
      inputTokens: harnessEngineRunsTable.inputTokens,
      outputTokens: harnessEngineRunsTable.outputTokens,
      costUsd: harnessEngineRunsTable.costUsd,
      durationMs: harnessEngineRunsTable.durationMs,
    })
    .from(harnessEngineRunsTable)
    .where(eq(harnessEngineRunsTable.userId, userId))
    .orderBy(sql`${harnessEngineRunsTable.createdAt} DESC`)
    .limit(20);
  const recentRuns: RecentRun[] = recentRows.map((r) => ({
    id: r.id,
    ts: r.ts.toISOString(),
    engineId: r.engineId,
    sessionId: r.sessionId,
    provider: r.provider,
    modelId: r.modelId,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    costUsd: Number(r.costUsd) || 0,
    durationMs: r.durationMs,
  }));

  res.json({
    tier: sub.tier,
    effectiveTier,
    monthToDate: {
      usedUsd: status.usedUsd,
      capUsd: status.capUsd,
      percentUsed: status.percentUsed,
      overCap: status.overCap,
      tierDefaultUsd: status.tierDefaultUsd,
      overrideUsd: status.overrideUsd,
    },
    dailyBreakdown,
    byEngine,
    recentRuns,
  });
});

const CostCapBody = z.object({
  // `null` clears the override and returns the user to the tier default.
  monthlyCostCapUsdOverride: z
    .union([z.number().nonnegative().finite(), z.null()]),
});

/**
 * PATCH /api/admin/subscribers/:userId/cost-cap
 * Admin-only. Sets (or clears with `null`) the per-subscriber override.
 */
router.patch(
  "/admin/subscribers/:userId/cost-cap",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parse = CostCapBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid body", detail: parse.error.message });
      return;
    }
    const userIdParam = req.params.userId;
    const userId = typeof userIdParam === "string" ? userIdParam : "";
    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }
    const targets = await db
      .select({ id: commandCentreSubscribersTable.id, userId: usersTable.id })
      .from(commandCentreSubscribersTable)
      .innerJoin(usersTable, eq(usersTable.id, commandCentreSubscribersTable.userId))
      .where(eq(commandCentreSubscribersTable.userId, userId))
      .limit(1);
    if (targets.length === 0) {
      res.status(404).json({ error: "Subscriber not found" });
      return;
    }
    const value =
      parse.data.monthlyCostCapUsdOverride === null
        ? null
        : parse.data.monthlyCostCapUsdOverride.toFixed(2);
    const [updated] = await db
      .update(commandCentreSubscribersTable)
      .set({ monthlyCostCapUsdOverride: value })
      .where(eq(commandCentreSubscribersTable.userId, userId))
      .returning();
    req.log.info(
      {
        targetUserId: userId,
        adminUserId: req.localUser!.id,
        newOverride: value,
      },
      "Admin updated subscriber monthly cost cap override",
    );
    res.json({
      ok: true,
      userId,
      monthlyCostCapUsdOverride:
        updated?.monthlyCostCapUsdOverride === null ||
        updated?.monthlyCostCapUsdOverride === undefined
          ? null
          : Number(updated.monthlyCostCapUsdOverride),
    });
  },
);

const TierGrantBody = z.object({
  tier: z.enum(["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"]),
  // Optional validity window in days (default 365). Ignored when downgrading
  // to EXPLORER, which clears the period entirely.
  days: z.number().int().positive().max(3650).optional(),
});

/**
 * PATCH /api/admin/subscribers/:userId/tier
 * Admin-only. Directly sets a subscriber's tier without going through Stripe —
 * used to comp/grant access (e.g. staff or test accounts) on environments where
 * a real checkout is not appropriate. Sets status='active' and a forward-dated
 * period end for non-EXPLORER tiers; granting EXPLORER resets to inactive.
 *
 * This does NOT touch Stripe — a later webhook from a real subscription will
 * legitimately overwrite these values.
 */
router.patch(
  "/admin/subscribers/:userId/tier",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parse = TierGrantBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid body", detail: parse.error.message });
      return;
    }
    const userIdParam = req.params.userId;
    const userId = typeof userIdParam === "string" ? userIdParam : "";
    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }
    const targets = await db
      .select({ id: commandCentreSubscribersTable.id })
      .from(commandCentreSubscribersTable)
      .where(eq(commandCentreSubscribersTable.userId, userId))
      .limit(1);
    if (targets.length === 0) {
      res.status(404).json({ error: "Subscriber not found" });
      return;
    }

    const { tier } = parse.data;
    const isExplorer = tier === "EXPLORER";
    const periodEnd = isExplorer
      ? null
      : new Date(Date.now() + (parse.data.days ?? 365) * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(commandCentreSubscribersTable)
      .set({
        tier,
        status: isExplorer ? "inactive" : "active",
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .where(eq(commandCentreSubscribersTable.userId, userId))
      .returning();

    req.log.info(
      {
        targetUserId: userId,
        adminUserId: req.localUser!.id,
        newTier: tier,
      },
      "Admin granted subscriber tier",
    );
    res.json({
      ok: true,
      userId,
      tier: updated?.tier,
      status: updated?.status,
      currentPeriodEnd: updated?.currentPeriodEnd ?? null,
    });
  },
);

export default router;
