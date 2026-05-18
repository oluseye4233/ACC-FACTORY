import { Router, type IRouter } from "express";
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
      cancelAtPeriodEnd: s.cancelAtPeriodEnd === "true",
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

export default router;
