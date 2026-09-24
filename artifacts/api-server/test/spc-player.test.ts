import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  harnessSessionsTable,
  spcPlayerRunsTable,
  usersTable,
} from "@workspace/db";
import { ensureStaffSubscriber, ensureStaffUser } from "../src/lib/staff-auth";

const { callLlmJsonMock, resolveProviderMock } = vi.hoisted(() => ({
  callLlmJsonMock: vi.fn(),
  resolveProviderMock: vi.fn(() => "claude"),
}));
const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../src/engines/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engines/shared")>();
  return {
    ...actual,
    callLlmJson: callLlmJsonMock,
    resolveProvider: resolveProviderMock,
  };
});

vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireAuth: requireAuthMock };
});

process.env.STAFF_ACCESS_CODE ??= `spc-player-${randomUUID()}`;
process.env.SESSION_SECRET ??= `spc-player-session-${randomUUID()}`;

function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const noop = (): void => {};
  (req as Request & { log: Record<string, unknown> }).log = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => (req as Request & { log: unknown }).log,
  };
  next();
}

async function startApp(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const [staffAuthRouter, spcPlayerRouter] = await Promise.all([
    import("../src/routes/staff-auth").then((module) => module.default),
    import("../src/routes/spc-player").then((module) => module.default),
  ]);
  const app: Express = express();
  app.use(express.json());
  app.use(cookieParser(process.env.SESSION_SECRET));
  app.use(requestLogger);
  app.use("/api", staffAuthRouter);
  app.use("/api", spcPlayerRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No test server address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

describe("SPC Player supported backend foundation", () => {
  let server: Awaited<ReturnType<typeof startApp>>;
  const ownerName = `SPC Player Owner ${randomUUID()}`;
  const otherName = `SPC Player Other ${randomUUID()}`;
  let ownerCookie: string;
  let otherCookie: string;
  let ownerClerkId: string;
  let otherClerkId: string;

  beforeEach(() => {
    let cardIndex = 0;
    callLlmJsonMock.mockReset();
    callLlmJsonMock.mockImplementation(async (...args: unknown[]) => {
      const system = String(args[1]);
      if (system.includes("final governance evaluator")) {
        return {
          verdict: "PASS",
          content: "Governance evaluation complete.",
          evidence: ["governance-evidence"],
          scores: { clarity: 82, truthfulness: 91, detectability: 76 },
        };
      }
      const result = {
        verdict: `CARD_${cardIndex}`,
        content: `Card output ${cardIndex}`,
        evidence: [`card-evidence-${cardIndex}`],
      };
      cardIndex += 1;
      return result;
    });
    resolveProviderMock.mockReset();
    resolveProviderMock.mockReturnValue("claude");
    requireAuthMock.mockImplementation(async (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      const session = req.headers["x-test-session"];
      if (typeof session !== "string") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const parsed = JSON.parse(decodeURIComponent(session)) as {
        handle: string;
        name: string;
      };
      req.localUser = await ensureStaffUser(parsed.handle, parsed.name);
      next();
    });
  });

  async function login(name: string): Promise<{
    cookie: string;
    handle: string;
  }> {
    const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const user = await ensureStaffUser(handle, name);
    // Keep the test principals fully entitled, as production execution requires
    // a subscriber even though the auth middleware is replaced below.
    await ensureStaffSubscriber(user.id);
    return {
      cookie: encodeURIComponent(JSON.stringify({ handle, name })),
      handle,
    };
  }

  async function api(
    path: string,
    init: RequestInit = {},
    cookie = ownerCookie,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("x-test-session", cookie);
    const separator = path.includes("?") ? "&" : "?";
    return fetch(
      `${server.url}${path}${separator}__testSession=${cookie}`,
      { ...init, headers },
    );
  }

  beforeAll(async () => {
    server = await startApp();
    const owner = await login(ownerName);
    const other = await login(otherName);
    ownerCookie = owner.cookie;
    otherCookie = other.cookie;
    ownerClerkId = `staff:${owner.handle}`;
    otherClerkId = `staff:${other.handle}`;
  });

  afterAll(async () => {
    await server?.close();
    await db
      .delete(usersTable)
      .where(inArray(usersTable.clerkUserId, [ownerClerkId, otherClerkId]));
  });

  test("rejects unauthenticated catalog access", async () => {
    const response = await fetch(`${server.url}/api/spc-player/catalog`);
    expect(response.status).toBe(401);
  });

  test("registry reports open access separately from certification status", async () => {
    const response = await fetch(`${server.url}/api/spc-player/registry`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "available",
      access: "open_access",
      certificationStatus: "pre_build",
    });
  });

  test("rejects non-public and IPv4-mapped webhook addresses", async () => {
    const { publicAddress } = await import("../src/routes/spc-player");
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
    expect(publicAddress("127.0.0.1")).toBe(false);
    expect(publicAddress("100.64.0.1")).toBe(false);
    expect(publicAddress("192.0.2.1")).toBe(false);
    expect(publicAddress("::ffff:127.0.0.1")).toBe(false);
    expect(publicAddress("::ffff:10.0.0.1")).toBe(false);
    expect(publicAddress("2001:db8::1")).toBe(false);
  });

  test("catalog combines the six seed cards with SPCs discovered from the Exemplar Library", async () => {
    const response = await api("/api/spc-player/catalog");
    const raw = await response.text();
    expect(response.status, raw.slice(0, 2000)).toBe(200);
    const cards = JSON.parse(raw) as Array<Record<string, unknown>>;
    expect(cards.length).toBeGreaterThan(6);
    expect(cards.map((card) => card.name)).toEqual(
      expect.arrayContaining([
        "ATLAS 360 PLAN",
        "BUGMXT",
        "CODE DJ",
        "CODON",
        "CORDON",
        "SPARTAN",
      ]),
    );
    expect(
      cards.some(
        (card) =>
          (card.provenance as { source?: string } | undefined)?.source ===
          "exemplar-library",
      ),
    ).toBe(true);
    for (const card of cards.filter(
      (card) =>
        (card.provenance as { source?: string } | undefined)?.source !==
        "exemplar-library",
    )) {
      expect(card.cheatSheetPublished).toBe(false);
      expect(card.cheatSheet).toBeNull();
      expect(card.thirdPartyDefinitions).toBeNull();
    }
  });

  test("rejects KIT DECKS above the 12-SPC execution limit", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    expect(catalog.length).toBeGreaterThanOrEqual(13);

    const response = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Oversized deck ${randomUUID()}`,
        brief: "This request deliberately exceeds the bounded KIT DECK limit.",
        selectedCardIds: catalog.slice(0, 13).map((card) => card.id),
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/at most 12|invalid/i),
    });
  });

  test("Dev Kit exposes the exact ordered baseline and does not execute it", async () => {
    const response = await api("/api/spc-player/dev-kit");
    const kit = (await response.json()) as {
      cards: Array<{ name: string }>;
      executes: boolean;
      registrationNote: string;
    };
    expect(response.status).toBe(200);
    expect(kit.cards.map((card) => card.name)).toEqual([
      "ATLAS 360 PLAN",
      "SPARTAN",
      "CODE DJ",
      "BUGMXT",
      "CODON",
      "CORDON",
    ]);
    expect(kit.executes).toBe(false);
    expect(kit.registrationNote).toMatch(/does not execute/i);
  });

  test("persists drafts, lists only owned drafts, and hides them from other users", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const title = `Draft ${randomUUID()}`;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        brief: "A persisted draft brief.",
        selectedCardIds: catalog.slice(0, 2).map((card) => card.id),
      }),
    });
    const createBody = await createResponse.text();
    expect(createResponse.status, createBody.slice(0, 2000)).toBe(201);
    const created = JSON.parse(createBody) as {
      id: string;
      status: string;
      ownerUserId: string;
    };
    expect(created.status).toBe("DRAFT");
    expect(created.ownerUserId).toBeTruthy();

    const listResponse = await api("/api/spc-player/runs");
    const listed = (await listResponse.json()) as Array<{ id: string; title: string }>;
    expect(listed.some((run) => run.id === created.id && run.title === title)).toBe(true);

    const getResponse = await api(`/api/spc-player/runs/${created.id}`);
    expect(getResponse.status).toBe(200);
    expect((await getResponse.json()).id).toBe(created.id);

    const strangerGet = await api(
      `/api/spc-player/runs/${created.id}`,
      {},
      otherCookie,
    );
    expect(strangerGet.status).toBe(404);
    const strangerList = await api("/api/spc-player/runs", {}, otherCookie);
    const strangerRuns = (await strangerList.json()) as Array<{ id: string }>;
    expect(strangerRuns.some((run) => run.id === created.id)).toBe(false);
  });

  test("passes the selected owned artifact to SPC providers and rejects cross-user selection", async () => {
    const [owner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, ownerClerkId))
      .limit(1);
    const [other] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, otherClerkId))
      .limit(1);
    expect(owner).toBeDefined();
    expect(other).toBeDefined();

    const [ownerSession] = await db
      .insert(harnessSessionsTable)
      .values({
        userId: owner!.id,
        sessionName: `SPC artifact context ${randomUUID()}`,
        preferredModelProvider: "claude",
      })
      .returning();
    const [ownerArtifact] = await db
      .insert(harnessArtifactsTable)
      .values({
        sessionId: ownerSession!.id,
        userId: owner!.id,
        featureId: 5,
        artifactType: "SPC",
        name: "Selected SPC source",
        artifactContent: {
          product: "Artifact-grounded product",
          marker: "spc-artifact-context-regression",
        },
      })
      .returning();
    const [otherSession] = await db
      .insert(harnessSessionsTable)
      .values({
        userId: other!.id,
        sessionName: `Foreign SPC artifact ${randomUUID()}`,
        preferredModelProvider: "claude",
      })
      .returning();
    const [foreignArtifact] = await db
      .insert(harnessArtifactsTable)
      .values({
        sessionId: otherSession!.id,
        userId: other!.id,
        featureId: 5,
        artifactType: "SPC",
        name: "Foreign SPC source",
        artifactContent: { marker: "foreign-artifact-must-be-rejected" },
      })
      .returning();
    expect(ownerArtifact).toBeDefined();
    expect(foreignArtifact).toBeDefined();

    const catalog = (await (await api("/api/spc-player/catalog")).json()) as Array<{ id: string }>;
    const foreignSelection = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Foreign artifact ${randomUUID()}`,
        brief: "This must not be accepted.",
        selectedCardIds: [catalog[0]!.id],
        sourceArtifactId: foreignArtifact!.id,
      }),
    });
    expect(foreignSelection.status).toBe(404);

    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Owned artifact ${randomUUID()}`,
        brief: "Execute against the selected project artifact.",
        selectedCardIds: [catalog[0]!.id],
        sourceArtifactId: ownerArtifact!.id,
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      sourceArtifactId: string | null;
    };
    expect(created.sourceArtifactId).toBe(ownerArtifact!.id);

    const executeResponse = await api(`/api/spc-player/runs/${created.id}/execute`, {
      method: "POST",
    });
    expect(executeResponse.status).toBe(200);

    const stagePrompt = String(callLlmJsonMock.mock.calls[0]?.[2]);
    expect(stagePrompt).toContain("SOURCE PROJECT ARTIFACT (SPC · Selected SPC source)");
    expect(stagePrompt).toContain("spc-artifact-context-regression");
    expect(stagePrompt).toContain("Artifact-grounded product");
  });

  test("execution is owner-protected and persists ordered stages, governance scores, advisory, and plan", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Execution ${randomUUID()}`,
        brief: "Execute this generic SPC Player draft.",
        selectedCardIds: [catalog[1]!.id, catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    const unauthenticated = await fetch(
      `${server.url}/api/spc-player/runs/${created.id}/execute`,
      { method: "POST" },
    );
    expect(unauthenticated.status).toBe(401);
    const otherOwner = await api(
      `/api/spc-player/runs/${created.id}/execute`,
      { method: "POST" },
      otherCookie,
    );
    expect(otherOwner.status).toBe(404);
    const response = await api(`/api/spc-player/runs/${created.id}/execute`, {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const persisted = await api(`/api/spc-player/runs/${created.id}`);
    const run = (await persisted.json()) as {
      status: string;
      selectedCardIds: string[];
      stageResults: Array<{ cardId: string; verdict: string; invoked: boolean }>;
      governanceEvaluation: {
        invoked: boolean;
        scores: { clarity: number; truthfulness: number; detectability: number };
      };
      executionAdvisory: {
        governanceEvaluationInvoked: boolean;
        invokedStages: number[];
        distribution: string;
      };
      distributionPlan: {
        status: string;
        connectorInvoked: boolean;
        externalSend: boolean;
      };
      outputPackage: Record<string, unknown>;
      transitions: Array<{ to: string }>;
    };
    expect(run.status).toBe("COMPLETED");
    expect(run.stageResults.map((stage) => stage.cardId)).toEqual(run.selectedCardIds);
    expect(run.stageResults.map((stage) => stage.verdict)).toEqual(["CARD_0", "CARD_1"]);
    expect(run.stageResults.every((stage) => stage.invoked)).toBe(true);
    expect(run.governanceEvaluation).toMatchObject({
      invoked: true,
      scores: { clarity: 82, truthfulness: 91, detectability: 76 },
    });
    expect(run.executionAdvisory.governanceEvaluationInvoked).toBe(true);
    expect(run.executionAdvisory.invokedStages).toEqual([0, 1]);
    expect(run.executionAdvisory.distribution).toBe("plan-only; no connector invoked");
    expect(run.distributionPlan).toEqual({
      status: "plan_only",
      connectorInvoked: false,
      externalSend: false,
    });
    expect(run.outputPackage).toHaveProperty("governanceEvaluation");
    expect(JSON.stringify(run.outputPackage)).not.toMatch(/composite(?:Score)?/i);
    expect(run.transitions.map((transition) => transition.to)).toEqual([
      "RUNNING",
      "COMPLETED",
    ]);
  });

  test("simultaneous initial claims invoke once and non-expired RUNNING returns 409", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Concurrent ${randomUUID()}`,
        brief: "Concurrent initial claims.",
        selectedCardIds: [catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    const original = callLlmJsonMock.getMockImplementation()!;
    let providerCalls = 0;
    callLlmJsonMock.mockImplementation(async (...args: unknown[]) => {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return original(...args);
    });

    const [first, second] = await Promise.all([
      api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" }),
      api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(providerCalls).toBe(2);
  });

  test("run details distinguish active, expired, and legacy interrupted attempts without exposing tokens", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Availability ${randomUUID()}`,
        brief: "Expose safe retry availability.",
        selectedCardIds: [catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    const original = callLlmJsonMock.getMockImplementation()!;
    let stageStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      stageStarted = resolve;
    });
    let releaseStage!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseStage = resolve;
    });
    callLlmJsonMock.mockImplementationOnce(async (...args: unknown[]) => {
      stageStarted();
      await held;
      return original(...args);
    });

    const execution = api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });
    await started;

    const activeResponse = await api(`/api/spc-player/runs/${created.id}`);
    const active = (await activeResponse.json()) as Record<string, unknown>;
    expect(active).toMatchObject({
      status: "RUNNING",
      executionState: "ACTIVE",
      canExecute: false,
    });
    expect(active.retryAvailableAt).toEqual(expect.any(String));
    expect(active).not.toHaveProperty("attemptToken");

    const expiredAt = new Date(Date.now() - 1_000);
    await db
      .update(spcPlayerRunsTable)
      .set({ leaseExpiresAt: expiredAt })
      .where(eq(spcPlayerRunsTable.id, created.id));
    const expired = (await (
      await api(`/api/spc-player/runs/${created.id}`)
    ).json()) as Record<string, unknown>;
    expect(expired).toMatchObject({
      status: "RUNNING",
      executionState: "RECOVERABLE",
      canExecute: true,
      retryAvailableAt: expiredAt.toISOString(),
    });

    await db
      .update(spcPlayerRunsTable)
      .set({ leaseExpiresAt: null })
      .where(eq(spcPlayerRunsTable.id, created.id));
    const legacy = (await (
      await api(`/api/spc-player/runs/${created.id}`)
    ).json()) as Record<string, unknown>;
    expect(legacy).toMatchObject({
      status: "RUNNING",
      executionState: "RECOVERABLE",
      canExecute: true,
      retryAvailableAt: null,
    });

    releaseStage();
    expect((await execution).status).toBe(200);
  });

  test("legacy null-lease recovery fences a stale worker from overwriting newer completion", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Recovery ${randomUUID()}`,
        brief: "Expired lease recovery.",
        selectedCardIds: [catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    const original = callLlmJsonMock.getMockImplementation()!;
    let firstStageStarted!: () => void;
    const firstStage = new Promise<void>((resolve) => {
      firstStageStarted = resolve;
    });
    let releaseFirstStage!: () => void;
    const holdFirstStage = new Promise<void>((resolve) => {
      releaseFirstStage = resolve;
    });
    let invocation = 0;
    callLlmJsonMock.mockImplementation(async (...args: unknown[]) => {
      const system = String(args[1]);
      if (invocation === 0 && !system.includes("final governance evaluator")) {
        invocation += 1;
        firstStageStarted();
        await holdFirstStage;
      }
      return original(...args);
    });

    const staleWorker = api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });
    await firstStage;
    await db
      .update(spcPlayerRunsTable)
      .set({ leaseExpiresAt: null })
      .where(eq(spcPlayerRunsTable.id, created.id));

    const recovered = await api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });
    expect(recovered.status).toBe(200);
    releaseFirstStage();
    const staleResponse = await staleWorker;
    expect(staleResponse.status).toBe(409);

    const persisted = await api(`/api/spc-player/runs/${created.id}`);
    const run = (await persisted.json()) as {
      status: string;
      governanceEvaluation: unknown;
      transitions: Array<{ reason?: string }>;
    };
    expect(run.status).toBe("COMPLETED");
    expect(run.governanceEvaluation).not.toBeNull();
    expect(run.transitions.some((transition) => transition.reason === "lease_expired_recovery")).toBe(true);
  });

  test("simultaneous FAILED retries atomically select one new attempt", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Retry ${randomUUID()}`,
        brief: "Concurrent failed retries.",
        selectedCardIds: [catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    callLlmJsonMock.mockRejectedValueOnce(new Error("first attempt failed"));
    const firstAttempt = await api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });
    expect(firstAttempt.status).toBe(502);

    const original = callLlmJsonMock.getMockImplementation()!;
    let providerCalls = 0;
    callLlmJsonMock.mockImplementation(async (...args: unknown[]) => {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return original(...args);
    });
    const [retryOne, retryTwo] = await Promise.all([
      api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" }),
      api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" }),
    ]);
    expect([retryOne.status, retryTwo.status].sort()).toEqual([200, 409]);
    expect(providerCalls).toBe(2);
  });

  test("provider failures persist FAILED before returning the provider response", async () => {
    callLlmJsonMock.mockRejectedValueOnce(new Error("deterministic provider failure"));
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Failure ${randomUUID()}`,
        brief: "Provider failure persistence.",
        selectedCardIds: [catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    const response = await api(`/api/spc-player/runs/${created.id}/execute`, {
      method: "POST",
    });
    expect(response.status).toBe(502);
    const persisted = await api(`/api/spc-player/runs/${created.id}`);
    const run = (await persisted.json()) as {
      status: string;
      error: string | null;
      governanceEvaluation: unknown;
      executionAdvisory: { governanceEvaluationInvoked: boolean };
      transitions: Array<{ to: string }>;
    };
    expect(run.status).toBe("FAILED");
    expect(run.error).toContain("deterministic provider failure");
    expect(run.governanceEvaluation).toBeNull();
    expect(run.executionAdvisory.governanceEvaluationInvoked).toBe(false);
    expect(run.transitions.map((transition) => transition.to)).toEqual(["RUNNING", "FAILED"]);
  });

  test("manifest is a JSON attachment containing draft metadata and no composite output score", async () => {
    const catalogResponse = await api("/api/spc-player/catalog");
    const catalog = (await catalogResponse.json()) as Array<{ id: string }>;
    const createResponse = await api("/api/spc-player/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Manifest ${randomUUID()}`,
        brief: "Manifest metadata only.",
        selectedCardIds: [catalog[0]!.id],
      }),
    });
    const created = (await createResponse.json()) as { id: string };
    const unauthenticated = await fetch(
      `${server.url}/api/spc-player/runs/${created.id}/manifest`,
    );
    expect(unauthenticated.status).toBe(401);
    const otherOwner = await api(
      `/api/spc-player/runs/${created.id}/manifest`,
      {},
      otherCookie,
    );
    expect(otherOwner.status).toBe(404);
    const response = await api(`/api/spc-player/runs/${created.id}/manifest`);
    const body = (await response.json()) as {
      manifestVersion: string;
      run: {
        id: string;
        status: string;
        outputPackage: unknown;
        governance: Record<string, unknown>;
      };
      governance: { specVersion: string };
      capabilities: {
        entitlement: string;
        connectors: string[];
        actions: string[];
      };
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(response.headers.get("content-disposition")).toMatch(
      new RegExp(
        `^attachment; filename="SPC_PLAYER_MANIFEST\\.[A-Z0-9.]+\\.${created.id.toUpperCase()}\\.\\d{2}\\.\\d{2}\\.\\d{2}\\.\\d{1,2}-\\d{2}-\\d{2}(?:AM|PM)\\.json"$`,
      ),
    );
    expect(body.manifestVersion).toBe("spc-player-manifest-v2");
    expect(body.run).toMatchObject({ id: created.id, status: "DRAFT" });
    expect(body.run.outputPackage).toBeNull();
    expect(body.governance.specVersion).toBe("v4.0");
    expect(body.governance).toEqual(body.run.governance);
    expect(body.capabilities).toMatchObject({
      entitlement: "open_access",
      connectors: ["download", "webhook"],
      actions: ["execute", "deliver"],
    });
    expect(JSON.stringify(body.run.outputPackage ?? {})).not.toMatch(
      /composite(?:Score)?/i,
    );
  });

  test("download is ownership-scoped and returns the completed JSON output package", async () => {
    const catalog = (await (await api("/api/spc-player/catalog")).json()) as Array<{ id: string }>;
    const created = (await (
      await api("/api/spc-player/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Download ${randomUUID()}`,
          brief: "Completed output download.",
          selectedCardIds: [catalog[0]!.id],
        }),
      })
    ).json()) as { id: string };
    await api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });

    const stranger = await api(`/api/spc-player/runs/${created.id}/download`, {}, otherCookie);
    expect(stranger.status).toBe(404);
    const response = await api(`/api/spc-player/runs/${created.id}/download`);
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(
      new RegExp(
        `^attachment; filename="SPC_PLAYER\\.[A-Z0-9.]+\\.${created.id.toUpperCase()}\\.\\d{2}\\.\\d{2}\\.\\d{2}\\.\\d{1,2}-\\d{2}-\\d{2}(?:AM|PM)\\.json"$`,
      ),
    );
    expect(body).toHaveProperty("governanceEvaluation");
    expect(JSON.stringify(body)).not.toMatch(/composite(?:Score)?/i);
  });

  test("requires explicit webhook authorization and rejects private destinations", async () => {
    const catalog = (await (await api("/api/spc-player/catalog")).json()) as Array<{ id: string }>;
    const created = (await (
      await api("/api/spc-player/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Webhook ${randomUUID()}`,
          brief: "Webhook authorization test.",
          selectedCardIds: [catalog[0]!.id],
        }),
      })
    ).json()) as { id: string };
    await api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });

    const missingGrant = await api(`/api/spc-player/runs/${created.id}/deliver`, { method: "POST" });
    expect(missingGrant.status).toBe(400);
    const missingStatus = await api(`/api/spc-player/runs/${created.id}/authorize`);
    expect(await missingStatus.json()).toMatchObject({
      authorized: false,
      endpoint: null,
      authorizedAt: null,
    });
    const privateGrant = await api(`/api/spc-player/runs/${created.id}/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "https://127.0.0.1/hook" }),
    });
    expect(privateGrant.status).toBe(400);
    const mappedPrivateGrant = await api(`/api/spc-player/runs/${created.id}/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "https://[::ffff:127.0.0.1]/hook" }),
    });
    expect(mappedPrivateGrant.status).toBe(400);

    const stranger = await api(
      `/api/spc-player/runs/${created.id}/authorize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "https://example.com/hook" }),
      },
      otherCookie,
    );
    expect(stranger.status).toBe(404);
  });

  test("reports webhook non-2xx failures without leaking credentials", async () => {
    const catalog = (await (await api("/api/spc-player/catalog")).json()) as Array<{ id: string }>;
    const created = (await (
      await api("/api/spc-player/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Webhook failure ${randomUUID()}`,
          brief: "Webhook delivery failure test.",
          selectedCardIds: [catalog[0]!.id],
        }),
      })
    ).json()) as { id: string };
    await api(`/api/spc-player/runs/${created.id}/execute`, { method: "POST" });
    const authorized = await api(`/api/spc-player/runs/${created.id}/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "https://example.com/hook" }),
    });
    expect(authorized.status).toBe(200);

    const { spcPlayerWebhookTransport } = await import("../src/routes/spc-player");
    const postSpy = vi.spyOn(spcPlayerWebhookTransport, "post").mockResolvedValue(503);
    try {
      const delivered = await api(`/api/spc-player/runs/${created.id}/deliver`, { method: "POST" });
      expect(delivered.status).toBe(502);
      expect(await delivered.json()).toEqual({
        error: "Webhook delivery failed",
        statusCode: 503,
      });
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.objectContaining({ hostname: "example.com" }),
          address: expect.any(String),
          family: expect.toBeOneOf([4, 6]),
        }),
        expect.objectContaining({ connector: "webhook", action: "deliver" }),
      );
    } finally {
      postSpy.mockRestore();
    }
  });
});