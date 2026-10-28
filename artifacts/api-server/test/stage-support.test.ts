import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, usersTable, harnessSessionsTable, harnessArtifactsTable, boomerangCasesTable,
  ingestionDocumentsTable, cartridgePackagesTable,
} from "@workspace/db";
import { supportAvailability, exactSupportSource, safePreparationResult } from "../src/lib/stage-support";

vi.mock("../src/lib/auth", () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.headers["x-owner"];
    if (typeof id !== "string") { res.status(401).json({ error: "Unauthorized" }); return; }
    req.localUser = { id } as NonNullable<express.Request["localUser"]>;
    next();
  },
}));
import router from "../src/routes/stage-support";
import boomerangRouter from "../src/routes/boomerang";

describe("stage support qualification", () => {
  test("requires exact-stage source, not an upstream fallback", () => {
    expect(exactSupportSource([{ id: "a", featureId: 4, artifactType: "MICRO_PDD", createdAt: new Date() }], 9)).toBeUndefined();
    expect(supportAvailability(undefined, "ingestion").active).toBe(false);
  });
  test("separates publication and sprint source qualifications", () => {
    const source = { id: "a", featureId: 6, artifactType: "ATLAS_PDD", createdAt: new Date() };
    expect(supportAvailability(source, "imprima").active).toBe(true);
    expect(supportAvailability(source, "short-sprints").active).toBe(false);
    expect(supportAvailability({ ...source, artifactType: "CODE_BUNDLE" }, "imprima").active).toBe(false);
    expect(supportAvailability({ ...source, artifactType: "SPC" }, "short-sprints").active).toBe(true);
  });
  test("requires a completed matching preparation and strips private storage keys", () => {
    const content = { kind: "imprima", sourceId: "a", state: "PREPARED_DRAFT", files: [
      { id: "f", filename: "draft.md", objectKey: "private/never-export", mime: "text/markdown" },
    ] };
    const safe = safePreparationResult(content, "imprima", "a");
    expect(JSON.stringify(safe)).not.toContain("private/never-export");
    expect(() => safePreparationResult(content, "imprima", "other")).toThrow();
    expect(() => safePreparationResult({ ...content, state: "RUNNING" }, "imprima", "a")).toThrow();
  });
});

describe("persisted stage-support round trip", () => {
  let owner: string, stranger: string, base: string;
  let server: ReturnType<express.Express["listen"]>;
  const sessionIds: string[] = [];
  beforeAll(async () => {
    const users = await db.insert(usersTable).values([1, 2].map(() => ({
      clerkUserId: `stage-support-${randomUUID()}`, email: `stage-support-${randomUUID()}@example.test`,
    }))).returning();
    owner = users[0]!.id; stranger = users[1]!.id;
    const app = express(); app.use(express.json()); app.use("/api", router); app.use("/api", boomerangRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(async () => {
    await new Promise<void>(resolve => server?.close(() => resolve()));
    if (!owner) return;
    await db.delete(boomerangCasesTable).where(inArray(boomerangCasesTable.userId, [owner, stranger]));
    if (sessionIds.length) {
      await db.delete(harnessArtifactsTable).where(inArray(harnessArtifactsTable.sessionId, sessionIds));
      await db.delete(harnessSessionsTable).where(inArray(harnessSessionsTable.id, sessionIds));
    }
    await db.delete(ingestionDocumentsTable).where(inArray(ingestionDocumentsTable.userId, [owner, stranger]));
    await db.delete(cartridgePackagesTable).where(inArray(cartridgePackagesTable.userId, [owner, stranger]));
    await db.delete(usersTable).where(inArray(usersTable.id, [owner, stranger]));
  });
  async function request(path: string, body?: unknown, user = owner) {
    const response = await fetch(`${base}${path}`, { method: body ? "POST" : "GET",
      headers: { "x-owner": user, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function setup(tool: string, featureId = 4, artifactType = "MICRO_PDD") {
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner, sessionName: `Support QA ${randomUUID()}` }).returning();
    sessionIds.push(session!.id);
    const [source] = await db.insert(harnessArtifactsTable).values({ userId: owner, sessionId: session!.id,
      featureId, artifactType, name: `${session!.sessionName} · saved source`, artifactContent: { content: "Governed QA source without credentials." } }).returning();
    const departure = await request("/stage-support/departures", { sessionId: session!.id, featureId, tool });
    expect(departure.status).toBe(201);
    return { source: source!, session: session!, departure: departure.data };
  }
  async function ingestion(user = owner, createdAt?: Date) {
    const [saved] = await db.insert(ingestionDocumentsTable).values({
      userId: user, originalFilename: "qa.md", mimeType: "text/markdown", fileSizeBytes: 35,
      extractedTextSha256: "a".repeat(64), extractedTextChars: 35, summary: "QA saved normalized result",
      seedPrompt: "Revised input for explicit review only.", ...(createdAt ? { createdAt } : {}),
    }).returning();
    return saved!;
  }
  test("intake return persists exactly one project-named candidate, survives GET and stays unverified", async () => {
    const { departure, source, session } = await setup("ingestion", 9, "CODE_BUNDLE");
    const saved = await ingestion();
    const path = `/stage-support/departures/${departure.caseId}/return`;
    const returned = await request(path, { resultId: saved.id });
    expect(returned.status).toBe(200);
    expect(returned.data.upgradeLabel).toBe("Upgraded 1");
    expect(returned.data.returnedArtifactHref).toContain(`featureId=9&artifactId=${returned.data.returnedArtifactId}`);
    const repeat = await request(path, { resultId: saved.id });
    expect(repeat.data.returnedArtifactId).toBe(returned.data.returnedArtifactId);
    const [artifact] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, returned.data.returnedArtifactId));
    expect(artifact?.name).toMatch(new RegExp(`^${session.sessionName}`));
    expect(artifact?.parentArtifactId).toBe(source.id);
    expect(artifact?.verificationStatus).toBe("UNVERIFIED");
    expect(artifact?.artifactContent).toMatchObject({ reviewRequired: true, certifies: false, advancesStage: false });
    const reloaded = await request(`/stage-support/departures/${departure.caseId}`);
    expect(reloaded.data.returnedArtifactHref).toBe(returned.data.returnedArtifactHref);
    const secondDeparture = await request("/stage-support/departures", { sessionId: session.id, featureId: 9, tool: "ingestion" });
    const second = await request(`/stage-support/departures/${secondDeparture.data.caseId}/return`, { resultId: (await ingestion()).id });
    expect(second.data.upgradeLabel).toBe("Upgraded 2");
  });
  test("rejects foreign sessions, departures and saved results", async () => {
    const { departure, session } = await setup("ingestion");
    expect((await request(`/stage-support/options?sessionId=${session.id}&featureId=4`, undefined, stranger)).status).toBe(404);
    expect((await request(`/stage-support/departures/${departure.caseId}`, undefined, stranger)).status).toBe(404);
    expect((await request(`/stage-support/departures/${departure.caseId}/return`, { resultId: (await ingestion(stranger)).id })).status).toBe(404);
  });
  test("rejects old results and origin changes, without creating a candidate", async () => {
    const { departure, source } = await setup("ingestion");
    const path = `/stage-support/departures/${departure.caseId}/return`;
    expect((await request(path, { resultId: (await ingestion(owner, new Date(0))).id })).status).toBe(409);
    await db.update(harnessArtifactsTable).set({ artifactContent: { changed: true } }).where(eq(harnessArtifactsTable.id, source.id));
    expect((await request(path, { resultId: (await ingestion()).id })).data.code).toBe("SOURCE_CHANGED");
  });
  test.each(["imprima", "short-sprints"])("%s returns only its own new completed preparation and allows reviewed acceptance", async tool => {
    const { departure, source, session } = await setup(tool);
    const [saved] = await db.insert(harnessArtifactsTable).values({
      userId: owner, sessionId: session.id, featureId: tool === "imprima" ? -210 : -211,
      artifactType: tool === "imprima" ? "IMPRIMA_PREPARATION" : "SHORT_SPRINT_PREPARATION", parentArtifactId: source.id,
      artifactContent: { kind: tool, sourceId: source.id, state: tool === "imprima" ? "PREPARED_DRAFT" : "PREPARED_PROPOSAL",
        files: [{ id: randomUUID(), filename: "QA-output.md", objectKey: "not-exported" }], releaseAllowed: false },
    }).returning();
    const returned = await request(`/stage-support/departures/${departure.caseId}/return`, { resultId: saved!.id });
    expect(returned.status).toBe(200);
    const cases = await request(`/boomerang/cases?originKind=SESSION&originId=${session.id}&stage=F4`);
    const current = cases.data.find((row: { id: string }) => row.id === departure.caseId);
    expect(current.sourceChanged).toBe(false);
    const accepted = await request(`/boomerang/cases/${departure.caseId}/transition`, { action: "ACCEPT", expectedVersion: current.version });
    expect(accepted.status).toBe(200);
    expect(accepted.data.state).toBe("ACCEPTED");
    expect(accepted.data.releaseAllowed).toBe(false);
  });
  test("cartridge returns the saved package, not an invented source artifact", async () => {
    const { departure } = await setup("cartridge");
    const [saved] = await db.insert(cartridgePackagesTable).values({ userId: owner, projectName: "QA Cartridge",
      outcomeOneLiner: "Test source return", scopeStatement: "QA only", seedPrompt: "Saved cartridge revised context", summary: "QA summary" }).returning();
    const response = await request(`/stage-support/departures/${departure.caseId}/return`, { resultId: saved!.id });
    expect(response.status).toBe(200);
    const [artifact] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, response.data.returnedArtifactId));
    expect((artifact!.artifactContent as { resultText: string }).resultText).toContain("Saved cartridge revised context");
  });
  test("validates availability on the server, not only through disabled UI", async () => {
    const { session } = await setup("ingestion", 9, "CODE_BUNDLE");
    const response = await request("/stage-support/departures", { sessionId: session.id, featureId: 9, tool: "short-sprints" });
    expect(response.status).toBe(409);
    const options = await request(`/stage-support/options?sessionId=${session.id}&featureId=9`);
    expect(options.data.tools.find((tool: { tool: string }) => tool.tool === "short-sprints").active).toBe(false);
  });
});
