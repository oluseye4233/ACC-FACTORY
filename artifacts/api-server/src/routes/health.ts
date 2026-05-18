import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res): void => {
  res.json({ status: "ok" });
});

router.get("/health", async (_req, res): Promise<void> => {
  let dbStatus: "ok" | "error" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbStatus = "error";
  }
  const engines: "ok" | "degraded" = process.env.ANTHROPIC_API_KEY ? "ok" : "degraded";
  res.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    db: dbStatus,
    engines,
    version: process.env.npm_package_version ?? "0.1.0",
  });
});

export default router;
