import express, { type Express } from "express";
import { describe, test, expect } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessFeatureStateTable,
  harnessEngineRunsTable,
  LLM_PROVIDERS,
  type LlmProvider,
  type Subscriber,
  type User,
} from "@workspace/db";

import { handleF1 } from "../src/engines/f1";
import { rateLimit } from "../src/lib/tier";

const PROVIDER_ENV: Record<LlmProvider, readonly string[]> = {
  claude: ["AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
  openai: ["AI_INTEGRATIONS_OPENAI_BASE_URL", "AI_INTEGRATIONS_OPENAI_API_KEY"],
  gemini: ["AI_INTEGRATIONS_GEMINI_BASE_URL", "AI_INTEGRATIONS_GEMINI_API_KEY"],
};

function providerConfigured(p: LlmProvider): boolean {
  return PROVIDER_ENV[p].every((k) => Boolean(process.env[k]));
}

function buildTestApp(localUser: User, subscriber: Subscriber): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.localUser = localUser;
    req.subscriber = subscriber;
    const noop = (): void => {};
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      trace: noop,
      fatal: noop,
      child: () => (req as unknown as { log: unknown }).log,
    };
    next();
  });
  app.post("/api/harness/f1", rateLimit(1), handleF1);
  return app;
}

async function seedFixtures(
  provider: LlmProvider,
): Promise<{ user: User; subscriber: Subscriber; sessionId: string }> {
  const stamp = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_${stamp}`,
      email: `provider-switch-${stamp}@example.test`,
      displayName: "Provider Switch Test",
    })
    .returning();
  if (!user) throw new Error("seed: user insert failed");

  const [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({
      userId: user.id,
      tier: "PRACTITIONER",
      status: "active",
    })
    .returning();
  if (!subscriber) throw new Error("seed: subscriber insert failed");

  const [session] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: user.id,
      sessionName: `provider-switch ${stamp}`,
      preferredModelProvider: provider,
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  await db.insert(harnessFeatureStateTable).values({
    sessionId: session.id,
    featureId: 1,
    status: "AVAILABLE",
  });

  return { user, subscriber, sessionId: session.id };
}

async function cleanup(userId: string): Promise<void> {
  // Cascades through subscribers, sessions, feature_state, engine_runs, artifacts.
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("provider switching end-to-end via POST /api/harness/f1", () => {
  for (const provider of LLM_PROVIDERS) {
    const configured = providerConfigured(provider);
    test.skipIf(!configured)(
      `${provider}: returns 200 and writes harness_engine_runs row with provider + non-empty modelId`,
      { timeout: 60_000 },
      async (ctx) => {
        const fx = await seedFixtures(provider);
        const app = buildTestApp(fx.user, fx.subscriber);
        const server = app.listen(0);
        try {
          await new Promise<void>((resolve) => server.once("listening", () => resolve()));
          const addr = server.address();
          if (!addr || typeof addr === "string") throw new Error("no server address");
          const port = addr.port;

          const res = await fetch(`http://127.0.0.1:${port}/api/harness/f1`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              prompt:
                "Help a busy parent plan a one-week dinner menu for a family of four with a $120 grocery budget. Output a day-by-day plan with shopping list.",
              provider,
            }),
          });

          const bodyText = await res.text();

          // Narrow runtime skip: only treat "the integration backend is not
          // available at all" as a skip — i.e. the engine's own typed
          // "provider not configured" 503, the proxy's INVALID_ENDPOINT code
          // (the provider isn't routed by the configured proxy), or a hard
          // network failure. Any other 5xx (timeouts, JSON-mode errors,
          // unknown-model 4xx surfaced as 502, token-usage parsing failures,
          // etc.) must still fail the test — those are exactly the SDK /
          // JSON-mode / shape regressions this test exists to catch.
          if (res.status === 503 && /PROVIDER_NOT_CONFIGURED/.test(bodyText)) {
            ctx.skip(
              `${provider} integration not configured: ${bodyText.slice(0, 200)}`,
            );
            return;
          }
          if (
            res.status === 502 &&
            /INVALID_ENDPOINT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/.test(bodyText)
          ) {
            ctx.skip(
              `${provider} integration unreachable at proxy: ${bodyText.slice(0, 200)}`,
            );
            return;
          }

          expect(res.status, `body=${bodyText.slice(0, 400)}`).toBe(200);

          const runs = await db
            .select()
            .from(harnessEngineRunsTable)
            .where(
              and(
                eq(harnessEngineRunsTable.sessionId, fx.sessionId),
                eq(harnessEngineRunsTable.engineId, 1),
              ),
            )
            .orderBy(desc(harnessEngineRunsTable.createdAt))
            .limit(1);

          expect(runs.length).toBe(1);
          const run = runs[0]!;
          expect(run.provider).toBe(provider);
          expect(typeof run.modelId).toBe("string");
          expect(run.modelId.length).toBeGreaterThan(0);
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
          await cleanup(fx.user.id);
        }
      },
    );
  }
});
