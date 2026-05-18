import { Router, type IRouter } from "express";
import { db, commandCentreSubscribersTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/cron/reset-harness-limits", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers["x-cron-secret"];
  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
      limitsResetAt: new Date(),
    });
  res.json({ ok: true });
});

export default router;
