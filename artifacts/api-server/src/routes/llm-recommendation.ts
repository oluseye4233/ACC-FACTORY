import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth";
import { recommendLlm } from "../lib/llm-recommendation";

const querySchema = z.object({
  featureId: z.coerce.number().int().min(0).max(14).optional(),
  complexity: z.enum(["auto", "simple", "standard", "complex"]).default("auto"),
});
const router: IRouter = Router();
router.get("/llm/recommendation", requireAuth, (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid stage or complexity" });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.json(recommendLlm({
    ...parsed.data, tier: req.subscriber?.tier ?? "EXPLORER",
  }));
});
export default router;
