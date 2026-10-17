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
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import pinoHttp from "pino-http";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripe-webhook";
import { logger } from "./lib/logger";
import { assertBootCriticalConfig } from "./lib/boot-config";

// Fail fast if any boot-critical setting is missing (STAFF_ACCESS_CODE,
// SESSION_SECRET, DATABASE_URL — see lib/boot-config.ts for the full list). In
// production this throws and refuses to boot so a misconfigured deploy fails
// loudly instead of coming up broken; in development it logs a single warning so
// local runs aren't blocked.
assertBootCriticalConfig(logger);

// Staff retain their signed access-code cookie. Clerk verifies independent
// student identities; it does not replace staff access or confer staff roles.

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
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Signed cookies carry the staff session (see lib/staff-auth.ts).
app.use(cookieParser(process.env.SESSION_SECRET));
// Staff sessions remain unchanged; Clerk provides separate verified student identities.
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

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
