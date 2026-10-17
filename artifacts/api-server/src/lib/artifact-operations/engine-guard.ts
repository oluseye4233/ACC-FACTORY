import type { RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, harnessFeatureStateTable, harnessSessionsTable } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth } from "../auth";

/** A skipped stage is not an unlocked legacy full-path engine. */
export const guardSkippedEngine: RequestHandler = (req, res, next) => {
  const match = /^\/harness\/(?:sessions\/([0-9a-f-]{36})\/)?f([5-9])(?:-|\/|$)/i.exec(req.path);
  if (req.method !== "POST" || !match) return next();
  return requireAuth(req, res, () => {
    void (async () => {
      const session = z.string().uuid().safeParse(match[1] ?? req.body?.sessionId);
      if (!session.success) return next(); // The original handler owns input validation.
      const [row] = await db.select({ status: harnessFeatureStateTable.status }).from(harnessFeatureStateTable)
        .innerJoin(harnessSessionsTable, eq(harnessSessionsTable.id, harnessFeatureStateTable.sessionId))
        .where(and(eq(harnessSessionsTable.id, session.data), eq(harnessSessionsTable.userId, req.localUser!.id), eq(harnessFeatureStateTable.featureId, Number(match[2]))));
      if (row?.status === "SKIPPED_BY_SC") { res.status(409).json({ error: "This stage is skipped by the active short route. Withdraw or obtain an approved promotion before starting the full-path engine.", code: "SHORT_ROUTE_STAGE_SKIPPED" }); return; }
      next();
    })().catch(next);
  });
};
