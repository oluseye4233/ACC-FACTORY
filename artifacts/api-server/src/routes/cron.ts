import { Router, type IRouter } from "express";
import { db, commandCentreSubscribersTable } from "@workspace/db";
import { runWeeklyDigest } from "../lib/notification-dispatch";
import { runF0MonitoringSweep } from "../engines/f0";
import { runCostCapAlertSweepOnce } from "../lib/cost-cap-sweeper";
import { recordCronTick } from "../lib/cron-heartbeat";

const router: IRouter = Router();

function requireCronSecret(
  req: import("express").Request,
  res: import("express").Response,
): boolean {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers["x-cron-secret"];
  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.post("/cron/reset-harness-limits", async (req, res): Promise<void> => {
  if (!requireCronSecret(req, res)) return;
  await db
    .update(commandCentreSubscribersTable)
    .set({
      f1Today: 0,
      f2Today: 0,
      f3Today: 0,
      f4Today: 0,
      f5Today: 0,
      f6Today: 0,
      f7Today: 0,
      f8Today: 0,
      limitsResetAt: new Date(),
    });
  await recordCronTick("reset-harness-limits");
  res.json({ ok: true });
});

router.post("/cron/send-weekly-digest", async (req, res): Promise<void> => {
  if (!requireCronSecret(req, res)) return;
  const result = await runWeeklyDigest();
  await recordCronTick("weekly-digest");
  res.json({ ok: true, ...result });
});

router.post("/cron/run-f0-monitoring", async (req, res): Promise<void> => {
  if (!requireCronSecret(req, res)) return;
  const result = await runF0MonitoringSweep();
  await recordCronTick("run-f0-monitoring");
  res.json({ ok: true, ...result });
});

// Cost-cap alert sweep on demand. Production runs on autoscale: with zero
// traffic the instance scales down and the in-process 15-minute sweeper
// (src/lib/cost-cap-sweeper.ts) cannot fire. An external Scheduled Deployment
// tick hits this endpoint every 15–30 minutes so threshold detection stays
// time-bounded even when the app is fully asleep. Safe to coexist with the
// in-process sweep: exactly-once is guaranteed by the UNIQUE
// (month, threshold_percent) stamp in cost_cap_notifications.
router.post("/cron/sweep-cost-cap-alerts", async (req, res): Promise<void> => {
  if (!requireCronSecret(req, res)) return;
  await runCostCapAlertSweepOnce();
  await recordCronTick("sweep-cost-cap-alerts");
  res.json({ ok: true });
});

export default router;
