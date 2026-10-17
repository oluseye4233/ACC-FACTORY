import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable } from "@workspace/db";
import { artifactOutputHash, captureArtifactPersisted, listOwnedSessionTraces } from "../src/lib/command-deck-capture";
vi.mock("../src/lib/badges", () => ({ maybeAwardContextCraftBadges: vi.fn().mockResolvedValue(undefined) }));
import { persistArtifact } from "../src/engines/shared";

describe("durable private Command Deck capture", () => {
  let owner: string;
  let other: string;
  let sessionId: string;
  beforeAll(async () => {
    const users = await db.insert(usersTable).values([0, 1].map(() => ({
      clerkUserId: `trace-${randomUUID()}`, email: `trace-${randomUUID()}@example.test`,
    }))).returning();
    [owner, other] = users.map((u) => u.id);
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner }).returning();
    sessionId = session.id;
  });
  afterAll(async () => {
    if (owner && other) await db.delete(usersTable).where(inArray(usersTable.id, [owner, other]));
  });
  const input = () => ({
    sessionId, userId: owner, featureId: 2, artifactType: "ATOMIC_PROMPT" as const,
    artifactContent: { prompt: `PRIVATE ${randomUUID()}`, nested: { b: 2, a: 1 } },
  });
  it("persists the artifact and metadata together without content or corpus consent", async () => {
    const data = input();
    const artifact = await persistArtifact(data);
    const rows = await listOwnedSessionTraces(owner, sessionId);
    const trace = rows.find((r) => String(r.envelope.artifact_ref).startsWith(artifact.id));
    expect(trace).toBeDefined();
    expect(trace!.envelope).toMatchObject({
      trace_id: sessionId, stage: "F2", stream: "NONE", eligibility: "NOT_ELIGIBLE",
      eligibility_reason: "CORPUS_CAPTURE_DISABLED_PENDING_CONSENT_AND_ETHICS_GATE",
    });
    expect(JSON.stringify(trace!.envelope)).not.toContain(data.artifactContent.prompt);
    expect(JSON.stringify(trace!.envelope)).not.toContain(owner);
  });
  it("does not let a different owner read or attach to the session", async () => {
    expect(await listOwnedSessionTraces(other, sessionId)).toEqual([]);
    await expect(persistArtifact({ ...input(), userId: other })).rejects.toThrow(/owned session/);
    expect(await db.select().from(harnessArtifactsTable).where(
      and(eq(harnessArtifactsTable.userId, other), eq(harnessArtifactsTable.sessionId, sessionId)),
    )).toHaveLength(0);
  });
  it("deduplicates the same artifact event", async () => {
    const artifact = await persistArtifact(input());
    await db.transaction((tx) => captureArtifactPersisted(tx, artifact));
    const rows = await listOwnedSessionTraces(owner, sessionId);
    expect(rows.filter((r) => String(r.envelope.artifact_ref).startsWith(artifact.id))).toHaveLength(1);
  });
  it("rolls back the artifact when its capture fails", async () => {
    const name = `invalid-stage-${randomUUID()}`;
    await expect(persistArtifact({ ...input(), featureId: 999, name })).rejects.toThrow();
    expect(await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.name, name))).toHaveLength(0);
  });
  it("hashes semantically equal object key orders identically", () => {
    expect(artifactOutputHash({ a: 1, b: [2, 3] })).toBe(artifactOutputHash({ b: [2, 3], a: 1 }));
    expect(artifactOutputHash({ a: 1 })).not.toBe(artifactOutputHash({ a: 2 }));
  });
});
