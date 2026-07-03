import { Router, type IRouter } from "express";
import { requireAdmin, requireAuth } from "../lib/auth";
import {
  ensureCronTargetsSeeded,
  getCronTargetStatuses,
} from "../lib/cron-heartbeat";

const router: IRouter = Router();

/**
 * GET /api/admin/cron-status
 *
 * Dead-man's-switch view over the external Scheduled-Deployment cron ticks:
 * per-target last successful tick, tick count, and a live stale verdict
 * (overdue beyond ~2× its schedule). Staleness is computed on every read, so
 * an admin visiting the dashboard sees a dead schedule immediately even if
 * the in-process alert monitor hasn't run (e.g. right after a wake-up on
 * autoscale). Seeding first makes never-created schedules detectable too.
 */
router.get("/admin/cron-status", requireAuth, requireAdmin, async (req, res) => {
  await ensureCronTargetsSeeded();
  const targets = await getCronTargetStatuses();
  res.json({ generatedAt: new Date().toISOString(), targets });
});

export default router;
