import type { NextFunction, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  commandCentreSubscribersTable,
  harnessEscalationsTable,
  harnessSessionsTable,
  type SubscriberTier,
} from "@workspace/db";

const TIER_RANK: Record<SubscriberTier, number> = {
  EXPLORER: 0,
  PRACTITIONER: 1,
  ARCHITECT: 2,
  INSTITUTION: 3,
};

// Daily rate-limits per tier per feature. -1 = unlimited.
const RATE_LIMITS: Record<SubscriberTier, Record<number, number>> = {
  EXPLORER: { 1: 5, 2: 3, 3: 1, 4: 1, 5: 0, 6: 0, 7: 0 },
  PRACTITIONER: { 1: 50, 2: 25, 3: 10, 4: 10, 5: 5, 6: 5, 7: 3 },
  ARCHITECT: { 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1 },
  INSTITUTION: { 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1 },
};

const FEATURE_COL: Record<number, string> = {
  1: "f1_today",
  2: "f2_today",
  3: "f3_today",
  4: "f4_today",
  5: "f5_today",
  6: "f6_today",
  7: "f7_today",
};

export function requireTier(minTier: SubscriberTier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sub = req.subscriber;
    const userId = req.localUser?.id;
    if (!sub || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (TIER_RANK[sub.tier] >= TIER_RANK[minTier]) {
      next();
      return;
    }
    // Escalation bypass — only valid if the escalated session belongs to this user.
    const sessionId =
      typeof req.body === "object" && req.body !== null
        ? (req.body as Record<string, unknown>).sessionId
        : undefined;
    if (typeof sessionId === "string") {
      const esc = await db
        .select({ id: harnessEscalationsTable.id })
        .from(harnessEscalationsTable)
        .innerJoin(
          harnessSessionsTable,
          eq(harnessSessionsTable.id, harnessEscalationsTable.sessionId),
        )
        .where(
          and(
            eq(harnessEscalationsTable.sessionId, sessionId),
            eq(harnessSessionsTable.userId, userId),
          ),
        )
        .limit(1);
      if (esc.length > 0) {
        next();
        return;
      }
    }
    res
      .status(403)
      .json({ error: `Tier ${minTier} required`, detail: `current=${sub.tier}` });
  };
}

export function rateLimit(featureId: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sub = req.subscriber;
    if (!sub) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const limit = RATE_LIMITS[sub.tier][featureId] ?? 0;
    if (limit === 0) {
      res.status(403).json({ error: `Feature F${featureId} not available on ${sub.tier}` });
      return;
    }
    // Single atomic statement: increment iff under limit. Unlimited (-1) always increments.
    const col = sql.identifier(FEATURE_COL[featureId]!);
    const updated = await db.execute(
      sql`update ${commandCentreSubscribersTable} set ${col} = ${col} + 1, updated_at = now()
          where id = ${sub.id}
            and (${limit} = -1 or ${col} < ${limit})
          returning ${col} as new_count`,
    );
    const rows = (updated as unknown as { rows: Array<{ new_count: number }> }).rows;
    if (!rows || rows.length === 0) {
      res
        .status(429)
        .json({ error: "Rate limit exceeded", detail: `F${featureId} limit ${limit}/day` });
      return;
    }
    next();
  };
}

export { TIER_RANK, RATE_LIMITS };
