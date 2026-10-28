import { Router, type IRouter } from "express";
import { getPlatformServiceInventory } from "../lib/platform-services";

const router: IRouter = Router();

// No account data or runtime configuration. Never use this as an authorization gate.
router.get("/platform-services", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getPlatformServiceInventory());
});

export default router;
