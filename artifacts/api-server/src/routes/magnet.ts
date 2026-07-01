import { Router, type IRouter } from "express";
import { MagnetConversionBody } from "@workspace/api-zod";
import { requireGlobalCostBudget } from "../lib/cost-budget";
import { magnetRateLimit, markMagnetConverted } from "../lib/magnet";
import { handleMagnetTestKit } from "../engines/magnet-test-kit";
import { handleMagnetCalculator } from "../engines/magnet-calculator";

/**
 * Anonymous, pre-auth acquisition magnets (D25).
 *
 * These routes are deliberately mounted WITHOUT `requireAuth` — they exist to
 * convert anonymous visitors. Each LLM-touching route runs:
 *   magnetRateLimit (5/hr per IP+email)  →  requireGlobalCostBudget  →  handler
 * matching the "cost gate after the rate limiter" ordering rule, but with the
 * anonymous (no-user) variant of the cost cap so magnet spend still counts
 * toward the company-wide monthly ceiling.
 */
const router: IRouter = Router();

router.post("/magnet/test-kit", magnetRateLimit, requireGlobalCostBudget, handleMagnetTestKit);

router.post("/magnet/calculator", magnetRateLimit, requireGlobalCostBudget, handleMagnetCalculator);

// Conversion is a cheap DB write (no LLM) — no cost gate needed. It records that
// a magnet visitor clicked through to the staff front door.
router.post("/magnet/conversion", async (req, res): Promise<void> => {
  const parsed = MagnetConversionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const ok = await markMagnetConverted(parsed.data.magnetSessionId);
    if (!ok) {
      res.status(404).json({ error: "Magnet session not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Magnet conversion record failed");
    res.status(500).json({ error: "Failed to record conversion" });
  }
});

export default router;
