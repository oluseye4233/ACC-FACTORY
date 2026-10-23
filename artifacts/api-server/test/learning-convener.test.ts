import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { beforeAll, afterAll, describe, test, expect, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db, usersTable, learningCohortsTable as cohorts, learningMembershipsTable as members,
  learningFollowupsTable as followups, learningMeetingsTable as meetings,
  learningResourcesTable as resources, learningMessagesTable as messages,
  learningDeliveriesTable as deliveries, learningAuditTable as audit,
  learningAssignmentsTable as assignments, learningSubmissionsTable as submissions,
  learningReviewsTable as reviews, exemplarLibraryItemsTable as exemplars,
} from "@workspace/db";
import { LEARNING_LESSONS } from "../src/lib/learning-curriculum";

const email = vi.hoisted(() => ({ configured: true, send: vi.fn() }));
vi.mock("@workspace/email", () => ({
  learningEmailConfigured: () => email.configured, sendLearningMessage: email.send,
}));
vi.mock("../src/lib/auth", () => ({
  requireAuth: async (req: any, res: any, next: any) => {
    const id = req.get("x-test-user");
    if (!id) return res.status(401).json({ error: "Unauthorized" });
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    req.localUser = u; next();
  },
}));
import router from "../src/routes/learning-convener";

describe("Cohort convener privacy, progress and communications", () => {
  const [owner, instructor, alice, bob, outsider] = Array.from({ length: 5 }, () => randomUUID()) as [string, string, string, string, string];
  const cohortId = randomUUID(), foreignCohort = randomUUID(), aliceId = randomUUID(), bobId = randomUUID(), foreignMember = randomUUID();
  let server: ReturnType<express.Express["listen"]>, base: string, ownSource: string, foreignSource: string;
  const path = (part = "convener", id = cohortId) => `/learn/cohorts/${id}/${part}`;
  async function call(url: string, data?: unknown, user: string | null = owner) {
    const r = await fetch(`${base}${url}`, {
      method: data === undefined ? "GET" : "POST",
      headers: { ...(user ? { "x-test-user": user } : {}), "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: r.status, body: await r.json() };
  }
  const followup = { membershipId: aliceId, title: "F1 revision plan", feedback: "Clarify the assumptions", actionPlan: "Rework with the example", state: "OPEN" };
  const meeting = {
    title: "Worked example review", agenda: "Review assumptions without awarding a credential",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    meetingUrl: "https://example.com/cohort-meeting", membershipIds: [aliceId], state: "SCHEDULED",
  };
  beforeAll(async () => {
    const userIds = [owner, instructor, alice, bob, outsider];
    await db.insert(usersTable).values(userIds.map(id => ({ id, clerkUserId: `test:convener:${id}`,
      email: `convener-${id}@example.test`, displayName: `Trainee ${id.slice(0, 4)}`, role: id === owner ? "ADMIN" : "USER" })));
    await db.insert(cohorts).values([cohortId, foreignCohort].map((id, i) => ({
      id, ownerId: i ? outsider : owner, title: "Isolated convener class", state: "ACTIVE",
      capacity: 20, budgetUsd: "10", studentBudgetUsd: "1", endsAt: new Date(Date.now() + 10 * 86400000),
    })));
    await db.insert(members).values([
      { id: aliceId, cohortId, userId: alice, role: "STUDENT" },
      { id: bobId, cohortId, userId: bob, role: "STUDENT" },
      { cohortId, userId: instructor, role: "INSTRUCTOR" },
      { id: foreignMember, cohortId: foreignCohort, userId: outsider, role: "STUDENT" },
    ]);
    const [source] = await db.insert(exemplars).values({ ownerUserId: owner, kind: "SPC", title: "Cohort example", tagline: "Private own reference", body: "Version one synthetic reference" }).returning();
    ownSource = source!.id;
    const [other] = await db.insert(exemplars).values({ ownerUserId: outsider, kind: "SPC", title: "Foreign example", tagline: "Must not share", body: "Foreign private reference" }).returning();
    foreignSource = other!.id;
    const l = LEARNING_LESSONS.find(l => l.required)!;
    const [a] = await db.insert(assignments).values({ membershipId: aliceId, lessonKey: l.key, state: "REVISION_REQUIRED" }).returning();
    const [s] = await db.insert(submissions).values({ assignmentId: a!.id, version: 1, mode: l.mode,
      text: "Submitted synthetic work", artifactIds: [], sourceHash: "test-unverified-source" }).returning();
    await db.insert(reviews).values({ submissionId: s!.id, reviewerId: owner, decision: "REVISION_REQUIRED", feedback: "Explain evidence versus inference." });
    email.send.mockResolvedValue({ ok: true, id: "provider-test-id" });
    const app = express(); app.use(express.json()); app.use(router);
    app.use((e: any, _req: any, res: any, _next: any) => res.status(500).json({ error: e.message }));
    server = app.listen(0); await new Promise<void>(resolve => server.on("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>(r => server.close(() => r()));
    const cs = [cohortId, foreignCohort];
    const ms = await db.select().from(messages).where(inArray(messages.cohortId, cs));
    if (ms.length) await db.delete(deliveries).where(inArray(deliveries.messageId, ms.map(m => m.id)));
    await db.delete(messages).where(inArray(messages.cohortId, cs));
    await db.delete(resources).where(inArray(resources.cohortId, cs));
    await db.delete(meetings).where(inArray(meetings.cohortId, cs));
    await db.delete(followups).where(inArray(followups.cohortId, cs));
    const aa = await db.select().from(assignments).where(eq(assignments.membershipId, aliceId));
    for (const a of aa) {
      const ss = await db.select().from(submissions).where(eq(submissions.assignmentId, a.id));
      if (ss.length) await db.delete(reviews).where(inArray(reviews.submissionId, ss.map(s => s.id)));
      await db.delete(submissions).where(eq(submissions.assignmentId, a.id));
    }
    await db.delete(assignments).where(eq(assignments.membershipId, aliceId));
    await db.delete(audit).where(inArray(audit.cohortId, cs));
    await db.delete(members).where(inArray(members.cohortId, cs));
    await db.delete(cohorts).where(inArray(cohorts.id, cs));
    await db.delete(exemplars).where(inArray(exemplars.ownerUserId, [owner, outsider]));
    await db.delete(usersTable).where(inArray(usersTable.id, [owner, instructor, alice, bob, outsider]));
  });

  test("only the owner and active assigned instructors can read teaching data", async () => {
    expect((await call(path(), undefined, null)).status).toBe(401);
    expect((await call(path(), undefined, alice)).status).toBe(404);
    expect((await call(path(), undefined, outsider)).status).toBe(404);
    expect((await call(path(), undefined, instructor)).status).toBe(200);
    expect((await call(path("convener", foreignCohort))).status).toBe(404);
    const d = (await call(path())).body;
    expect(d.learners).toHaveLength(2);
    const student = d.learners.find((l: any) => l.membershipId === aliceId);
    expect(student.revisions).toBe(1);
    expect(student.progressPercent).toBe(0);
    expect(student.recentFeedback).toContain("Explain evidence versus inference.");
    expect(student.recommendation).toMatch(/revision/i);
    expect(d.exemplarOptions.some((e: any) => e.id === ownSource)).toBe(true);
    expect(d.exemplarOptions.some((e: any) => e.id === foreignSource)).toBe(false);
  });
  test("followups persist, can be completed, and cannot cross cohort boundaries", async () => {
    expect((await call(path("followups"), { ...followup, membershipId: foreignMember })).status).toBe(404);
    expect((await call(path("followups"), followup, alice)).status).toBe(404);
    const created = await call(path("followups"), { ...followup, dueAt: new Date(Date.now() + 86400000).toISOString() }, instructor);
    expect(created.status).toBe(200);
    expect((await call(path("followups"), { ...followup, id: created.body.id, state: "COMPLETED", dueAt: null })).body.dueAt).toBeNull();
    const own = await call(`/learn/memberships/${aliceId}/support`, undefined, alice);
    expect(own.body.followups[0].state).toBe("COMPLETED");
    expect((await call(`/learn/memberships/${aliceId}/support`, undefined, bob)).status).toBe(404);
  });
  test("meetings validate dates/URL and audience, support updates and cancellation", async () => {
    expect((await call(path("meetings"), { ...meeting, endsAt: meeting.startsAt })).status).toBe(400);
    expect((await call(path("meetings"), { ...meeting, meetingUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await call(path("meetings"), { ...meeting, membershipIds: [foreignMember] })).status).toBe(404);
    const r = await call(path("meetings"), meeting);
    expect(r.status).toBe(200);
    const own = (await call(`/learn/memberships/${aliceId}/support`, undefined, alice)).body;
    expect(own.meetings[0].id).toBe(r.body.id);
    expect(own.meetings[0].membershipIds).toEqual([]);
    expect((await call(`/learn/memberships/${bobId}/support`, undefined, bob)).body.meetings).toHaveLength(0);
    const cancelled = await call(path("meetings"), { ...meeting, id: r.body.id, state: "CANCELLED", meetingUrl: null });
    expect(cancelled.body.state).toBe("CANCELLED");
    expect(cancelled.body.meetingUrl).toBeNull();
  });
  test("cohort library snapshots owned content without publishing/mutating originals", async () => {
    expect((await call(path("resources"), { action: "SHARE", sourceId: foreignSource })).status).toBe(404);
    const r = await call(path("resources"), { action: "SHARE", sourceId: ownSource, notes: "Start here" });
    expect(r.status).toBe(200);
    await db.update(exemplars).set({ body: "Version two synthetic reference" }).where(eq(exemplars.id, ownSource));
    const own = (await call(`/learn/memberships/${aliceId}/support`, undefined, alice)).body;
    expect(own.resources[0].body).toBe("Version one synthetic reference");
    const [source] = await db.select().from(exemplars).where(eq(exemplars.id, ownSource));
    expect(source!.artifactMode).toBe("LIBRARY_ARTIFACT");
    await call(path("resources"), { action: "ARCHIVE", id: r.body.id });
    expect((await call(`/learn/memberships/${aliceId}/support`, undefined, alice)).body.resources).toHaveLength(0);
  });
  test("email never claims dry-run delivery and repeated request IDs do not resend", async () => {
    const b = { requestId: randomUUID(), subject: "Cohort notice", body: "Please review the worked example.", membershipIds: [] };
    email.configured = false;
    expect((await call(path("messages"), b)).status).toBe(503);
    email.configured = true;
    expect((await call(path("messages"), { ...b, membershipIds: [foreignMember] })).status).toBe(404);
    const before = email.send.mock.calls.length;
    const first = await call(path("messages"), b);
    expect(first.status).toBe(200);
    expect(first.body.deliveries).toHaveLength(2);
    expect(first.body.deliveries.every((d: any) => d.state === "SENT")).toBe(true);
    expect(email.send.mock.calls.length - before).toBe(2);
    const replay = await call(path("messages"), b);
    expect(replay.body.id).toBe(first.body.id);
    expect(email.send.mock.calls.length - before).toBe(2);
    expect((await call(path("messages"), { ...b, requestId: randomUUID() })).status).toBe(429);
  });
  test("provider errors are failed recipient records, not success markers", async () => {
    await db.update(messages).set({ createdAt: new Date(Date.now() - 60000) }).where(eq(messages.cohortId, cohortId));
    email.send.mockResolvedValueOnce({ ok: false, error: "Rejected" });
    const r = await call(path("messages"), {
      requestId: randomUUID(), subject: "Targeted coaching", body: "Read your own follow-up plan.", membershipIds: [aliceId],
    });
    expect(r.status).toBe(200);
    expect(r.body.deliveries).toHaveLength(1);
    expect(r.body.deliveries[0].state).toBe("FAILED");
  });
  test("revocation and cohort closure retain records without granting new sharing rights", async () => {
    await db.update(members).set({ state: "REVOKED" }).where(eq(members.id, aliceId));
    const own = (await call(`/learn/memberships/${aliceId}/support`, undefined, alice)).body;
    expect(own.followups.length).toBeGreaterThan(0);
    expect(own.resources).toEqual([]);
    expect(own.meetings).toEqual([]);
    await db.update(cohorts).set({ state: "ARCHIVED" }).where(eq(cohorts.id, cohortId));
    expect((await call(path("followups"), followup)).status).toBe(409);
    expect((await call(path(), undefined, instructor)).status).toBe(404);
    expect((await call(path())).status).toBe(200);
  });
});
