import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessEngineRunsTable,
  mathmonIntakesTable,
  mathmonMapsTable,
  type Subscriber,
  type User,
} from "@workspace/db";

import { handleF05 } from "../src/engines/f05";
import { handleMapStream } from "../src/engines/map";
import { requireCostBudget } from "../src/lib/cost-budget";
import { F05_MATHMON_SYSTEM, MAP_SYSTEM } from "../src/engines/prompts";
import { PROVIDER_MODELS } from "../src/engines/shared";
import {
  clampScore,
  computeMathmonScore,
  FORGE_VERIFIED_DISCLAIMER,
} from "../src/lib/mathmon";
import { loadLatestIntake } from "../src/lib/mathmon-store";
import { hashKey, writeFixture } from "./llm-cache";

// ─── Test-app plumbing (mirrors provider-switching-engines.test.ts) ─────────
//
// The MATHMON routes in production run `requireAuth → requireCostBudget →
// handler` (featureId:null, so no per-day `rateLimit`). We substitute
// `requireAuth` with a context-injecting middleware (there is no Clerk session
// in-process) and keep `requireCostBudget` mounted immediately before the
// handler — exactly where the real route places it — so the 402 cost-cap gate
// is exercised at the same point in the chain as production.

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

async function startServer(
  app: Express,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
}

async function seedFixtures(): Promise<Fixtures> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_mathmon_${stamp}`,
      email: `mathmon-flow-${stamp}@example.test`,
      displayName: "MATHMON Flow Test",
    })
    .returning();
  if (!user) throw new Error("seed: user insert failed");

  const [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: user.id, tier: "PRACTITIONER", status: "active" })
    .returning();
  if (!subscriber) throw new Error("seed: subscriber insert failed");

  const [session] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: user.id,
      sessionName: `mathmon-flow ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  return { user, subscriber, sessionId: session.id };
}

async function cleanup(userId: string): Promise<void> {
  // Cascades through subscribers, sessions, intakes, maps, engine_runs.
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

// ─── Hand-written LLM fixture helpers ───────────────────────────────────────
//
// The suite runs hermetically: `test/setup.ts` mocks the provider SDKs to
// replay a fixture keyed by a hash of the (model, system, messages) request.
// Rather than record live model output (which would always be in-range and
// couldn't prove clamping), we synthesise a Claude-shaped fixture with the
// exact sub-scores we want — including deliberately out-of-range values — so
// the server-side clamp + recompute is verified deterministically, offline.

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "llm",
  "claude",
);

function writeClaudeFixture(
  systemPrompt: string,
  userPrompt: string,
  output: unknown,
): string {
  const payload = {
    model: PROVIDER_MODELS.claude,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };
  const key = hashKey("claude", payload);
  writeFixture("claude", key, {
    model: PROVIDER_MODELS.claude,
    content: [{ type: "text", text: JSON.stringify(output) }],
    usage: { input_tokens: 321, output_tokens: 654 },
  });
  return key;
}

function removeFixture(key: string): void {
  const p = join(FIXTURE_DIR, `${key}.json`);
  if (existsSync(p)) unlinkSync(p);
}

function parseSseEvent(body: string, event: string): unknown | null {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === `event: ${event}`) {
      const dataLine = lines[i + 1] ?? "";
      const json = dataLine.replace(/^data:\s*/, "");
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    }
  }
  return null;
}

describe("F0.5 (MATHMON Intake) — POST /api/harness/f05", () => {
  test("409 NO_CONCEPT_TO_PROFILE when the session has no brief and no artifact", async () => {
    const fx = await seedFixtures();
    const app = buildApp(fx.user, fx.subscriber, "/api/harness/f05", requireCostBudget, handleF05);
    const srv = await startServer(app);
    try {
      const res = await fetch(`${srv.url}/api/harness/f05`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: fx.sessionId }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("NO_CONCEPT_TO_PROFILE");
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("402 COST_CAP_EXCEEDED fires from requireCostBudget before the handler", async () => {
    const fx = await seedFixtures();
    // Put spend in the current UTC month so the global SUM exceeds the cap.
    await db.insert(harnessEngineRunsTable).values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      engineId: 10,
      provider: "claude",
      modelId: PROVIDER_MODELS.claude,
      inputTokens: 1,
      outputTokens: 1,
      costUsd: "1.000000",
      durationMs: 1,
    });
    const app = buildApp(fx.user, fx.subscriber, "/api/harness/f05", requireCostBudget, handleF05);
    const srv = await startServer(app);
    const prevCap = process.env.STAFF_MONTHLY_COST_CAP_USD;
    process.env.STAFF_MONTHLY_COST_CAP_USD = "0.01";
    try {
      const res = await fetch(`${srv.url}/api/harness/f05`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // A brief is supplied, so the ONLY thing that can 402 here is the
        // cost-cap gate — proving it runs and refuses before the handler.
        body: JSON.stringify({ sessionId: fx.sessionId, brief: "A budgeted meal planner." }),
      });
      expect(res.status).toBe(402);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("COST_CAP_EXCEEDED");
    } finally {
      if (prevCap === undefined) delete process.env.STAFF_MONTHLY_COST_CAP_USD;
      else process.env.STAFF_MONTHLY_COST_CAP_USD = prevCap;
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("success: persists a MATHMON Intake Report row from a brief", async () => {
    const fx = await seedFixtures();
    const brief = "A subscription meal-planning app that optimises a weekly grocery budget.";
    // F0.5 builds its prompt deterministically from the brief (no artifact),
    // so we can synthesise the matching fixture directly.
    const userPrompt = [
      "Profile this concept for mathematical applicability. Produce a MATHMON Intake Report.",
      "",
      "=== BRIEF ===",
      brief,
    ].join("\n");
    const report = {
      measurableVariables: [
        { name: "weekly_spend", unit: "USD", description: "Total grocery spend per week." },
      ],
      constraintCategories: [{ category: "budget", detail: "Must stay under the weekly cap." }],
      optimisationTargets: [
        { target: "cost", direction: "MINIMISE" as const, metric: "USD per week" },
      ],
      summary: "A tractable constrained-optimisation problem.",
    };
    const key = writeClaudeFixture(F05_MATHMON_SYSTEM, userPrompt, report);
    const app = buildApp(fx.user, fx.subscriber, "/api/harness/f05", requireCostBudget, handleF05);
    const srv = await startServer(app);
    try {
      const res = await fetch(`${srv.url}/api/harness/f05`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: fx.sessionId, brief, provider: "claude" }),
      });
      const bodyText = await res.text();
      expect(res.status, `body=${bodyText.slice(0, 400)}`).toBe(200);
      const body = JSON.parse(bodyText) as { id: string; report: typeof report };
      expect(body.report.summary).toBe(report.summary);

      const rows = await db
        .select()
        .from(mathmonIntakesTable)
        .where(eq(mathmonIntakesTable.sessionId, fx.sessionId));
      expect(rows.length).toBe(1);
      expect(rows[0]!.provider).toBe("claude");
    } finally {
      removeFixture(key);
      await srv.close();
      await cleanup(fx.user.id);
    }
  });
});

describe("MAP (Mathematical Applicability Profile) — POST /api/harness/map", () => {
  test("409 NO_MATHMON_INTAKE when MAP runs before F0.5 intake", async () => {
    const fx = await seedFixtures();
    const app = buildApp(fx.user, fx.subscriber, "/api/harness/map", requireCostBudget, handleMapStream);
    const srv = await startServer(app);
    try {
      const res = await fetch(`${srv.url}/api/harness/map`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: fx.sessionId }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("NO_MATHMON_INTAKE");
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("402 COST_CAP_EXCEEDED fires from requireCostBudget before the handler", async () => {
    const fx = await seedFixtures();
    // Seed an intake so the ONLY thing that can refuse is the cost-cap gate.
    await db.insert(mathmonIntakesTable).values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      report: { measurableVariables: [], constraintCategories: [], optimisationTargets: [], summary: "x" },
      provider: "claude",
      modelId: PROVIDER_MODELS.claude,
    });
    await db.insert(harnessEngineRunsTable).values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      engineId: 11,
      provider: "claude",
      modelId: PROVIDER_MODELS.claude,
      inputTokens: 1,
      outputTokens: 1,
      costUsd: "1.000000",
      durationMs: 1,
    });
    const app = buildApp(fx.user, fx.subscriber, "/api/harness/map", requireCostBudget, handleMapStream);
    const srv = await startServer(app);
    const prevCap = process.env.STAFF_MONTHLY_COST_CAP_USD;
    process.env.STAFF_MONTHLY_COST_CAP_USD = "0.01";
    try {
      const res = await fetch(`${srv.url}/api/harness/map`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: fx.sessionId }),
      });
      expect(res.status).toBe(402);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("COST_CAP_EXCEEDED");
    } finally {
      if (prevCap === undefined) delete process.env.STAFF_MONTHLY_COST_CAP_USD;
      else process.env.STAFF_MONTHLY_COST_CAP_USD = prevCap;
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("recomputes the composite from clamped sub-scores (model self-report ignored) and appends the disclaimer", async () => {
    const fx = await seedFixtures();
    const report = {
      measurableVariables: [
        { name: "throughput", unit: "req/s", description: "Requests served per second." },
      ],
      constraintCategories: [{ category: "latency", detail: "p99 under 200ms." }],
      optimisationTargets: [
        { target: "throughput", direction: "MAXIMISE" as const, metric: "req/s" },
      ],
      summary: "Well-posed capacity-planning problem.",
    };
    const [intakeRow] = await db
      .insert(mathmonIntakesTable)
      .values({
        sessionId: fx.sessionId,
        userId: fx.user.id,
        report,
        provider: "claude",
        modelId: PROVIDER_MODELS.claude,
      })
      .returning();
    if (!intakeRow) throw new Error("seed: intake insert failed");

    // Rebuild the prompt from the DB-round-tripped report (jsonb may reorder
    // object keys), matching exactly what the MAP handler will hash on.
    const intake = await loadLatestIntake(fx.sessionId, fx.user.id);
    if (!intake) throw new Error("seed: intake read-back failed");
    const userPrompt = `Build the Mathematical Applicability Profile from this MATHMON Intake Report:\n${JSON.stringify(intake.report, null, 2)}`;

    // Deliberately out-of-range / non-integer sub-scores. The server must clamp
    // to 100 / 0 / 96 and recompute the composite from THOSE — never trust a
    // model-reported figure (the schema has no composite field to trust).
    const rawSubScores = { mathCoherence: 150, applicability: -20, predictiveReliability: 95.6 };
    const mapOutput = {
      sections: [
        { key: "governing_equations", title: "Governing equations", body: "y = kx." },
        {
          key: "economic_projections",
          title: "Economic projections",
          body: "Revenue modelled at $10k–$40k/mo (range only).",
        },
      ],
      ...rawSubScores,
    };
    const key = writeClaudeFixture(MAP_SYSTEM, userPrompt, mapOutput);

    const expectedMc = clampScore(rawSubScores.mathCoherence); // 100
    const expectedAp = clampScore(rawSubScores.applicability); // 0
    const expectedPr = clampScore(rawSubScores.predictiveReliability); // 96
    const expectedComposite = computeMathmonScore({
      mathCoherence: expectedMc,
      applicability: expectedAp,
      predictiveReliability: expectedPr,
    }); // 100*.40 + 0*.35 + 96*.25 = 64

    const app = buildApp(fx.user, fx.subscriber, "/api/harness/map", requireCostBudget, handleMapStream);
    const srv = await startServer(app);
    try {
      const res = await fetch(`${srv.url}/api/harness/map`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ sessionId: fx.sessionId, provider: "claude" }),
      });
      const body = await res.text();
      expect(parseSseEvent(body, "error"), `unexpected SSE error: ${body.slice(0, 400)}`).toBeNull();
      const complete = parseSseEvent(body, "complete") as
        | {
            mathCoherence: number;
            applicability: number;
            predictiveReliability: number;
            mathmonScore: number;
            disclaimer: string;
            sections: Array<{ key: string; body: string }>;
          }
        | null;
      expect(complete, `no complete event: ${body.slice(0, 400)}`).not.toBeNull();

      // Clamp applied to each sub-score.
      expect(complete!.mathCoherence).toBe(expectedMc);
      expect(complete!.applicability).toBe(expectedAp);
      expect(complete!.predictiveReliability).toBe(expectedPr);
      // Composite recomputed server-side from the clamped sub-scores.
      expect(complete!.mathmonScore).toBe(expectedComposite);
      // Disclaimer appended to the RANGE-ONLY economic projections section.
      const econ = complete!.sections.find((s) => s.key === "economic_projections");
      expect(econ).toBeDefined();
      expect(econ!.body.endsWith(FORGE_VERIFIED_DISCLAIMER)).toBe(true);

      // Persisted row mirrors the recomputed values + disclaimer.
      const rows = await db
        .select()
        .from(mathmonMapsTable)
        .where(
          and(
            eq(mathmonMapsTable.sessionId, fx.sessionId),
            eq(mathmonMapsTable.userId, fx.user.id),
          ),
        )
        .orderBy(desc(mathmonMapsTable.createdAt))
        .limit(1);
      expect(rows.length).toBe(1);
      const row = rows[0]!;
      expect(row.mathCoherence).toBe(expectedMc);
      expect(row.applicability).toBe(expectedAp);
      expect(row.predictiveReliability).toBe(expectedPr);
      expect(row.disclaimer).toBe(FORGE_VERIFIED_DISCLAIMER);
      expect(row.intakeId).toBe(intakeRow.id);
    } finally {
      removeFixture(key);
      await srv.close();
      await cleanup(fx.user.id);
    }
  });
});
