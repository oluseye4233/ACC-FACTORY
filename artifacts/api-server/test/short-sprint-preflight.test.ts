import express from "express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable, type User } from "@workspace/db";
import { GetShortSprintPreflightResponse } from "@workspace/api-zod";
import { shortSprintPreflight } from "../src/lib/short-sprint-preflight";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAuth: auth }));
import sprintRouter from "../src/routes/short-sprints";

describe("owner-only, read-only SHORT SPRINTS preflight", () => {
  let owner: User; let other: User; let actingUser: User | null;
  let sessionId: string; let host: string;
  let server: ReturnType<express.Express["listen"]>;
  beforeAll(async () => {
    [owner, other] = await db.insert(usersTable).values([0, 1].map(() => ({
      clerkUserId: `sprint-${randomUUID()}`, email: `sprint-${randomUUID()}@example.test`,
    }))).returning();
    auth.mockImplementation((req, res, next) => {
      if (!actingUser) { res.status(401).json({ error: "Sign in required" }); return; }
      req.localUser = actingUser; next();
    });
    const app = express(); app.use("/api", sprintRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    host = `http://127.0.0.1:${address.port}/api/harness/sessions`;
  });
  beforeEach(async () => {
    actingUser = owner;
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner.id }).returning();
    sessionId = session.id;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (owner && other) await db.delete(usersTable).where(inArray(usersTable.id, [owner.id, other.id]));
  });
  const url = (query = "", id = sessionId) => `${host}/${id}/short-sprints/preflight${query}`;
  async function source(content: unknown, stage = 4, fields = {}) {
    const [artifact] = await db.insert(harnessArtifactsTable).values({
      sessionId, userId: owner.id, featureId: stage, artifactType: stage === 4 ? "MICRO_PDD" : "SPC",
      artifactContent: content, ...fields,
    }).returning();
    return artifact;
  }
  it("requires sign-in", async () => {
    actingUser = null;
    expect((await fetch(url())).status).toBe(401);
  });
  it("makes foreign and absent sessions indistinguishable", async () => {
    actingUser = other;
    const foreign = await fetch(url());
    const absent = await fetch(url("", randomUUID()));
    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
    expect(await foreign.json()).toEqual(await absent.json());
    await expect(shortSprintPreflight(other.id, sessionId, {})).rejects.toMatchObject({ status: 404 });
  });
  it("rejects invalid IDs, invalid options and owner-supplied facts", async () => {
    expect((await fetch(url("", "not-an-id"))).status).toBe(400);
    for (const query of ["?circuit=YES", "?target=OTHER", "?profile=UNRESTRICTED", "?sourceStageCertified=true", "?facts=PASS", "?artifactId=" + randomUUID()]) {
      expect((await fetch(url(query))).status).toBe(400);
    }
  });
  it("keeps a missing source inconclusive rather than substituting zero or a certified flag", async () => {
    const response = await fetch(url()); expect(response.status).toBe(200);
    const result = await response.json();
    expect(GetShortSprintPreflightResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBeNull();
    expect(result.assessment).toMatchObject({ state: "INCONCLUSIVE", releaseAllowed: false });
    expect(result.assessment.results.every((r: { status: string }) => r.status === "UNKNOWN")).toBe(true);
  });
  it("observes JSON presence but refuses legacy flags and model-supplied certification assertions", async () => {
    const artifact = await source({
      interfaceContract: '{"input":{},"output":{}}', privateText: "never-return-this-content",
      sourceStageCertified: true, buildElapsedMinutes: 0, openCriticalCount: 0,
    }, 4, { verificationStatus: "VERIFIED", forgeVerified: true, jcseScore: 50, certTier: "PLATINUM" });
    const result = await shortSprintPreflight(owner.id, sessionId, {});
    expect(GetShortSprintPreflightResponse.safeParse(result).success).toBe(true);
    expect(result.source?.id).toBe(artifact.id);
    expect(result.source?.certification).toBe("NOT_ESTABLISHED");
    expect(result.assessment.results.find((r) => r.id === "INTERFACE_CONTRACT")?.status).toBe("PASS");
    for (const id of ["SOURCE_STAGE_CERTIFIED", "NO_OPEN_CRITICAL", "BUILD_TIME_LIMIT"]) {
      expect(result.assessment.results.find((r) => r.id === id)?.status).toBe("UNKNOWN");
    }
    expect(result.assessment.state).toBe("INCONCLUSIVE");
    expect(JSON.stringify(result)).not.toContain("never-return-this-content");
    const [unchanged] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, artifact.id));
    expect(unchanged).toMatchObject({ verificationStatus: "VERIFIED", forgeVerified: true });
    expect(unchanged.artifactContent).toEqual(artifact.artifactContent);
    const again = await shortSprintPreflight(owner.id, sessionId, {});
    expect(again.evidenceHash).toBe(result.evidenceHash);
  });
  it("rejects prose as a JSON Interface Contract and gives a remedy", async () => {
    await source({ interfaceContract: "A paragraph is not a JSON contract." });
    const result = await shortSprintPreflight(owner.id, sessionId, {});
    expect(result.assessment.state).toBe("INELIGIBLE");
    expect(result.assessment.results.find((r) => r.id === "INTERFACE_CONTRACT")).toMatchObject({ status: "FAIL", remedy: expect.any(String) });
  });
  it("recognizes a single fenced JSON object without certifying its semantics", async () => {
    await source({ interfaceContract: '```json\n{"input":{},"output":{}}\n```' });
    const result = await shortSprintPreflight(owner.id, sessionId, {});
    expect(result.assessment.results.find((r) => r.id === "INTERFACE_CONTRACT")?.status).toBe("PASS");
    expect(result.assessment.releaseAllowed).toBe(false);
  });
  it("selects the latest source deterministically and ignores foreign rows even in the same session", async () => {
    const createdAt = new Date();
    const a = await source({ interfaceContract: '{"a":1}' }, 4, { createdAt });
    const b = await source({ interfaceContract: '{"b":1}' }, 4, { createdAt });
    await source({ private: "foreign-output" }, 4, { userId: other.id, createdAt: new Date(createdAt.getTime() + 1000) });
    const result = await shortSprintPreflight(owner.id, sessionId, {});
    expect(result.source?.id).toBe([a.id, b.id].sort().at(-1));
    expect(JSON.stringify(result)).not.toContain("foreign-output");
  });
  it("keeps firmware MECHA and regulated H/C requirements without pretending the selected profile added tracks", async () => {
    await source({ sections: [] }, 5);
    const response = await fetch(url("?circuit=SC_TWO&target=FIRMWARE&profile=REGULATED"));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.assessment.requiredPostStages).toEqual(["F9", "F9.5", "F10", "F11", "F12"]);
    expect(result.assessment.additionalRegulatedTracks).toEqual(["H", "C"]);
    expect(result.assessment.results.find((r: { id: string }) => r.id === "REGULATED_TRACKS").status).toBe("UNKNOWN");
    expect(result.assessment.results.find((r: { id: string }) => r.id === "TOOL_PERMISSIONS").status).toBe("UNKNOWN");
    expect(result.assessment.releaseAllowed).toBe(false);
  });
  it("binds both hashes to the current source rather than a stale stored contentHash", async () => {
    const artifact = await source({ sections: ["original"] }, 5, { contentHash: "a".repeat(64) });
    const options = { circuit: "SC_TWO" };
    const before = await shortSprintPreflight(owner.id, sessionId, options);
    await db.update(harnessArtifactsTable).set({ artifactContent: { sections: ["changed"] } }).where(eq(harnessArtifactsTable.id, artifact.id));
    const after = await shortSprintPreflight(owner.id, sessionId, options);
    expect(after.source?.hash).not.toBe(before.source?.hash);
    expect(after.assessment.eligibilityHash).not.toBe(before.assessment.eligibilityHash);
    expect(after.evidenceHash).not.toBe(before.evidenceHash);
  });
  it("does not transport or hash oversized source contents", async () => {
    const artifact = await source({ interfaceContract: "x".repeat(512_001) });
    const result = await shortSprintPreflight(owner.id, sessionId, {});
    expect(result.source).toMatchObject({ id: artifact.id, hash: null });
    expect(result.assessment.state).toBe("INCONCLUSIVE");
    expect(result.evidenceNotes.join(" ")).toContain("bounded source size");
  });
});
