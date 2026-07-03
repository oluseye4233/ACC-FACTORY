import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  mathmonIntakesTable,
  mathmonMapsTable,
  type ArtifactType,
  type Subscriber,
  type User,
} from "@workspace/db";

// Five streaming engine handlers share the F0 `clientClosed` persist-after-
// disconnect pattern: F3 (MA birth package), F5 finalize (SPC), F6 draft
// (ATLAS PDD), F7 (MVP PDD + SPARTAN cert), and MAP (mathmon profile). Each
// keeps working after the client drops the SSE connection and must persist the
// completed — already billed — LLM output exactly as on the happy path. This
// suite is the regression net for those five branches: it opens the real SSE
// stream against a real Express server, aborts the fetch mid-run, and polls
// the database until the durable row lands.
const llm = vi.hoisted(() => ({ responseText: "" }));

// Keep the canned LLM response pending until after the client has aborted, so
// the disconnect genuinely happens mid-run (before the handler awaits the LLM
// promise and reaches its persistence branch).
const LLM_DELAY_MS = 2000;

vi.mock("@workspace/integrations-anthropic-ai", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/integrations-anthropic-ai")>();
  return {
    ...actual,
    getAnthropic: () => ({
      messages: {
        create: async () => {
          await new Promise((r) => setTimeout(r, LLM_DELAY_MS));
          return {
            content: [{ type: "text", text: llm.responseText }],
            usage: { input_tokens: 50, output_tokens: 40 },
          };
        },
      },
    }),
  };
});

const { handleF3Stream } = await import("../src/engines/f3");
const { handleF5FinalizeStream } = await import("../src/engines/f5");
const { handleF6DraftStream } = await import("../src/engines/f6");
const { handleF7Stream } = await import("../src/engines/f7");
const { handleMapStream } = await import("../src/engines/map");

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
  handler: RequestHandler,
): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(attachContext(localUser, subscriber));
  app.post(path, handler);
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
      clerkUserId: `test_clerk_disc_${stamp}`,
      email: `engine-disconnect-${stamp}@example.test`,
      displayName: "Engine Disconnect Test",
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
      sessionName: `engine-disconnect ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  return { user, subscriber, sessionId: session.id };
}

async function insertArtifact(
  fx: Fixtures,
  artifactType: ArtifactType,
  featureId: number,
  artifactContent: Record<string, unknown>,
): Promise<string> {
  const [row] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      featureId,
      artifactType,
      artifactContent,
    })
    .returning();
  if (!row) throw new Error("seed: artifact insert failed");
  return row.id;
}

async function cleanup(userId: string): Promise<void> {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
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

// Polls `fn` until it returns a non-null value or the deadline passes. The
// server keeps working after the client aborts, so assertions must wait for
// the handler's post-disconnect persistence to land.
async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  label: string,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Opens the SSE stream, reads until the first progress event (`step` for most
// engines, `organelle` for F3) arrives — proving the stream is genuinely open
// and mid-run — then aborts the fetch, simulating the user closing the tab
// before the `complete` event. The abort destroys the socket, which fires the
// server's `req.on("close")` and flips its `clientClosed` flag.
async function openStreamThenAbortAfterFirstProgress(
  url: string,
  path: string,
  body: Record<string, unknown>,
  progressEvent: string,
): Promise<void> {
  const controller = new AbortController();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  expect(res.status, `POST ${path} should open a 200 SSE stream`).toBe(200);
  if (!res.body) throw new Error("SSE response had no body stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!buffer.includes(`event: ${progressEvent}`)) {
    const { done, value } = await reader.read();
    if (done) throw new Error(`stream ended before any ${progressEvent} event arrived`);
    buffer += decoder.decode(value, { stream: true });
  }
  // A `complete` event must not have arrived yet — the disconnect genuinely
  // happens mid-run, before the engine's output exists.
  expect(buffer.includes("event: complete")).toBe(false);
  controller.abort();
  await reader.cancel().catch(() => {});
}

async function latestArtifact(
  sessionId: string,
  artifactType: ArtifactType,
): Promise<typeof harnessArtifactsTable.$inferSelect | null> {
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.sessionId, sessionId),
        eq(harnessArtifactsTable.artifactType, artifactType),
      ),
    );
  return rows[0] ?? null;
}

const SAMPLE_ATOMIC_PROMPT = {
  system: "You are a meal-planning assistant for busy parents.",
  role: "Pragmatic family chef and budget planner.",
  instruction:
    "Produce a 7-day dinner plan for a family of four within a $120 grocery budget.",
  example: "Day 1: Sheet-pan chicken fajitas — ~$11 total.",
  constraint: "Stay within $120 total; no nut allergens; max 30 min active cook time.",
  format: "Markdown with one section per day and a final shopping list table.",
  data: "Family of 4. Pantry already has rice, olive oil, salt, basic spices.",
};

const SAMPLE_ATLAS_PDD = {
  cheatSheet: "Weekly $120 family dinner planner — 7 dinners, shopping list.",
  execSummary: "Deliver a 7-day dinner plan for a family of four within a $120 budget.",
  worksheet: "Inputs: budget, family size, constraints. Outputs: per-day meal plan.",
  implementation: "Generate via an LLM with a deterministic JSON schema.",
};

const F3_RESPONSE = {
  classification: {
    phase: "PHASE_1",
    kind: "PLANNER",
    confidence: 0.9,
    rationale: "Plans weekly meals.",
  },
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

const F5_RESPONSE = {
  sections: [
    { key: "objective", title: "Objective", body: "Plan a week of dinners on $120." },
    { key: "scope", title: "Scope", body: "Dinners only." },
  ],
  iqs: 8,
  gro: "SAFE_LIFE",
  zpos: { budget: 1 },
};

const F6_RESPONSE = SAMPLE_ATLAS_PDD;

const F7_RESPONSE = {
  sections: [
    { key: "objective", title: "Objective", body: "Plan a week of dinners on $120." },
    { key: "io", title: "I/O contract", body: "Input: budget. Output: days[]." },
  ],
  donut: { a: 6, b: 2, c: 1 },
  crP: 0.82,
  class: "A",
};

const MAP_RESPONSE = {
  sections: [
    { key: "governing_equations", title: "Governing equations", body: "cost = Σ item." },
    { key: "economic_projections", title: "Economic projections", body: "Range: $90–$120." },
  ],
  mathCoherence: 82,
  applicability: 74,
  predictiveReliability: 61,
};

const TEST_TIMEOUT_MS = 20_000;

describe("streaming engines — client disconnect mid-stream must not lose the output", () => {
  beforeEach(() => {
    llm.responseText = "";
  });

  test(
    "F3: a mid-stream disconnect still persists the MA birth package artifact",
    async () => {
      llm.responseText = JSON.stringify(F3_RESPONSE);
      const fx = await seed();
      const srv = await startServer(
        buildApp(fx.user, fx.subscriber, "/api/harness/f3", handleF3Stream),
      );
      try {
        await openStreamThenAbortAfterFirstProgress(
          srv.url,
          "/api/harness/f3",
          {
            sessionId: fx.sessionId,
            atomicPrompt: SAMPLE_ATOMIC_PROMPT,
            intent: "Plan a one-week family dinner menu under budget.",
            provider: "claude",
          },
          // F3 streams `organelle` progress events, not `step`.
          "organelle",
        );

        const artifact = await waitFor(
          () => latestArtifact(fx.sessionId, "MA_BIRTH_PACKAGE"),
          "MA_BIRTH_PACKAGE artifact after client disconnect",
        );
        expect(artifact.featureId).toBe(3);
        expect(artifact.userId).toBe(fx.user.id);
        expect(artifact.provider).toBe("claude");
        expect(artifact.artifactContent).toMatchObject({
          classification: { phase: "PHASE_1", kind: "PLANNER" },
          birthPackage: { overview: "Meal planner micro-agent" },
        });
      } finally {
        await srv.close();
        await cleanup(fx.user.id);
      }
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "F5 finalize: a mid-stream disconnect still persists the SPC artifact with its name and GRO state",
    async () => {
      llm.responseText = JSON.stringify(F5_RESPONSE);
      const fx = await seed();
      const srv = await startServer(
        buildApp(fx.user, fx.subscriber, "/api/harness/f5/finalize", handleF5FinalizeStream),
      );
      try {
        await openStreamThenAbortAfterFirstProgress(
          srv.url,
          "/api/harness/f5/finalize",
          {
            sessionId: fx.sessionId,
            name: "Disconnect SPC",
            answers: { "1": "A budget dinner planner" },
            provider: "claude",
          },
          "step",
        );

        const artifact = await waitFor(
          () => latestArtifact(fx.sessionId, "SPC"),
          "SPC artifact after client disconnect",
        );
        expect(artifact.featureId).toBe(5);
        expect(artifact.userId).toBe(fx.user.id);
        expect(artifact.name).toBe("Disconnect SPC");
        expect(artifact.groState).toBe("SAFE_LIFE");
        expect(artifact.artifactContent).toMatchObject({ iqs: 8, gro: "SAFE_LIFE" });
      } finally {
        await srv.close();
        await cleanup(fx.user.id);
      }
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "F6 draft: a mid-stream disconnect still persists the ATLAS PDD artifact",
    async () => {
      llm.responseText = JSON.stringify(F6_RESPONSE);
      const fx = await seed();
      const srv = await startServer(
        buildApp(fx.user, fx.subscriber, "/api/harness/f6/draft", handleF6DraftStream),
      );
      try {
        await openStreamThenAbortAfterFirstProgress(
          srv.url,
          "/api/harness/f6/draft",
          {
            sessionId: fx.sessionId,
            mode: "FRESH",
            brief: "A weekly family dinner planner under a $120 budget.",
            provider: "claude",
          },
          "step",
        );

        const artifact = await waitFor(
          () => latestArtifact(fx.sessionId, "ATLAS_PDD"),
          "ATLAS_PDD artifact after client disconnect",
        );
        expect(artifact.featureId).toBe(6);
        expect(artifact.userId).toBe(fx.user.id);
        expect(artifact.artifactContent).toMatchObject({
          cheatSheet: SAMPLE_ATLAS_PDD.cheatSheet,
          implementation: SAMPLE_ATLAS_PDD.implementation,
        });
      } finally {
        await srv.close();
        await cleanup(fx.user.id);
      }
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "F7: a mid-stream disconnect still persists the MVP PDD artifact with its SPARTAN cert",
    async () => {
      llm.responseText = JSON.stringify(F7_RESPONSE);
      const fx = await seed();
      const pddArtifactId = await insertArtifact(fx, "ATLAS_PDD", 6, SAMPLE_ATLAS_PDD);
      const srv = await startServer(
        buildApp(fx.user, fx.subscriber, "/api/harness/f7", handleF7Stream),
      );
      try {
        await openStreamThenAbortAfterFirstProgress(
          srv.url,
          "/api/harness/f7",
          { sessionId: fx.sessionId, pddArtifactId, provider: "claude" },
          "step",
        );

        const artifact = await waitFor(
          () => latestArtifact(fx.sessionId, "MVP_PDD"),
          "MVP_PDD artifact after client disconnect",
        );
        expect(artifact.featureId).toBe(7);
        expect(artifact.userId).toBe(fx.user.id);
        expect(artifact.artifactContent).toMatchObject({ donut: { a: 6, b: 2, c: 1 } });
        // The SPARTAN cert is minted server-side and must survive the
        // disconnect too — it is what the public /verify URL resolves.
        const cert = artifact.spartanCert as Record<string, unknown> | null;
        expect(cert).toBeTruthy();
        expect(cert!.class).toBe("A");
        expect(cert!.crP).toBe(0.82);
        expect(typeof cert!.certId).toBe("string");
        expect((cert!.certId as string).length).toBeGreaterThan(0);
      } finally {
        await srv.close();
        await cleanup(fx.user.id);
      }
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "MAP: a mid-stream disconnect still persists the mathmon_maps row with recomputed scores",
    async () => {
      llm.responseText = JSON.stringify(MAP_RESPONSE);
      const fx = await seed();
      // MAP consumes the session's latest MATHMON intake report.
      await db.insert(mathmonIntakesTable).values({
        sessionId: fx.sessionId,
        userId: fx.user.id,
        report: {
          measurableVariables: ["weekly grocery cost"],
          constraintCategories: ["budget"],
          optimisationTargets: ["cost ≤ $120"],
          summary: "Budget dinner planning is mathematically tractable.",
        },
      });
      const srv = await startServer(
        buildApp(fx.user, fx.subscriber, "/api/harness/map", handleMapStream),
      );
      try {
        await openStreamThenAbortAfterFirstProgress(
          srv.url,
          "/api/harness/map",
          { sessionId: fx.sessionId, provider: "claude" },
          "step",
        );

        const row = await waitFor(
          async () => {
            const rows = await db
              .select()
              .from(mathmonMapsTable)
              .where(eq(mathmonMapsTable.sessionId, fx.sessionId));
            return rows[0] ?? null;
          },
          "mathmon_maps row after client disconnect",
        );
        expect(row.userId).toBe(fx.user.id);
        expect(row.mathCoherence).toBe(82);
        expect(row.applicability).toBe(74);
        expect(row.predictiveReliability).toBe(61);
        expect(row.disclaimer).toBeTruthy();
        const map = row.map as { sections: Array<{ key: string; body: string }> };
        // The FORGE VERIFIED disclaimer is appended to the economic projections
        // section server-side and must be persisted despite the disconnect.
        const econ = map.sections.find((s) => s.key === "economic_projections");
        expect(econ).toBeDefined();
        expect(econ!.body).toContain(row.disclaimer!);
      } finally {
        await srv.close();
        await cleanup(fx.user.id);
      }
    },
    TEST_TIMEOUT_MS,
  );
});
