import { Router } from "express";
import { z } from "zod/v4";
import { GetEmailDeliverySettingsQueryParams, SaveEmailDeliverySettingsBody,
  TestEmailDeliverySettingsBody, VerifyEmailDeliverySettingsBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { EmailDeliveryError, emailDeliveryView, saveEmailDelivery, testEmailDelivery, verifyEmailDelivery } from "../lib/email-delivery";
const router = Router();
router.use("/me/email-delivery", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
function fail(res: import("express").Response, err: unknown) {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid email settings. Check the fields and scope." });
  if (err instanceof EmailDeliveryError) return res.status(err.status).json({ error: err.message });
  return res.status(503).json({ error: "Email configuration could not be confirmed. No credentials have been returned." });
}
router.get("/me/email-delivery", requireAuth, async (req, res) => {
  try { const input = GetEmailDeliverySettingsQueryParams.parse(req.query); res.json(await emailDeliveryView({ userId: req.localUser!.id, organizationId: input.organizationId })); } catch (err) { fail(res, err); }
});
router.put("/me/email-delivery", requireAuth, async (req, res) => {
  try { const input = SaveEmailDeliverySettingsBody.parse(req.body); res.json(await saveEmailDelivery({ userId: req.localUser!.id, organizationId: input.organizationId }, input)); } catch (err) { fail(res, err); }
});
router.post("/me/email-delivery/test", requireAuth, async (req, res) => {
  try { const input = TestEmailDeliverySettingsBody.parse(req.body); res.json(await testEmailDelivery({ userId: req.localUser!.id, organizationId: input.organizationId })); } catch (err) { fail(res, err); }
});
router.post("/me/email-delivery/verify", requireAuth, async (req, res) => {
  try { const input = VerifyEmailDeliverySettingsBody.parse(req.body); res.json(await verifyEmailDelivery({ userId: req.localUser!.id, organizationId: input.organizationId }, input.code)); } catch (err) { fail(res, err); }
});
export default router;
