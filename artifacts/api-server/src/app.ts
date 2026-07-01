import * as Sentry from "@sentry/node";

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason);
  });
}

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripe-webhook";
import { logger } from "./lib/logger";

// NOTE: Clerk has been lifted out of the active request path — the portal now
// authenticates staff via a signed access-code cookie (see lib/staff-auth.ts).
// The Clerk packages + `middlewares/clerkProxyMiddleware.ts` remain in the repo
// (dormant) so paid subscriptions can be reinstated later without a rewrite.

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Stripe webhook mounts BEFORE the body parsers so it can read the raw body for
// signature verification (gotcha #1 — order matters).
app.use("/api/webhooks/stripe", stripeWebhookRouter);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Signed cookies carry the staff session (see lib/staff-auth.ts).
app.use(cookieParser(process.env.SESSION_SECRET));

app.use("/api", router);

// Sentry error handler — must come after routes but before any custom handler.
app.use((err: unknown, req: Request, res: Response, next: NextFunction): void => {
  if (sentryDsn) Sentry.captureException(err);
  req.log.error({ err }, "Unhandled request error");
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
