import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { learningIdentity } from "../lib/learning-identity";
import { autoCommandCatalog } from "../lib/autocommand/catalog";
import {
  AutoCommandError, AutoCommandIntakeSchema, autoCommandWorkspace, saveAutoCommandDraft, uploadAutoCommandFile,
} from "../lib/autocommand/intake";
import { DocumentExtractionError, documentExtractionErrorResponse } from "../lib/document-extraction";
import { getAutoCommandOrder, listAutoCommandOrders, prepareAutoCommandOrder } from "../lib/autocommand/orders";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_000_000, files: 1, fields: 1 } });

function failure(res: Response, error: unknown) {
  if (error instanceof AutoCommandError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") }); return;
  }
  if (error instanceof DocumentExtractionError) { res.status(400).json(documentExtractionErrorResponse(error)); return; }
  res.status(503).json({ error: "AutoCommand could not confirm this request. Reload your private workspace before retrying the same draft or request key. Do not assume the action completed." });
}

router.get("/autocommand/catalog", (_req, res) => res.json(autoCommandCatalog()));
router.get("/autocommand/workspace", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const identity = await learningIdentity(req);
    if (!identity) { res.json({ authenticated: false, verifiedEmail: null, drafts: [], orders: [] }); return; }
    const workspace = await autoCommandWorkspace(identity.user.id, identity.email);
    res.json({ ...workspace, orders: await listAutoCommandOrders(identity.user.id) });
  } catch (error) { req.log.warn({ err: error }, "AutoCommand workspace unavailable"); failure(res, error); }
});

/** Shared staff identity is intentionally not accepted for the customer promotion. */
async function verifiedCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await learningIdentity(req);
    if (!identity) { res.status(401).json({ error: "Sign in with your own verified email address. Shared staff access cannot identify an AutoCommand customer." }); return; }
    req.localUser = identity.user;
    req.studentVerifiedEmail = identity.email;
    next();
  } catch (error) { failure(res, error); }
}

router.post("/autocommand/drafts", verifiedCustomer, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    res.json(await saveAutoCommandDraft(req.localUser!.id, req.studentVerifiedEmail!, AutoCommandIntakeSchema.parse(req.body)));
  } catch (error) { failure(res, error); }
});
router.post("/autocommand/orders", verifiedCustomer, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const { draftId } = z.object({ draftId: z.uuid() }).strict().parse(req.body);
    res.json(await prepareAutoCommandOrder(req.localUser!.id, req.studentVerifiedEmail!, draftId));
  } catch (error) { failure(res, error); }
});
router.get("/autocommand/orders/:orderId", verifiedCustomer, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    res.json(await getAutoCommandOrder(req.localUser!.id, z.uuid().parse(req.params.orderId)));
  } catch (error) { failure(res, error); }
});
router.post("/imprima-portal/autocommand/uploads", verifiedCustomer, (req, res) => {
  upload.single("file")(req, res, async error => {
    res.set("Cache-Control", "private, no-store");
    if (error) { res.status(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
      .json({ error: "Use one file up to 5 MB, with a DOCUMENT or LOGO purpose." }); return; }
    try {
      if (!req.file) throw new AutoCommandError(400, "Choose an intake file.");
      const purpose = z.enum(["DOCUMENT", "LOGO"]).parse(req.body.purpose);
      res.json(await uploadAutoCommandFile(req.localUser!.id, purpose, req.file));
    } catch (err) { failure(res, err); }
  });
});

// Preparing an order is not authorization. No checkout/run/email endpoints exist.
export default router;
