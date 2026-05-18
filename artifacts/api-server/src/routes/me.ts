import { Router, type IRouter } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, harnessEngineRunsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const u = req.localUser!;
  const s = req.subscriber!;
  res.json({
    id: u.id,
    clerkUserId: u.clerkUserId,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    subscriber: {
      tier: s.tier,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      usage: {
        f1: s.f1Today,
        f2: s.f2Today,
        f3: s.f3Today,
        f4: s.f4Today,
        f5: s.f5Today,
        f6: s.f6Today,
        f7: s.f7Today,
      },
    },
  });
});

router.get("/me/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const dayRow = await db
    .select({
      tokens: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.inputTokens} + ${harnessEngineRunsTable.outputTokens}), 0)`,
      cost: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, dayStart),
      ),
    );

  const monthRow = await db
    .select({
      tokens: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.inputTokens} + ${harnessEngineRunsTable.outputTokens}), 0)`,
      cost: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)`,
    })
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.userId, userId),
        gte(harnessEngineRunsTable.createdAt, monthStart),
      ),
    );

  const byEngineRows = await db
    .select({
      engineId: harnessEngineRunsTable.engineId,
      runs: sql<string>`COUNT(*)`,
      tokens: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.inputTokens} + ${harnessEngineRunsTable.outputTokens}), 0)`,
      cost: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)`,
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

  const num = (v: string | number | undefined | null): number =>
    v === undefined || v === null ? 0 : Number(v);

  res.json({
    day: {
      totalTokens: num(dayRow[0]?.tokens),
      totalCostUsd: num(dayRow[0]?.cost),
    },
    month: {
      totalTokens: num(monthRow[0]?.tokens),
      totalCostUsd: num(monthRow[0]?.cost),
    },
    byEngine: byEngineRows.map((r) => ({
      engineId: r.engineId,
      runs: num(r.runs),
      totalTokens: num(r.tokens),
      totalCostUsd: num(r.cost),
    })),
  });
});

export default router;
