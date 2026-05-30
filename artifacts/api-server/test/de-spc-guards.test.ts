import express, { type Express, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { describe, test, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  type Subscriber,
  type User,
} from "@workspace/db";

// The DE-SPC ordering guard test needs a *successful* synthesis (200) so it can
// inspect the persisted `sourceMaIds`, but it must stay fixture-free. Override
// the shared Anthropic client mock (setup.ts replays fixtures) with one that
// captures the prompt it was handed and returns a canned, schema-valid DE-SPC
// payload — no network, no recorded fixture, fully deterministic.
const llm = vi.hoisted(() => {
  const despc = {
    title: "Fused Meal SPC",
    objective: "Coordinate the planner and shopper micro-agents into one flow.",
    domain: "meal-planning",
    orchestrationPattern: "sequential",
    systemPrompt:
      "You orchestrate a planner and a shopper agent to deliver a weekly dinner plan and shopping list.",
    atomicPrompt: {
      system: "Orchestrator system prompt.",
      role: "Sequential supervisor.",
      instruction: "Run planner then shopper.",
      example: "Plan -> list.",
      constraint: "Stay within budget.",
      format: "Markdown.",
      data: "Family of four.",
    },
    successCriteria: ["Total estimated cost stays within budget."],
    guardrails: ["No nut allergens."],
    outputs: ["Weekly dinner plan", "Consolidated shopping list"],
    telemetry: [],
    maReferences: ["MA #1 planner", "MA #2 shopper"],
    jcse: {
      system: 6,
      role: 5,
      instruction: 6,
      example: 4,
      constraint: 4,
      format: 4,
      data: 4,
      total: 33,
    },
  };
  return { prompts: [] as string[], responseText: JSON.stringify(despc) };
});

vi.mock("@workspace/integrations-anthropic-ai", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/integrations-anthropic-ai")>();
  return {
    ...actual,
    getAnthropic: () => ({
      messages: {
        create: async (params: { messages: Array<{ content: string }> }) => {
          llm.prompts.push(params.messages[0]?.content ?? "");
          return {
            content: [{ type: "text", text: llm.responseText }],
            usage: { input_tokens: 50, output_tokens: 60 },
          };
        },
      },
    }),
  };
});

// Imported after the mock declaration so handleEvolve's transitive import of the
// Anthropic integration resolves to the capturing fake above.
const { handleEvolve } = await import("../src/engines/de");

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

function buildApp(localUser: User, subscriber: Subscriber): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(attachContext(localUser, subscriber));
  app.post("/api/harness/evolve", handleEvolve);
  return app;
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
}

async function seed(): Promise<Fixtures> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_despc_${stamp}`,
      email: `despc-guards-${stamp}@example.test`,
      displayName: "DE-SPC Guards Test",
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
      sessionName: `despc-guards ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  return { user, subscriber, sessionId: session.id };
}

const MA_A = {
  classification: { phase: "PHASE_1", kind: "PLANNER", confidence: 0.9, rationale: "Plans meals." },
  organelles: [],
  birthPackage: {
    overview: "Meal planner micro-agent",
    capability: "Plan a 7-day dinner schedule under a budget",
    knowledge: "Family-friendly recipes",
    behaviour: "Reads constraints, emits a plan",
    lifecycle: "Stateless per call",
  },
  escalated: false,
};

const MA_B = {
  classification: { phase: "PHASE_1", kind: "SHOPPER", confidence: 0.9, rationale: "Builds lists." },
  organelles: [],
  birthPackage: {
    overview: "Shopping list micro-agent",
    capability: "Aggregate ingredients into a deduped list",
    knowledge: "Unit conversions",
    behaviour: "Reads a plan, emits a list",
    lifecycle: "Stateless per call",
  },
  escalated: false,
};

async function insertMa(fx: Fixtures, content: Record<string, unknown>): Promise<string> {
  const [row] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      featureId: 3,
      artifactType: "MA_BIRTH_PACKAGE",
      artifactContent: content,
    })
    .returning();
  if (!row) throw new Error("seed: MA insert failed");
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

async function postEvolve(
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${url}/api/harness/evolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

describe("DE-SPC input guards (handleEvolve)", () => {
  test("fuses MA birth packages in the caller's requested order (deterministic)", async () => {
    const fx = await seed();
    // Insert A first, B second; request the REVERSED order. With the ordering
    // fix the prompt and persisted sourceMaIds must follow the request, not the
    // DB row order. Reverting to raw DB order would surface [maA, maB] here.
    const maA = await insertMa(fx, MA_A);
    const maB = await insertMa(fx, MA_B);
    const requested = [maB, maA];
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      llm.prompts.length = 0;
      const first = await postEvolve(srv.url, {
        sessionId: fx.sessionId,
        maArtifactIds: requested,
        provider: "claude",
      });
      expect(first.status, JSON.stringify(first.json).slice(0, 400)).toBe(200);
      const content1 = first.json.artifactContent as { sourceMaIds: string[] };
      expect(content1.sourceMaIds).toEqual(requested);

      // The captured prompt orders the MA blocks by the request, so maB's id
      // appears before maA's id.
      const prompt1 = llm.prompts.at(-1) ?? "";
      expect(prompt1.indexOf(`id=${maB}`)).toBeGreaterThanOrEqual(0);
      expect(prompt1.indexOf(`id=${maB}`)).toBeLessThan(prompt1.indexOf(`id=${maA}`));

      // Same inputs -> same prompt -> deterministic.
      const second = await postEvolve(srv.url, {
        sessionId: fx.sessionId,
        maArtifactIds: requested,
        provider: "claude",
      });
      expect(second.status).toBe(200);
      const content2 = second.json.artifactContent as { sourceMaIds: string[] };
      expect(content2.sourceMaIds).toEqual(requested);
      expect(llm.prompts.at(-1)).toBe(prompt1);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("rejects duplicate MA birth package ids with 400", async () => {
    const fx = await seed();
    const ma = await insertMa(fx, MA_A);
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postEvolve(srv.url, {
        sessionId: fx.sessionId,
        maArtifactIds: [ma, ma],
        provider: "claude",
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toBe("Duplicate MA birth package ids");
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("rejects ids not belonging to the session with 400", async () => {
    const fx = await seed();
    const maA = await insertMa(fx, MA_A);
    const maB = await insertMa(fx, MA_B);
    const missing = randomUUID();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postEvolve(srv.url, {
        sessionId: fx.sessionId,
        maArtifactIds: [maA, maB, missing],
        provider: "claude",
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toBe(
        "Some requested MA birth packages were not found in this session",
      );
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });
});
