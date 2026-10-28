import { Router } from "express";
import { z } from "zod/v4";
import { CreatePortalPublicationBody, DownloadPortalPublicationBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { CreatorError } from "../lib/agent-creator";
import { issuePublicationCode, portalWorkspace, preparePublication, redeemPublication } from "../lib/imprima-portal";

const router = Router();
router.use("/imprima-portal", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
const uuid = z.string().uuid();
function failure(res: import("express").Response, err: unknown) {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid publication request." });
  if (err instanceof CreatorError) return res.status(err.status).json({ error: err.message });
  return res.status(503).json({ error: "Publication could not be confirmed. No download has been authorized. Check saved publication status." });
}
router.get("/imprima-portal", requireAuth, async (req, res) => {
  try { res.json(await portalWorkspace(req.localUser!.id)); } catch (err) { failure(res, err); }
});
router.post("/imprima-portal/publications", requireAuth, async (req, res) => {
  try { res.json(await preparePublication(req.localUser!.id, CreatePortalPublicationBody.parse(req.body))); } catch (err) { failure(res, err); }
});
router.post("/imprima-portal/publications/:publicationId/code", requireAuth, async (req, res) => {
  try { res.json(await issuePublicationCode(req.localUser!.id, uuid.parse(req.params.publicationId))); } catch (err) { failure(res, err); }
});
router.post("/imprima-portal/publications/:publicationId/download", requireAuth, async (req, res) => {
  try {
    const file = await redeemPublication(req.localUser!.id, uuid.parse(req.params.publicationId), DownloadPortalPublicationBody.parse(req.body));
    res.set({ "Content-Type": file.mime, "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'" }).send(file.bytes);
  } catch (err) { failure(res, err); }
});
export default router;
