import express from "express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, usersTable, harnessSessionsTable, harnessArtifactsTable,
  commandDeckTracesTable, vteVerificationFailuresTable, type User,
} from "@workspace/db";
import { artifactOutputHash } from "../src/lib/command-deck-capture";
import { registerEvalset, runVerification, verificationWorkspace } from "../src/lib/xvl-verification";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAuth: auth }));
import verificationRouter from "../src/routes/xvl-verification";

describe("owner-only durable XVL and VTE failure intake", () => {
  let owner: User; let other: User; let sessionId: string;
  let actingUser: User | null;
  let server: ReturnType<express.Express["listen"]>; let base: string;
  beforeAll(async () => {
    [owner, other] = await db.insert(usersTable).values([0, 1].map(() => ({
      clerkUserId: `xvl-${randomUUID()}`, email: `xvl-${randomUUID()}@example.test`,
    }))).returning();
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner.id }).returning();
    sessionId = session.id;
    auth.mockImplementation((req, res, next) => {
      if (!actingUser) { res.status(401).json({ error: "Sign in required" }); return; }
      req.localUser = actingUser; next();
    });
    const app = express(); app.use(express.json()); app.use("/api", verificationRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    base = `http://127.0.0.1:${address.port}/api/harness/sessions/${sessionId}/verification`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (owner && other) await db.delete(usersTable).where(inArray(usersTable.id, [owner.id, other.id]));
  });
  async function fixture(text: string, expected = text) {
    const contract = await registerEvalset(owner.id, sessionId, {
      stage: "F2", title: "Immutable acceptance contract",
      rules: [{ path: "/text", operator: "equals", expected }],
    });
    const [artifact] = await db.insert(harnessArtifactsTable).values({
      sessionId, userId: owner.id, featureId: 2, artifactType: "ATOMIC_PROMPT",
      artifactContent: { text }, createdAt: new Date(new Date(contract.registeredAt).getTime() + 1000),
    }).returning();
    return { contract, artifact };
  }
  it("computes hash-bound I2 evidence on the server and leaves existing artifact gates unchanged", async () => {
    const { contract, artifact } = await fixture(`private-${randomUUID()}`);
    const run = await runVerification(owner.id, sessionId, artifact.id, contract.id);
    expect(run).toMatchObject({ outcome: "PASS", independence: "I2", track: "E" });
    expect(run.evidenceHash).toBe(artifactOutputHash(run.evidence));
    expect(JSON.stringify(run.evidence)).not.toContain((artifact.artifactContent as { text: string }).text);
    const [unchanged] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, artifact.id));
    expect(unchanged.verificationStatus).toBe("UNVERIFIED");
    expect(unchanged.forgeVerified).toBe(false);
  });
  it("enforces pre-registration and matching stages rather than retrofitting tests to old artifacts", async () => {
    const { contract, artifact } = await fixture("pass");
    await db.update(harnessArtifactsTable).set({ createdAt: new Date(new Date(contract.registeredAt).getTime() - 1000) })
      .where(eq(harnessArtifactsTable.id, artifact.id));
    await expect(runVerification(owner.id, sessionId, artifact.id, contract.id)).rejects.toMatchObject({ status: 409 });
    await db.update(harnessArtifactsTable).set({ featureId: 3 }).where(eq(harnessArtifactsTable.id, artifact.id));
    await expect(runVerification(owner.id, sessionId, artifact.id, contract.id)).rejects.toThrow(/same stage/);
  });
  it("deduplicates concurrent retries and atomically records metadata-only failure and Stream E events", async () => {
    const { contract, artifact } = await fixture(`private-failed-${randomUUID()}`, "different requirement");
    const [a, b] = await Promise.all([0, 1].map(() => runVerification(owner.id, sessionId, artifact.id, contract.id)));
    expect(a.id).toBe(b.id); expect(a.outcome).toBe("FAIL");
    const failures = await db.select().from(vteVerificationFailuresTable).where(eq(vteVerificationFailuresTable.runId, a.id));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ state: "OPEN", rejectedOutputOrigin: "none" });
    const traces = await db.select().from(commandDeckTracesTable).where(and(
      eq(commandDeckTracesTable.sessionId, sessionId), eq(commandDeckTracesTable.ownerUserId, owner.id),
    ));
    const attached = traces.filter((r) => r.envelope.payload_hash === a.evidenceHash);
    expect(attached).toHaveLength(2);
    expect(attached.map((r) => r.envelope.event_type).sort()).toEqual(["failure_case_opened", "xvl_verdict"]);
    expect(attached.every((r) => r.envelope.stream === "E" && r.envelope.eligibility === "NOT_ELIGIBLE")).toBe(true);
    expect(JSON.stringify(attached)).not.toContain("private-failed");
  });
  it("never reuses an old PASS after artifact content changes", async () => {
    const { contract, artifact } = await fixture("original");
    await runVerification(owner.id, sessionId, artifact.id, contract.id);
    await db.update(harnessArtifactsTable).set({ artifactContent: { text: "changed" } }).where(eq(harnessArtifactsTable.id, artifact.id));
    await expect(runVerification(owner.id, sessionId, artifact.id, contract.id)).rejects.toThrow(/no longer matches/);
  });
  it("returns inconclusive evidence and an open failure for bounded-adapter refusal", async () => {
    const { contract, artifact } = await fixture("x".repeat(512001), "never");
    const run = await runVerification(owner.id, sessionId, artifact.id, contract.id);
    expect(run.outcome).toBe("INCONCLUSIVE");
    const workspace = await verificationWorkspace(owner.id, sessionId);
    expect(workspace.failureCases.some((f) => f.runId === run.id)).toBe(true);
  });
  it("denies another owner and does not expose their contracts, artifacts or evidence", async () => {
    const { contract, artifact } = await fixture("private");
    await expect(verificationWorkspace(other.id, sessionId)).rejects.toMatchObject({ status: 404 });
    await expect(registerEvalset(other.id, sessionId, { stage: "F2", title: "no", rules: [{ path: "", operator: "exists" }] }))
      .rejects.toMatchObject({ status: 404 });
    await expect(runVerification(other.id, sessionId, artifact.id, contract.id)).rejects.toMatchObject({ status: 404 });
  });
  it("guards the HTTP surface and rejects client-supplied verdicts and malformed contracts", async () => {
    actingUser = null;
    expect((await fetch(base)).status).toBe(401);
    actingUser = other;
    expect((await fetch(base)).status).toBe(404);
    actingUser = owner;
    const response = await fetch(`${base}/runs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactId: randomUUID(), evalsetId: randomUUID(), outcome: "PASS", independence: "I3" }),
    });
    expect(response.status).toBe(400);
    const invalid = await fetch(`${base}/evalsets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "F2", title: "Bad", rules: [{ path: "/a", operator: "equals" }] }),
    });
    expect(invalid.status).toBe(400);
    expect((await fetch(base)).status).toBe(200);
  });
});
