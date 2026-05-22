import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import sessionsRouter from "./sessions";
import artifactsRouter from "./artifacts";
import billingRouter from "./billing";
import pricingRouter from "./pricing";
import cronRouter from "./cron";
import verifyRouter from "./verify";
import exemplarsRouter from "./exemplars";
import harnessRouter from "./harness";
import promptsRouter from "./prompts";
import exportsRouter from "./exports";
import badgesRouter from "./badges";
import ingestRouter from "./ingest";
import cartridgeRouter from "./cartridge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(promptsRouter);
router.use(exportsRouter);
router.use(badgesRouter);
router.use(sessionsRouter);
router.use(artifactsRouter);
router.use(billingRouter);
router.use(pricingRouter);
router.use(cronRouter);
router.use(verifyRouter);
router.use(exemplarsRouter);
router.use(harnessRouter);
router.use(ingestRouter);
router.use(cartridgeRouter);

export default router;
