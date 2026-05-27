import { Router, type IRouter } from "express";
import { db, commandCentreSubscribersTable } from "@workspace/db";
import { runWeeklyDigest } from "../lib/notification-dispatch";

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
  res.json({ ok: true });
});

router.post("/cron/send-weekly-digest", async (req, res): Promise<void> => {
  if (!requireCronSecret(req, res)) return;
  const result = await runWeeklyDigest();
  res.json({ ok: true, ...result });
});

export default router;
