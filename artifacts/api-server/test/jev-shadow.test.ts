import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable, harnessEngineRunsTable,
  harnessFeatureStateTable, jevShadowRunsTable, costBudgetReservationsTable } from "@workspace/db";

const mocks = vi.hoisted(() => ({ decide: vi.fn(), config: vi.fn() }));
vi.mock("@typesafe-ai/sdk", () => ({
  TypeSafeClient: class {
    constructor(config: unknown) { mocks.config(config); }
    systemOne = mocks.decide;
  },
}));
import { listJevShadow, runJevShadow } from "../src/lib/jev-shadow";
const users: string[] = [];
let userId: string, sessionId: string;
const request = (kind: "MODEL_ROUTING" | "REMEDIATION" = "MODEL_ROUTING") => ({
  sessionId, featureId: 9, kind, requestKey: randomUUID(),
});
const response = () => ({
  model: "jev-1.14.0",
  answers: { route: { choice: "REVIEW", confidence: 0.6 }, review: { noul: 0.7 } },
  usage: { input_tokens: 100, output_tokens: 0, cost: 0.0000042 },
});
beforeEach(async () => {
  mocks.decide.mockReset().mockResolvedValue(response());
  mocks.config.mockClear();
  vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_BASE_URL", "http://managed-proxy.internal/openrouter");
  vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_API_KEY", "test-key");
  const [u] = await db.insert(usersTable).values({
    clerkUserId: `jev-${randomUUID()}`, email: `jev-${randomUUID()}@example.test`,
  }).returning();
  userId = u!.id; users.push(userId);
  const [s] = await db.insert(harnessSessionsTable).values({ userId, sessionName: "JEV Regression Project" }).returning();
  sessionId = s!.id;
});
afterAll(async () => {
  for (const id of users) {
    for (const run of await db.select().from(jevShadowRunsTable).where(eq(jevShadowRunsTable.userId, id))) {
      const reservationId = run.result?.reservationId;
      if (typeof reservationId === "string") await db.delete(costBudgetReservationsTable).where(eq(costBudgetReservationsTable.id, reservationId));
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
  vi.unstubAllEnvs();
});
describe("JEV shadow integration", () => {
  it("records typed decisions and exact usage without changing model preferences or feature states", async () => {
    const report = await runJevShadow(userId, "PRACTITIONER", request());
    expect(report).toMatchObject({ status: "COMPLETED", mode: "SHADOW", modelId: "jev-1.14.0",
      result: { choice: "REVIEW", eligibleForAutomation: false, assessmentBasis: "UNVALIDATED_SHADOW_MODEL" } });
    expect(mocks.config).toHaveBeenCalledWith({
      baseURL: "http://managed-proxy.internal/openrouter", apiKey: "test-key", retry: { maxRetries: 0 }, timeout: 90000,
    });
    expect(mocks.decide.mock.calls[0]![0]).toMatchObject({ model: "jev-latest" });
    const [session] = await db.select().from(harnessSessionsTable).where(eq(harnessSessionsTable.id, sessionId));
    expect(session!.preferredModelProvider).toBe("claude");
    expect(await db.select().from(harnessFeatureStateTable).where(eq(harnessFeatureStateTable.sessionId, sessionId))).toHaveLength(0);
    const [run] = await db.select().from(harnessEngineRunsTable).where(eq(harnessEngineRunsTable.sessionId, sessionId));
    expect(run).toMatchObject({ provider: "jev", modelId: "jev-1.14.0", engineId: 410, inputTokens: 100, outputTokens: 0 });
    expect(Number(run!.costUsd)).toBeCloseTo(0.000004, 6);
    const history = await listJevShadow(userId, request());
    expect(history[0]!.id).toBe(report.id);
    expect(mocks.decide).toHaveBeenCalledOnce();
  });
  it("replays identical saved context even with a new request key without paid redispatch", async () => {
    const first = await runJevShadow(userId, "PRACTITIONER", request());
    const second = await runJevShadow(userId, "PRACTITIONER", request());
    expect(second.id).toBe(first.id);
    expect(mocks.decide).toHaveBeenCalledOnce();
  });
  it("rejects a reused request key for a different stage", async () => {
    const input = request();
    await runJevShadow(userId, "PRACTITIONER", input);
    await expect(runJevShadow(userId, "PRACTITIONER", { ...input, featureId: 7 })).rejects.toMatchObject({ status: 409 });
    expect(mocks.decide).toHaveBeenCalledOnce();
  });
  it("retains uncertainty and refuses to redispatch after timeout, including across new request keys", async () => {
    mocks.decide.mockRejectedValueOnce(new Error("Synthetic network timeout"));
    const first = await runJevShadow(userId, "PRACTITIONER", request());
    expect(first.status).toBe("UNCERTAIN");
    expect((await runJevShadow(userId, "PRACTITIONER", request())).id).toBe(first.id);
    expect(mocks.decide).toHaveBeenCalledOnce();
    // No real provider was called. Its synthetic reservation is cleaned up after the suite.
    const [row] = await db.select().from(jevShadowRunsTable).where(eq(jevShadowRunsTable.id, first.id));
    expect(row!.result?.choice).toBeUndefined();
  });
  it("fails closed when managed credentials are missing", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_API_KEY", "");
    await expect(runJevShadow(userId, "PRACTITIONER", request())).rejects.toMatchObject({ status: 503 });
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("rejects Explorer and foreign-session access, including history reads", async () => {
    await expect(runJevShadow(userId, "EXPLORER", request())).rejects.toMatchObject({ status: 403 });
    await expect(runJevShadow(randomUUID(), "PRACTITIONER", request())).rejects.toMatchObject({ status: 404 });
    await expect(listJevShadow(randomUUID(), request())).rejects.toMatchObject({ status: 404 });
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("binds remediation to current saved source and preserves its failing scores", async () => {
    const [artifact] = await db.insert(harnessArtifactsTable).values({
      userId, sessionId, featureId: 9, artifactType: "CODEBASE_BUNDLE", name: "JEV Regression Project — Code",
      artifactContent: {}, jcseScore: 40, mathmonScore: 60,
    }).returning();
    const result = await runJevShadow(userId, "PRACTITIONER", request("REMEDIATION"));
    expect(result.snapshot.recommendation).toMatchObject({
      sourceArtifactId: artifact!.id, jcseScore: 40, mathmonScore: 60, reingestionRequired: true,
    });
    const [unchanged] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, artifact!.id));
    expect(unchanged).toMatchObject({ jcseScore: 40, mathmonScore: 60 });
  });
  it("does not dispatch remediation when no stage artifact exists", async () => {
    await expect(runJevShadow(userId, "PRACTITIONER", request("REMEDIATION"))).rejects.toMatchObject({ status: 409 });
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("meters known provider usage even when the typed answer is unusable", async () => {
    mocks.decide.mockResolvedValueOnce({ ...response(), answers: { route: { choice: "ILLEGAL", confidence: 0.99 }, review: { noul: 0.1 } } });
    const report = await runJevShadow(userId, "PRACTITIONER", request());
    expect(report.status).toBe("UNCERTAIN");
    expect(report.result?.choice).toBeUndefined();
    expect(await db.select().from(harnessEngineRunsTable).where(eq(harnessEngineRunsTable.sessionId, sessionId))).toHaveLength(1);
  });
});
