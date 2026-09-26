import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessFeatureStateTable,
  harnessArtifactsTable,
  harnessEngineRunsTable,
  LLM_PROVIDERS,
  type ArtifactType,
  type LlmProvider,
  type Subscriber,
  type SubscriberTier,
  type User,
} from "@workspace/db";

import { handleF2 } from "../src/engines/f2";
import { handleF3Stream } from "../src/engines/f3";
import { handleF4 } from "../src/engines/f4";
import { handleF5 } from "../src/engines/f5";
import { handleF6 } from "../src/engines/f6";
import { handleF6Vdj } from "../src/engines/f6vdj";
import { handleF7Stream } from "../src/engines/f7";
import { handleF8CodeDj } from "../src/engines/f8codedj";
import { handleEvolve } from "../src/engines/de";
import { rateLimit } from "../src/lib/tier";
import { IS_RECORD } from "./llm-cache";

const PROVIDER_ENV: Record<LlmProvider, readonly string[]> = {
  claude: ["AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
  openai: ["AI_INTEGRATIONS_OPENAI_BASE_URL", "AI_INTEGRATIONS_OPENAI_API_KEY"],
  gemini: ["AI_INTEGRATIONS_GEMINI_BASE_URL", "AI_INTEGRATIONS_GEMINI_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  kimi: ["MOONSHOT_API_KEY"],
  qwen: ["DASHSCOPE_API_KEY"],
  glm: ["ZHIPU_API_KEY"],
};

const DIRECT_API_PROVIDERS = new Set<LlmProvider>(["deepseek", "kimi", "qwen", "glm"]);

function providerConfigured(p: LlmProvider): boolean {
  // Direct-provider calls do not use the fixture-backed SDK mocks below.
  // Keep replay runs offline even when real vendor keys are present.
  if (!IS_RECORD && DIRECT_API_PROVIDERS.has(p)) return false;
  return PROVIDER_ENV[p].every((k) => Boolean(process.env[k]));
}

function attachContext(localUser: User, subscriber: Subscriber): RequestHandler {
  return (req, _res, next) => {
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
  };
}

function buildApp(
  localUser: User,
  subscriber: Subscriber,
  path: string,
  ...handlers: RequestHandler[]
): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(attachContext(localUser, subscriber));
  app.post(path, ...handlers);
  return app;
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
}

async function seedFixtures(
  provider: LlmProvider,
  opts: {
    tier?: SubscriberTier;
    availableFeatureId?: number;
  } = {},
): Promise<Fixtures> {
  const stamp = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_${stamp}`,
      email: `provider-switch-engines-${stamp}@example.test`,
      displayName: "Provider Switch Engines Test",
    })
    .returning();
  if (!user) throw new Error("seed: user insert failed");

  const [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({
      userId: user.id,
      tier: opts.tier ?? "PRACTITIONER",
      status: "active",
    })
    .returning();
  if (!subscriber) throw new Error("seed: subscriber insert failed");

  const [session] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: user.id,
      sessionName: `provider-switch-engines ${stamp}`,
      preferredModelProvider: provider,
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  if (opts.availableFeatureId !== undefined) {
    await db.insert(harnessFeatureStateTable).values({
      sessionId: session.id,
      featureId: opts.availableFeatureId,
      status: "AVAILABLE",
    });
  }

  return { user, subscriber, sessionId: session.id };
}

async function insertArtifact(
  fx: Fixtures,
  artifactType: ArtifactType,
  featureId: number,
  artifactContent: Record<string, unknown>,
  extras: Partial<typeof harnessArtifactsTable.$inferInsert> = {},
): Promise<string> {
  const [row] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      featureId,
      artifactType,
      artifactContent,
      ...extras,
    })
    .returning();
  if (!row) throw new Error("seed: artifact insert failed");
  return row.id;
}

async function cleanup(userId: string): Promise<void> {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

async function startServer(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Returns "skip" when the proxy/integration is unreachable in the same narrow
 * way the F1 suite does. Returns "ok" otherwise; any other failure must still
 * fail the test (that is the regression net this suite exists to provide).
 */
function classifyFailure(
  status: number,
  body: string,
): { kind: "skip"; reason: string } | { kind: "ok" } {
  if (status === 503 && /PROVIDER_NOT_CONFIGURED/.test(body)) {
    return { kind: "skip", reason: `not configured: ${body.slice(0, 200)}` };
  }
  if (
    status === 502 &&
    /INVALID_ENDPOINT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/.test(body)
  ) {
    return { kind: "skip", reason: `unreachable: ${body.slice(0, 200)}` };
  }
  return { kind: "ok" };
}

function classifySseFailure(
  body: string,
): { kind: "skip"; reason: string } | { kind: "ok" } {
  if (/event:\s*error/i.test(body)) {
    if (/PROVIDER_NOT_CONFIGURED/.test(body)) {
      return { kind: "skip", reason: `sse not configured: ${body.slice(0, 200)}` };
    }
    if (/INVALID_ENDPOINT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/.test(body)) {
      return { kind: "skip", reason: `sse unreachable: ${body.slice(0, 200)}` };
    }
  }
  return { kind: "ok" };
}

async function assertRunRecorded(
  sessionId: string,
  engineId: number,
  provider: LlmProvider,
): Promise<void> {
  const runs = await db
    .select()
    .from(harnessEngineRunsTable)
    .where(
      and(
        eq(harnessEngineRunsTable.sessionId, sessionId),
        eq(harnessEngineRunsTable.engineId, engineId),
      ),
    )
    .orderBy(desc(harnessEngineRunsTable.createdAt))
    .limit(1);

  expect(runs.length, `no harness_engine_runs row for engine ${engineId}`).toBe(1);
  const run = runs[0]!;
  expect(run.provider).toBe(provider);
  expect(typeof run.modelId).toBe("string");
  expect(run.modelId.length).toBeGreaterThan(0);
  // Token usage parsing path is provider-specific and easy to regress;
  // a non-zero combined count proves it landed.
  expect(
    (run.inputTokens ?? 0) + (run.outputTokens ?? 0),
    `engine ${engineId} reported zero combined token usage`,
  ).toBeGreaterThan(0);
}

const SAMPLE_ATOMIC_PROMPT = {
  system: "You are a meal-planning assistant for busy parents.",
  role: "Pragmatic family chef and budget planner.",
  instruction:
    "Produce a 7-day dinner plan for a family of four within a $120 grocery budget; emit a day-by-day plan plus a consolidated shopping list.",
  example:
    "Day 1: Sheet-pan chicken fajitas — 2 lb chicken thigh ($6), peppers ($3), tortillas ($2). Total ~$11.",
  constraint:
    "Stay within $120 total; minimise duplicate ingredients; no nut allergens; max 30 min active cook time per day.",
  format: "Markdown with one section per day and a final '## Shopping List' table (item, qty, est cost).",
  data: "Family of 4 (2 adults, 2 kids aged 6 and 9). Pantry already has rice, olive oil, salt, basic spices.",
};

const SAMPLE_SPC = {
  sections: [
    { key: "objective", title: "Objective", body: "Plan a week of dinners on a $120 budget for a family of four." },
    { key: "scope", title: "Scope", body: "Dinners only; existing pantry staples assumed." },
    { key: "success", title: "Success criteria", body: "Total estimated cost ≤ $120 and 7 distinct meals." },
  ],
  iqs: 8,
  gro: "SAFE_LIFE",
  zpos: { budget: 1, allergen: 1 },
};

const SAMPLE_ATLAS_PDD = {
  cheatSheet: "Weekly $120 family dinner planner — 7 dinners, shopping list, ≤30 min active cook.",
  execSummary:
    "Deliver a 7-day dinner plan for a family of four within a $120 budget and a consolidated shopping list.",
  worksheet:
    "Inputs: budget, family size, dietary constraints. Outputs: per-day meal, ingredients, est cost, shopping list.",
  implementation:
    "Generate via an LLM with deterministic JSON schema (days[], shoppingList[]); validate sum(costs) ≤ budget.",
};

const SAMPLE_MA_BIRTH_PACKAGE_A = {
  classification: { phase: "PHASE_1", kind: "PLANNER", confidence: 0.9, rationale: "Plans weekly meals." },
  organelles: [],
  birthPackage: {
    overview: "Meal planner micro-agent",
    capability: "Plan a 7-day dinner schedule under a budget",
    knowledge: "Common family-friendly recipes and grocery prices",
    behaviour: "Reads constraints, emits a structured plan",
    lifecycle: "Stateless per call",
  },
  escalated: false,
};

const SAMPLE_MA_BIRTH_PACKAGE_B = {
  classification: { phase: "PHASE_1", kind: "SHOPPER", confidence: 0.9, rationale: "Builds shopping lists." },
  organelles: [],
  birthPackage: {
    overview: "Shopping list micro-agent",
    capability: "Aggregate ingredients into a deduped shopping list with costs",
    knowledge: "Unit conversions and bulk-buy pricing heuristics",
    behaviour: "Reads a meal plan, emits a consolidated list",
    lifecycle: "Stateless per call",
  },
  escalated: false,
};

const SAMPLE_MVP_PDD = {
  sections: [
    { key: "objective", title: "Objective", body: "Plan a week of dinners on a $120 budget." },
    { key: "io", title: "I/O contract", body: "Input: budget, family size. Output: days[], shoppingList[]." },
    { key: "success", title: "Success criteria", body: "Total cost ≤ budget; 7 distinct meals." },
  ],
  donut: { a: 6, b: 2, c: 1 },
};

const SAMPLE_SPARTAN_CERT = {
  certId: "SPARTAN-20260101-TEST0001",
  class: "A" as const,
  crP: 0.82,
  issuedAt: "2026-01-01T00:00:00.000Z",
};

const ENGINE_TIMEOUT_MS = 180_000;

describe("provider switching end-to-end across remaining engines", () => {
  for (const provider of LLM_PROVIDERS) {
    const configured = providerConfigured(provider);
    const it = test.skipIf(!configured);

    it(
      `${provider}: F2 records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, { availableFeatureId: 2 });
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f2", rateLimit(2), handleF2);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f2`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              tuple: SAMPLE_ATOMIC_PROMPT,
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} F2: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          const result = JSON.parse(body) as {
            scorecard?: { kind: string; advisoryReport?: { steps: unknown[] } };
          };
          expect(result.scorecard?.kind).toBe("JCSE");
          expect(result.scorecard?.advisoryReport?.steps.length).toBeGreaterThan(0);
          await assertRunRecorded(fx.sessionId, 2, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F3 (SSE) records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, { availableFeatureId: 3 });
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f3", rateLimit(3), handleF3Stream);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f3`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "text/event-stream" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              atomicPrompt: SAMPLE_ATOMIC_PROMPT,
              intent: "Plan a one-week family dinner menu under budget.",
              provider,
            }),
          });
          const body = await res.text();
          if (res.status !== 200) {
            const verdict = classifyFailure(res.status, body);
            if (verdict.kind === "skip") return ctx.skip(`${provider} F3: ${verdict.reason}`);
            expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          }
          const sseVerdict = classifySseFailure(body);
          if (sseVerdict.kind === "skip") return ctx.skip(`${provider} F3: ${sseVerdict.reason}`);
          expect(body, "expected SSE complete event").toMatch(/event:\s*complete/);
          await assertRunRecorded(fx.sessionId, 3, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F4 records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, { availableFeatureId: 4 });
        const sourceId = await insertArtifact(
          fx,
          "MA_BIRTH_PACKAGE",
          3,
          SAMPLE_MA_BIRTH_PACKAGE_A,
        );
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f4", rateLimit(4), handleF4);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f4`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              sourceArtifactId: sourceId,
              targetVibe: "Cursor + Next.js",
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} F4: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          await assertRunRecorded(fx.sessionId, 4, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F5 (question turn) records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, { availableFeatureId: 5 });
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f5", rateLimit(5), handleF5);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f5`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              answers: {},
              finalize: false,
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} F5: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          await assertRunRecorded(fx.sessionId, 5, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F6 (FROM_SPC) records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, { availableFeatureId: 6 });
        const spcId = await insertArtifact(fx, "SPC", 5, SAMPLE_SPC);
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f6", rateLimit(6), handleF6);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f6`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              mode: "FROM_SPC",
              sourceArtifactId: spcId,
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} F6: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          await assertRunRecorded(fx.sessionId, 6, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F6-VDJ records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider);
        const pddId = await insertArtifact(fx, "ATLAS_PDD", 6, SAMPLE_ATLAS_PDD);
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f6-vdj", handleF6Vdj);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f6-vdj`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              pddArtifactId: pddId,
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} F6-VDJ: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          // F6-VDJ uses engineId=6 (it's a side-step of F6).
          await assertRunRecorded(fx.sessionId, 6, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F7 (SSE) records engine run with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, { availableFeatureId: 7 });
        const pddId = await insertArtifact(fx, "ATLAS_PDD", 6, SAMPLE_ATLAS_PDD);
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f7", rateLimit(7), handleF7Stream);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f7`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "text/event-stream" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              pddArtifactId: pddId,
              provider,
            }),
          });
          const body = await res.text();
          if (res.status !== 200) {
            const verdict = classifyFailure(res.status, body);
            if (verdict.kind === "skip") return ctx.skip(`${provider} F7: ${verdict.reason}`);
            expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          }
          const sseVerdict = classifySseFailure(body);
          if (sseVerdict.kind === "skip") return ctx.skip(`${provider} F7: ${sseVerdict.reason}`);
          expect(body, "expected SSE complete event").toMatch(/event:\s*complete/);
          await assertRunRecorded(fx.sessionId, 7, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: F8 Code DJ records engine run (engineId=9) with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider, {
          tier: "ARCHITECT",
          availableFeatureId: 8,
        });
        const mvpId = await insertArtifact(fx, "MVP_PDD", 7, SAMPLE_MVP_PDD, {
          spartanCert: SAMPLE_SPARTAN_CERT,
        });
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/f8", rateLimit(8), handleF8CodeDj);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/f8`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              mvpPddArtifactId: mvpId,
              platform: "react-vite-static",
              artifactClass: "SOFTWARE",
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} F8: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          // F8 deliberately writes telemetry under engineId=9 (see f8codedj.ts).
          await assertRunRecorded(fx.sessionId, 9, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );

    it(
      `${provider}: DE-SPC (evolve) records engine run (engineId=8) with provider + tokens`,
      { timeout: ENGINE_TIMEOUT_MS },
      async (ctx) => {
        const fx = await seedFixtures(provider);
        const ma1 = await insertArtifact(fx, "MA_BIRTH_PACKAGE", 3, SAMPLE_MA_BIRTH_PACKAGE_A);
        const ma2 = await insertArtifact(fx, "MA_BIRTH_PACKAGE", 3, SAMPLE_MA_BIRTH_PACKAGE_B);
        const app = buildApp(fx.user, fx.subscriber, "/api/harness/evolve", handleEvolve);
        const srv = await startServer(app);
        try {
          const res = await fetch(`${srv.url}/api/harness/evolve`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: fx.sessionId,
              maArtifactIds: [ma1, ma2],
              provider,
            }),
          });
          const body = await res.text();
          const verdict = classifyFailure(res.status, body);
          if (verdict.kind === "skip") return ctx.skip(`${provider} DE-SPC: ${verdict.reason}`);
          expect(res.status, `body=${body.slice(0, 400)}`).toBe(200);
          const result = JSON.parse(body) as {
            scorecards?: Array<{ kind: string; advisoryReport?: { steps: unknown[] } }>;
          };
          const jcseScorecard = result.scorecards?.find((scorecard) => scorecard.kind === "JCSE");
          expect(jcseScorecard?.advisoryReport?.steps.length).toBeGreaterThan(0);
          // DE-SPC uses engineId=8.
          await assertRunRecorded(fx.sessionId, 8, provider);
        } finally {
          await srv.close();
          await cleanup(fx.user.id);
        }
      },
    );
  }
});
