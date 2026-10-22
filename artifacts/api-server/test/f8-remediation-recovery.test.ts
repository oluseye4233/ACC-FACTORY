import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { db, f8RemediationAttemptsTable, harnessSessionsTable, usersTable } from "@workspace/db";
import { lockRepairAttempt, openRepairAttempt, repairAttemptId, saveRepairAttempt } from "../src/lib/f8-remediation-attempts";
import { handleF8RemediationProgress } from "../src/engines/f8-remediation";

describe("durable F8 recovery and cross-instance dispatch lock", () => {
  let owner: string, other: string, session: string, key: string;
  beforeAll(async () => {
    const users = await db.insert(usersTable).values([1, 2].map(() => ({
      clerkUserId: `f8-recovery-${randomUUID()}`, email: `f8-recovery-${randomUUID()}@example.test`,
    }))).returning();
    owner = users[0]!.id; other = users[1]!.id;
    const [s] = await db.insert(harnessSessionsTable).values({ userId: owner, sessionName: "Recovery test" }).returning();
    session = s!.id; key = repairAttemptId(owner, session, randomUUID());
  });
  afterAll(async () => {
    if (!owner) return;
    await db.delete(f8RemediationAttemptsTable).where(eq(f8RemediationAttemptsTable.userId, owner));
    await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.userId, owner));
    await db.delete(usersTable).where(inArray(usersTable.id, [owner, other]));
  });
  it("only lets one database connection own a repair and releases cleanly", async () => {
    const first = await lockRepairAttempt(key);
    expect(first).not.toBeNull();
    try { expect(await lockRepairAttempt(key)).toBeNull(); }
    finally { await first?.(); }
    const next = await lockRepairAttempt(key);
    expect(next).not.toBeNull(); await next?.(); await next?.();
  });
  it("persists recovery across requests and rejects different owners or baselines", async () => {
    expect((await openRepairAttempt(key, owner, session, "baseline")).phase).toBe("READY");
    const reportArtifactId = randomUUID();
    await saveRepairAttempt(key, owner, "REPAIRED", { reportArtifactId, repair: { summary: "saved" } });
    expect(await openRepairAttempt(key, owner, session, "baseline")).toMatchObject({
      phase: "REPAIRED", data: { reportArtifactId, repair: { summary: "saved" } },
    });
    await expect(openRepairAttempt(key, owner, session, "changed")).rejects.toThrow(/changed/);
    await expect(openRepairAttempt(key, other, session, "baseline")).rejects.toThrow(/changed/);
    await expect(saveRepairAttempt(key, other, "COMPLETE", {})).rejects.toThrow(/could not/);
  });
  async function progress(userId: string | undefined, sessionId = session) {
    let status = 200, body: any;
    const res = { status: (code: number) => { status = code; return res; }, json: (v: unknown) => { body = v; } };
    await handleF8RemediationProgress({ query: { sessionId }, localUser: userId ? { id: userId } : undefined } as unknown as Request, res as unknown as Response);
    return { status, body };
  }
  it("returns saved progress only to the session owner, without model dispatch", async () => {
    const response = await progress(owner);
    expect(response.status).toBe(200);
    expect(response.body.attempt.phase).toBe("REPAIRED");
    expect(response.body.attempt.repair).toBeUndefined();
    expect(response.body.attempt.reportArtifactId).toBeTruthy();
    expect((await progress(other)).status).toBe(404);
    expect((await progress(undefined)).status).toBe(401);
    expect((await progress(owner, "invalid")).status).toBe(400);
  });
});
