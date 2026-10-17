import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  boomerangCasesTable, db, f0EngagementsTable, harnessArtifactsTable, harnessFeatureStateTable,
  harnessSessionsTable, spcPlayerDraftRunsTable, spcPlayerRunsTable, usersTable,
} from "@workspace/db";
import { BOOMERANG_FEATURES, BOOMERANG_STAGES, boomerangHash, boomerangOrigin } from "../src/lib/boomerang";

vi.mock("../src/lib/auth", () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.headers["x-owner"];
    if (!id) { res.status(401).json({ error: "Unauthorized" }); return; }
    req.localUser = { id } as NonNullable<express.Request["localUser"]>;
    next();
  },
}));
import router from "../src/routes/boomerang";
import spcRouter from "../src/routes/spc-player";

describe("process-wide Boomerang supporting work", () => {
  let base: string;
  let server: ReturnType<express.Express["listen"]>;
  let owner: string, stranger: string, sessionId: string, engagementId: string;
  beforeAll(async () => {
    const users = await db.insert(usersTable).values([1, 2].map(() => ({
      clerkUserId: `boomerang-${randomUUID()}`, email: `boomerang-${randomUUID()}@example.test`,
    }))).returning();
    owner = users[0]!.id; stranger = users[1]!.id;
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner, sessionName: "Boomerang test" }).returning();
    sessionId = session!.id;
    const [engagement] = await db.insert(f0EngagementsTable).values({ userId: owner, title: "Boomerang advisory" }).returning();
    engagementId = engagement!.id;
    await db.insert(harnessFeatureStateTable).values({ sessionId, featureId: 1, status: "AVAILABLE" });
    const app = express(); app.use(express.json()); app.use("/api", router); app.use("/api", spcRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (!owner) return;
    await db.delete(boomerangCasesTable).where(eq(boomerangCasesTable.userId, owner));
    await db.delete(spcPlayerDraftRunsTable).where(eq(spcPlayerDraftRunsTable.ownerUserId, owner));
    await db.delete(spcPlayerRunsTable).where(eq(spcPlayerRunsTable.userId, owner));
    await db.delete(f0EngagementsTable).where(eq(f0EngagementsTable.userId, owner));
    await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.userId, owner));
    await db.delete(harnessFeatureStateTable).where(eq(harnessFeatureStateTable.sessionId, sessionId));
    await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.userId, owner));
    await db.delete(usersTable).where(inArray(usersTable.id, [owner, stranger]));
  });

  async function call(path: string, data?: unknown, as = owner) {
    const response = await fetch(`${base}${path}`, {
      method: data ? "POST" : "GET",
      headers: { "content-type": "application/json", ...(as ? { "x-owner": as } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  async function create(stage = "F1", overrides: Record<string, unknown> = {}) {
    return call("/boomerang/cases", {
      originKind: stage === "F0" ? "F0" : "SESSION",
      originId: stage === "F0" ? engagementId : sessionId,
      stage, title: "Review this stage", brief: "Check the source constraints and propose bounded supporting changes.",
      ...overrides,
    });
  }
  async function action(row: { id: string; version: number }, action: string, input = {}) {
    return call(`/boomerang/cases/${row.id}/transition`, { action, expectedVersion: row.version, ...input });
  }

  test("supports every F stage and side-step with exact canonical destinations, without advancing anything", async () => {
    for (const stage of BOOMERANG_STAGES) {
      const created = await create(stage);
      expect(created.status).toBe(201);
      const returned = await action(created.body, "RETURN", { resultText: `Supporting advice for ${stage}: check the proposed constraints.` });
      expect(returned.status).toBe(200);
      const accepted = await action(returned.body, "ACCEPT", { note: "Reviewed as supporting input, not clearance." });
      expect(accepted.status).toBe(200);
      expect(accepted.body).toMatchObject({ state: "ACCEPTED", advisoryOnly: true, releaseAllowed: false, version: 3, sourceChanged: false });
      if (BOOMERANG_FEATURES[stage]) expect(accepted.body.originHref).toContain(`featureId=${BOOMERANG_FEATURES[stage]}`);
      const listed = await call(`/boomerang/cases?originId=${created.body.originId}&stage=${stage}`);
      expect(listed.body.some((item: { id: string; state: string }) => item.id === created.body.id && item.state === "ACCEPTED")).toBe(true);
    }
    const [state] = await db.select().from(harnessFeatureStateTable).where(eq(harnessFeatureStateTable.sessionId, sessionId));
    expect(state!.status).toBe("AVAILABLE");
    expect(await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, sessionId))).toEqual([]);
  });

  test("rejects anonymous, foreign, spoofed and mismatched origins", async () => {
    expect((await call("/boomerang/origins", undefined, "")).status).toBe(401);
    expect((await create("F1", { originId: randomUUID() })).status).toBe(404);
    expect((await create("F0", { originKind: "SESSION", originId: sessionId })).status).toBe(400);
    expect((await create("F12", { sourceHash: "forged" })).status).toBe(400);
    const created = await create();
    expect((await call("/boomerang/cases", undefined, stranger)).body).toEqual([]);
    expect((await call("/boomerang/origins", undefined, stranger)).body.origins).toEqual([]);
    expect((await call(`/boomerang/cases/${created.body.id}/transition`, {
      action: "RETURN", expectedVersion: 1, resultText: "Foreign text must never land",
    }, stranger)).status).toBe(404);
  });

  test("requires return before review, preserves revision history and rejects stale duplicate actions", async () => {
    const created = await create("F8");
    expect((await action(created.body, "ACCEPT")).status).toBe(409);
    expect((await action(created.body, "RETURN", { resultText: "          " })).status).toBe(400);
    const returned = await action(created.body, "RETURN", { resultText: "First supporting draft for review" });
    expect((await action(created.body, "RETURN", { resultText: "A duplicate stale returned draft" })).body.code).toBe("STALE_VERSION");
    expect((await action(returned.body, "REQUEST_REVISION")).status).toBe(400);
    const revision = await action(returned.body, "REQUEST_REVISION", { note: "Address the missing constraint." });
    const second = await action(revision.body, "RETURN", { resultText: "Second draft includes the missing constraint" });
    const rejected = await action(second.body, "REJECT", { note: "Not appropriate for this scope." });
    expect(rejected.body.state).toBe("REJECTED");
    expect(rejected.body.history.filter((event: { action: string }) => event.action === "RETURN")).toHaveLength(2);
    expect(rejected.body.history[1].resultText).toBe("First supporting draft for review");
    expect((await action(rejected.body, "ACCEPT")).status).toBe(409);
    const pending = await create("F12");
    expect((await action(pending.body, "CANCEL")).body.state).toBe("CANCELLED");
  });

  test("detects source drift both on return and after return before acceptance", async () => {
    const waiting = await create("F9.5");
    const created = await create("F10");
    const returned = await action(created.body, "RETURN", { resultText: "Check release handoff only; no release clearance." });
    const [source] = await db.insert(harnessArtifactsTable).values({
      sessionId, userId: owner, featureId: 1, artifactType: "PROMPT", name: "Changed baseline", artifactContent: { text: randomUUID() },
    }).returning();
    expect((await action(waiting.body, "RETURN", { resultText: "This advice used the old source baseline" })).body.code).toBe("SOURCE_CHANGED");
    expect((await action(returned.body, "ACCEPT")).body.code).toBe("SOURCE_CHANGED");
    const listed = await call(`/boomerang/cases?originId=${sessionId}&stage=F10`);
    expect(listed.body[0].sourceChanged).toBe(true);
    // Review may reject stale work, but may never approve it.
    expect((await action(returned.body, "REJECT", { note: "Source changed; fresh request needed." })).status).toBe(200);
    await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, source!.id));
  });

  test("imports only completed owned SPC output and freezes the actual bytes as supporting text", async () => {
    const runId = randomUUID();
    await db.insert(spcPlayerDraftRunsTable).values({
      id: runId, ownerUserId: owner, title: "Supporting run", brief: "A bounded supporting run",
      selectedCardIds: [], governance: {}, originSessionId: sessionId, originFeatureId: 9,
    });
    const created = await create("F8");
    expect((await action(created.body, "RETURN", { spcPlayerRunId: runId })).status).toBe(404);
    const output = { planOnly: true, result: "A completed supporting package" };
    await db.insert(spcPlayerRunsTable).values({
      id: runId, userId: owner, selectedExemplar: {}, structuredBrief: {},
      status: "completed", profile: "full", outputPackage: output,
      executionAdvisory: {}, distributionPlan: {},
    });
    expect((await action(created.body, "RETURN", { spcPlayerRunId: runId, resultText: "Cannot replace its source" })).status).toBe(400);
    const returned = await action(created.body, "RETURN", { spcPlayerRunId: runId });
    expect(returned.status).toBe(200);
    expect(JSON.parse(returned.body.resultText)).toEqual(output);
    const mismatch = await create("F9");
    expect((await action(mismatch.body, "RETURN", { spcPlayerRunId: runId })).body.code).toBe("RUN_ORIGIN_MISMATCH");
    await db.update(spcPlayerDraftRunsTable).set({
      governance: { boomerangBaseline: { hash: "f".repeat(64) } },
    }).where(eq(spcPlayerDraftRunsTable.id, runId));
    const staleRun = await create("F8");
    expect((await action(staleRun.body, "RETURN", { spcPlayerRunId: runId })).body.code).toBe("RUN_BASELINE_MISMATCH");
    const foreign = await call(`/boomerang/cases/${created.body.id}/transition`, { action: "ACCEPT", expectedVersion: 2 }, stranger);
    expect(foreign.status).toBe(404);
  });

  test("canonical source hashing is insensitive to JSONB key ordering", () => {
    expect(boomerangHash({ z: 1, a: { c: 2, b: 3 } })).toBe(boomerangHash({ a: { b: 3, c: 2 }, z: 1 }));
  });

  test("the existing SPC return path enters Boomerang review exactly once for new origin-bound runs", async () => {
    const runId = randomUUID();
    const baseline = await boomerangOrigin(db, owner, "SESSION", sessionId, "F8");
    await db.insert(spcPlayerDraftRunsTable).values({
      id: runId, ownerUserId: owner, title: "Origin-bound supporting work",
      brief: "Check and return supporting constraints.", selectedCardIds: [],
      originSessionId: sessionId, originFeatureId: 9,
      governance: { boomerangBaseline: { hash: baseline.hash, refs: baseline.refs, stage: "F8" } },
    });
    await db.insert(spcPlayerRunsTable).values({
      id: runId, userId: owner, selectedExemplar: {}, structuredBrief: {},
      status: "completed", profile: "full", outputPackage: { planOnly: true, content: "Supporting result only" },
      executionAdvisory: {}, distributionPlan: {},
    });
    const body = { confirmReturn: true, originSessionId: sessionId, originFeatureId: 9 };
    const first = await call(`/spc-player/runs/${runId}/return`, body);
    expect(first.status).toBe(200);
    const second = await call(`/spc-player/runs/${runId}/return`, body);
    expect(second.status).toBe(200);
    const rows = await db.select().from(boomerangCasesTable).where(eq(boomerangCasesTable.id, runId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: "RETURNED", version: 2, stage: "F8" });
    expect((rows[0]!.history as unknown[]).length).toBe(2);
    expect((await action(rows[0]!, "ACCEPT")).status).toBe(200);
  });
});
