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

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(sessionsRouter);
router.use(artifactsRouter);
router.use(billingRouter);
router.use(pricingRouter);
router.use(cronRouter);
router.use(verifyRouter);
router.use(exemplarsRouter);
router.use(harnessRouter);

export default router;
