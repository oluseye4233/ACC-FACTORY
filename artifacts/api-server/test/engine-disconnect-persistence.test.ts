import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { installGovernance } from "../src/lib/artifact-governance";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  harnessEscalationsTable,
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
const llm = vi.hoisted(() => ({
  responseText: "", delayMs: 2000, callsStarted: 0, callsCompleted: 0,
  responseGate: null as Promise<void> | null,
}));

// Keep the canned LLM response pending until after the client has aborted, so
// the disconnect genuinely happens mid-run (before the handler awaits the LLM
// promise and reaches its persistence branch).
const LLM_DELAY_MS = 2000;

// Spy on the escalation email so the F3 escalation test can assert the send
// path is invoked even after the client disconnects. All other senders keep
// their real (dry-run console-log) implementations.
const emailMocks = vi.hoisted(() => ({
  sendEscalationGranted: vi.fn(async () => ({ ok: true, dryRun: true })),
}));

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendEscalationGranted: emailMocks.sendEscalationGranted,
  };
});

vi.mock("@workspace/integrations-anthropic-ai", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/integrations-anthropic-ai")>();
  return {
    ...actual,
    getAnthropic: () => ({
      messages: {
        create: async () => {
          llm.callsStarted++;
          await new Promise((r) => setTimeout(r, llm.delayMs));
          if (llm.responseGate) await llm.responseGate;
          llm.callsCompleted++;
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
  const failureBody = res.status === 200 ? "" : await res.text();
  expect(res.status, `POST ${path} should open a 200 SSE stream: ${failureBody}`).toBe(200);
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

const GOVERNANCE_ASSESSMENT = {
  gro: "SAFE_LIFE",
  zpos: { AEOS: 80, NEXUS: 80, PRISM: 80, QUANTUM: 80, SYNTHESIS: 80 },
  honestyGate: { assumptions: [], limitations: ["Synthetic test response; not independently verified."], unverifiedClaims: [], evidence: [] },
};
const F3_RESPONSE = {
  ...GOVERNANCE_ASSESSMENT,
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
  ...GOVERNANCE_ASSESSMENT,
  sections: [
    { key: "objective", title: "Objective", body: "Plan a week of dinners on $120." },
    { key: "scope", title: "Scope", body: "Dinners only." },
  ],
  iqs: 8,
  gro: "SAFE_LIFE",
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
    llm.delayMs = LLM_DELAY_MS;
    llm.callsStarted = 0;
    llm.callsCompleted = 0;
    llm.responseGate = null;
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
    "F3 escalation: a mid-stream disconnect still records the escalation AND sends the escalation email",
    async () => {
      llm.responseText = JSON.stringify({
        ...F3_RESPONSE,
        classification: { ...F3_RESPONSE.classification, phase: "PHASE_3", kind: "SYSTEM" },
        escalated: true,
      });
      emailMocks.sendEscalationGranted.mockClear();
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
          "organelle",
        );

        // The escalation row must land despite the disconnect.
        const escalation = await waitFor(
          async () => {
            const rows = await db
              .select()
              .from(harnessEscalationsTable)
              .where(eq(harnessEscalationsTable.sessionId, fx.sessionId));
            return rows[0] ?? null;
          },
          "harness_escalations row after client disconnect",
        );
        expect(escalation.fromFeature).toBe(3);
        expect(escalation.toFeature).toBe(5);

        // The "escalation granted" email must also be sent — the disconnect
        // must not drop the notification (regression: email used to sit
        // behind the clientClosed early-return).
        await waitFor(
          async () =>
            emailMocks.sendEscalationGranted.mock.calls.length > 0 ? true : null,
          "sendEscalationGranted call after client disconnect",
        );
        expect(emailMocks.sendEscalationGranted).toHaveBeenCalledTimes(1);
        expect(emailMocks.sendEscalationGranted).toHaveBeenCalledWith(
          expect.objectContaining({
            to: fx.user.email,
            engine: "F3 → F5",
            sessionName: expect.stringContaining("engine-disconnect"),
          }),
        );
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

  test("F5 rejects a fast incomplete governance response without an unhandled rejection or saved SPC", async () => {
    llm.delayMs = 0;
    llm.responseText = JSON.stringify({ ...F5_RESPONSE, honestyGate: undefined });
    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber, "/api/harness/f5/finalize", handleF5FinalizeStream));
    try {
      const response = await fetch(`${srv.url}/api/harness/f5/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: fx.sessionId, name: "Must not persist", answers: { "1": "Invoice reviewer" }, provider: "claude" }),
      });
      const body = await response.text();
      expect(body).toMatch(/event:\s*error/);
      expect(body).not.toMatch(/event:\s*complete/);
      expect(body).toContain("honestyGate");
      expect(await latestArtifact(fx.sessionId, "SPC")).toBeFalsy();
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  }, TEST_TIMEOUT_MS);

  test.each(["SPC", "ATLAS_360_SCAN_VIEW"] as const)(
    "F6 draft from F5 %s: a mid-stream disconnect still persists the ATLAS PDD and source lineage",
    async (sourceType) => {
      llm.responseText = JSON.stringify(F6_RESPONSE);
      // Keep generation blocked until after the socket has been aborted.
      // This proves persistence of work completed after disconnection, not a
      // race where a fast mocked response was already saved before abort.
      llm.delayMs = 0;
      let finishGeneration!: () => void;
      llm.responseGate = new Promise<void>((resolve) => { finishGeneration = resolve; });
      const fx = await seed();
      const srv = await startServer(
        buildApp(fx.user, fx.subscriber, "/api/harness/f6/draft", handleF6DraftStream),
      );
      try {
        const sourceArtifactId = await insertArtifact(fx, sourceType, 5,
          installGovernance(sourceType === "SPC" ? F5_RESPONSE : {
            ...GOVERNANCE_ASSESSMENT,
            title: "Dinner planner — F5 SCAN",
            scanOrigin: "F5_LINK_INTAKE",
            coverage: "REFERENCE_ONLY",
            missingEvidence: ["No external website content fetched in this test"],
          }));
        await openStreamThenAbortAfterFirstProgress(
          srv.url,
          "/api/harness/f6/draft",
          {
            sessionId: fx.sessionId,
            mode: "FROM_F5",
            sourceArtifactId,
            provider: "claude",
          },
          "step",
        );
        // Progress can be emitted while budget reservation is still awaiting
        // the database. Wait for the actual mocked provider invocation, without
        // releasing its result, before asserting post-abort persistence.
        await waitFor(async () => llm.callsStarted === 1 ? true : null,
          "provider invocation after the stream opened");
        expect(llm.callsStarted).toBe(1);
        expect(llm.callsCompleted).toBe(0);
        expect(await latestArtifact(fx.sessionId, "ATLAS_PDD")).toBeNull();
        finishGeneration();

        const artifact = await waitFor(
          () => latestArtifact(fx.sessionId, "ATLAS_PDD"),
          "ATLAS_PDD artifact after client disconnect",
        );
        expect(artifact.featureId).toBe(6);
        expect(artifact.userId).toBe(fx.user.id);
        expect(artifact.artifactContent).toMatchObject({
          cheatSheet: SAMPLE_ATLAS_PDD.cheatSheet,
          implementation: SAMPLE_ATLAS_PDD.implementation,
          sourceArtifactId,
          sourceFeatureId: 5,
        });
        expect(llm.callsCompleted).toBe(1);
        const saved = await db.select().from(harnessArtifactsTable).where(and(
          eq(harnessArtifactsTable.sessionId, fx.sessionId),
          eq(harnessArtifactsTable.artifactType, "ATLAS_PDD"),
        ));
        expect(saved).toHaveLength(1);
      } finally {
        finishGeneration();
        await srv.close();
        await cleanup(fx.user.id);
      }
    },
    TEST_TIMEOUT_MS,
  );

  test("F6 stream rejects invalid sources before opening SSE or calling a model", async () => {
    const fx = await seed();
    const foreign = await seed();
    const srv = await startServer(
      buildApp(fx.user, fx.subscriber, "/api/harness/f6/draft", handleF6DraftStream),
    );
    try {
      const governed = installGovernance(F5_RESPONSE);
      const wrongStage = await insertArtifact(fx, "SPC", 4, governed);
      const wrongType = await insertArtifact(fx, "ATLAS_PDD", 5, governed);
      const ungoverned = await insertArtifact(fx, "SPC", 5, F5_RESPONSE);
      const foreignOwner = await insertArtifact(foreign, "SPC", 5, governed);
      const [otherSession] = await db.insert(harnessSessionsTable).values({
        userId: fx.user.id, sessionName: "Another owned session",
      }).returning();
      const otherSessionSource = await insertArtifact(
        { ...fx, sessionId: otherSession!.id }, "SPC", 5, governed,
      );
      const cases = [
        { mode: "FRESH", brief: "A weekly family dinner planner under a $120 budget.", status: 400 },
        { mode: "FROM_F5", status: 400 },
        { mode: "FROM_F5", sourceArtifactId: wrongStage, status: 404 },
        { mode: "FROM_F5", sourceArtifactId: wrongType, status: 404 },
        { mode: "FROM_F5", sourceArtifactId: foreignOwner, status: 404 },
        { mode: "FROM_F5", sourceArtifactId: otherSessionSource, status: 404 },
        { mode: "FROM_F5", sourceArtifactId: ungoverned, status: 409 },
      ];
      for (const { status, ...input } of cases) {
        const response = await fetch(`${srv.url}/api/harness/f6/draft`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: fx.sessionId, provider: "claude", ...input }),
        });
        expect(response.status, JSON.stringify(input)).toBe(status);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(await response.json()).toHaveProperty("error");
      }
      expect(llm.callsStarted).toBe(0);
      const saved = await db.select().from(harnessArtifactsTable).where(and(
        eq(harnessArtifactsTable.sessionId, fx.sessionId),
        eq(harnessArtifactsTable.featureId, 6),
      ));
      expect(saved).toHaveLength(0);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
      await cleanup(foreign.user.id);
    }
  }, TEST_TIMEOUT_MS);

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
