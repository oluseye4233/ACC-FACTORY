import { randomUUID } from "node:crypto";
import express from "express";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db, usersTable, harnessArtifactsTable, harnessSessionsTable } from "@workspace/db";
import { inspectGovernance } from "../src/lib/artifact-governance";

vi.mock("../src/lib/auth", async original => ({
  ...await original<typeof import("../src/lib/auth")>(),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.headers["x-test-owner"];
    if (typeof id !== "string") { res.status(401).json({ error: "Authentication required" }); return; }
    req.localUser = { id } as typeof req.localUser;
    next();
  },
}));
import router from "../src/routes/artifact-governance";
describe("owner-scoped, non-destructive governed revisions", () => {
  let server: ReturnType<express.Express["listen"]>, url: string, owner: string, other: string, sessionId: string, sourceId: string, revisedId: string;
  const original = { mission: "Legacy fixture", note: "Retain these exact values", gro: "GREY" };
  beforeAll(async () => {
    const rows = await db.insert(usersTable).values([0, 1].map(i => ({
      clerkUserId: `governance-${i}-${randomUUID()}`, email: `governance-${randomUUID()}@example.test`,
    }))).returning();
    [owner, other] = rows.map(r => r.id);
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner, sessionName: "Governance fixture" }).returning();
    sessionId = session!.id;
    const [source] = await db.insert(harnessArtifactsTable).values({
      sessionId, userId: owner, featureId: 3, artifactType: "MA_BIRTH_PACKAGE", artifactContent: original,
      forgeVerified: false, verificationStatus: "UNVERIFIED",
    }).returning();
    sourceId = source!.id;
    const app = express(); app.use(express.json()); app.use(router);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    url = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    if (sourceId) {
      await db.delete(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.parentArtifactId, sourceId), eq(harnessArtifactsTable.userId, owner)));
      await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, sourceId));
    }
    for (const id of [owner, other]) if (id) await db.delete(usersTable).where(eq(usersTable.id, id));
  });
  const request = (id: string, user?: string, body?: unknown) => fetch(`${url}/harness/artifacts/${id}/governance`, {
    method: body ? "POST" : "GET",
    headers: { ...(user ? { "x-test-owner": user } : {}), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  it("requires authentication and hides foreign artifacts for both reads and writes", async () => {
    expect((await request(sourceId)).status).toBe(401);
    expect((await request(sourceId, other)).status).toBe(404);
    expect((await request(sourceId, other, { confirmCreateRevision: true })).status).toBe(404);
  });
  it("identifies legacy criteria without treating a GRO label as installation", async () => {
    const response = await request(sourceId, owner);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ installed: false, status: "LEGACY_UNVERIFIED", assessment: "NOT_EVALUATED" });
  });
  it("requires explicit confirmation and valid identifiers", async () => {
    expect((await request(sourceId, owner, {})).status).toBe(400);
    expect((await request("not-a-uuid", owner)).status).toBe(400);
  });
  it("creates a linked private revision while preserving old bytes and withholding all approval flags", async () => {
    const response = await request(sourceId, owner, { confirmCreateRevision: true });
    expect(response.status).toBe(201);
    const result = await response.json() as { artifactId: string; installed: boolean; status: string };
    revisedId = result.artifactId;
    expect(revisedId).not.toBe(sourceId);
    expect(result).toMatchObject({ installed: true, status: "REVIEW_REQUIRED" });
    const [old] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, sourceId));
    const [revised] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, revisedId));
    expect(old!.artifactContent).toEqual(original);
    expect(revised).toMatchObject({ parentArtifactId: sourceId, userId: owner, sessionId, forgeVerified: false,
      verificationStatus: "UNVERIFIED", spartanCert: null, certTier: null, groState: "GREY" });
    expect(inspectGovernance(revised!.artifactContent).installed).toBe(true);
    expect(revised!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("returns an already governed revision without rewriting it", async () => {
    const response = await request(revisedId, owner, { confirmCreateRevision: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("artifactId", revisedId);
  });
});
