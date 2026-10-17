import { Router, type IRouter } from "express";
import { getLaunchReadiness, probeDatabase, hasConfiguredAi } from "../lib/launch-readiness";

const router: IRouter = Router();

router.get("/launch-readiness", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getLaunchReadiness());
});

router.get("/readyz", async (_req, res): Promise<void> => {
  const readiness = await getLaunchReadiness();
  res.setHeader("Cache-Control", "no-store");
  res.status(readiness.buildReady ? 200 : 503).json(readiness);
});

router.get("/healthz", (_req, res): void => {
  res.json({ status: "ok" });
});

router.get("/health", async (_req, res): Promise<void> => {
  const dbStatus = (await probeDatabase()).database === "available" ? "ok" : "error";
  // Engines can reach Claude via either (a) a direct Anthropic key, or
  // (b) the Replit AI Integrations proxy (preferred in production).
  const hasLlm = hasConfiguredAi();
  const engines: "ok" | "degraded" = hasLlm ? "ok" : "degraded";
  res.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    db: dbStatus,
    engines,
    version: process.env.npm_package_version ?? "0.1.0",
  });
});

export default router;
