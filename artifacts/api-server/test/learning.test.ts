import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { beforeAll, afterAll, describe, test, expect, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db, usersTable, learningCohortsTable as cohorts, learningMembershipsTable as members,
  learningInvitationsTable as invites, learningAssignmentsTable as assignments,
  learningSubmissionsTable as submissions, learningReviewsTable as reviews,
  learningAuditTable as audit, learningChargesTable as charges, harnessSessionsTable,
  harnessArtifactsTable, costBudgetReservationsTable,
} from "@workspace/db";
import { LEARNING_LESSONS } from "../src/lib/learning-curriculum";
import { learningCallContext, learningRouteAllowed } from "../src/lib/learning-access";
import { reserveCostBudget, releaseCostBudgetReservation } from "../src/lib/cost-budget";
import { computeBadgeProgress } from "../src/lib/badges";
import { hasForgeLifetimePractitioner } from "../src/lib/forge-lifetime";
import { evidenceHash } from "../src/lib/learning-service";

vi.mock("../src/lib/auth", async () => {
  const { db, usersTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return {
    requireAuth: async (req: any, res: any, next: any) => {
      if (!req.get("x-test-user")) return res.status(401).json({ error: "Unauthorized" });
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.get("x-test-user")));
      if (!u) return res.status(401).end();
      req.localUser = u; req.studentVerifiedEmail = u.role === "USER" ? u.email : undefined;
      next();
    },
    requireAdmin: (req: any, res: any, next: any) => req.localUser?.role === "ADMIN" ? next() : res.status(403).end(),
  };
});
import router from "../src/routes/learning";
describe("FORGE FIELD ENGINEER existing-Quest-compatible pilot", () => {
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [owner, alice, bob, otherOwner] = ids as [string, string, string, string];
  const emails = ids.map((id) => `learning-${id}@example.test`);
  let server: ReturnType<express.Express["listen"]>, base: string, cohortId: string, membershipId: string;
  let sessionId: string, artifactId: string;
  const call = async (path: string, data?: unknown, user: string | null = owner) => {
    const r = await fetch(`${base}${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: { ...(user ? { "x-test-user": user } : {}), "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const manage = (data: unknown, id = cohortId) => call(`/learn/cohorts/${id}/manage`, data);
  const invite = async (email: string, id = cohortId) => {
    const r = await manage({ action: "INVITE", email, role: "STUDENT" }, id);
    expect(r.status).toBe(200);
    return r.body.issuedInviteToken as string;
  };
  const submit = (lessonKey: string, version = 0, extra = {}) => call("/learn/attempts", {
    membershipId, lessonKey, action: "SUBMIT", expectedVersion: version,
    mode: LEARNING_LESSONS.find((l) => l.key === lessonKey)!.mode,
    text: "My source-grounded training reflection preserves the real gate and its limitations.",
    ...extra,
  }, alice);
  beforeAll(async () => {
    await db.insert(usersTable).values(ids.map((id, index) => ({
      id, clerkUserId: `test:${id}`, email: emails[index], displayName: `Learning test ${index}`,
      role: index === 0 || index === 3 ? "ADMIN" : "USER",
    })));
    [ { id: sessionId } ] = await db.insert(harnessSessionsTable).values({ userId: alice, sessionName: "Learning isolated source" }).returning();
    [ { id: artifactId } ] = await db.insert(harnessArtifactsTable).values({
      sessionId, userId: alice, featureId: 1, artifactType: "PROMPT_DIAGNOSTIC", artifactContent: { input: "Synthetic request" },
    }).returning();
    const app = express(); app.use(express.json()); app.use("/api", router);
    app.use((e: any, _req: any, res: any, _next: any) => res.status(500).json({ error: e.message }));
    server = app.listen(0); await new Promise<void>((resolve) => server.on("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const cs = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.ownerId, owner));
    const cids = cs.map((c) => c.id);
    const ms = cids.length ? await db.select().from(members).where(inArray(members.cohortId, cids)) : [];
    const mid = ms.map((m) => m.id);
    const aa = mid.length ? await db.select().from(assignments).where(inArray(assignments.membershipId, mid)) : [];
    const aid = aa.map((a) => a.id);
    const ss = aid.length ? await db.select().from(submissions).where(inArray(submissions.assignmentId, aid)) : [];
    if (ss.length) await db.delete(reviews).where(inArray(reviews.submissionId, ss.map((s) => s.id)));
    if (aid.length) { await db.delete(submissions).where(inArray(submissions.assignmentId, aid)); await db.delete(assignments).where(inArray(assignments.id, aid)); }
    if (cids.length) {
      const ch = await db.select().from(charges).where(inArray(charges.cohortId, cids));
      if (ch.length) await db.delete(costBudgetReservationsTable).where(inArray(costBudgetReservationsTable.id, ch.map((v) => v.reservationId)));
      await db.delete(charges).where(inArray(charges.cohortId, cids));
      await db.delete(audit).where(inArray(audit.cohortId, cids));
      await db.delete(invites).where(inArray(invites.cohortId, cids));
      await db.delete(members).where(inArray(members.cohortId, cids));
      await db.delete(cohorts).where(inArray(cohorts.id, cids));
    }
    await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, sessionId));
    await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, sessionId));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
  });
  test("only authenticated administrators create draft cohorts; no commercial subscription is required", async () => {
    expect((await call("/learn", undefined, null)).status).toBe(401);
    const input = { title: "Private learning pilot", capacity: 3, budgetUsd: 10, studentBudgetUsd: 2, endsAt: new Date(Date.now() + 86400000).toISOString() };
    expect((await call("/learn/cohorts", input, alice)).status).toBe(403);
    const r = await call("/learn/cohorts", input);
    expect(r.status).toBe(201); expect(r.body.state).toBe("DRAFT"); cohortId = r.body.id;
    expect((await manage({ action: "INVITE", email: emails[1] })).status).toBe(409);
    expect((await manage({ action: "STATE", state: "ACTIVE" })).status).toBe(200);
    expect((await call(`/learn/cohorts/${cohortId}`, undefined, otherOwner)).status).toBe(404);
  });
  test("invitations bind verified recipients, accept terms and are idempotent without leaking token hashes", async () => {
    const token = await invite(emails[1]!);
    expect(await hasForgeLifetimePractitioner(alice)).toBe(false);
    expect((await call("/learn/redeem", { token, acceptFreeTerms: true }, bob)).status).toBe(404);
    expect(await hasForgeLifetimePractitioner(alice)).toBe(false);
    expect((await call("/learn/redeem", { token, acceptFreeTerms: false }, alice)).status).toBe(400);
    const joined = await call("/learn/redeem", { token, acceptFreeTerms: true }, alice);
    expect(joined.status).toBe(200); membershipId = joined.body.id;
    expect((await call("/learn/redeem", { token, acceptFreeTerms: true }, alice)).body.id).toBe(membershipId);
    const home = await call("/learn", undefined, alice);
    expect(home.body).toMatchObject({ plan: "FORGE FIELD ENGINEER", price: 0, canCreateCohort: false });
    expect(home.body.lifetimePractitioner).toBe(false);
    expect(home.body.terms).toContain("Free-for-life Practitioner");
    expect(home.body.memberships).toHaveLength(1);
    const detail = await call(`/learn/cohorts/${cohortId}`);
    expect(JSON.stringify(detail.body)).not.toContain(token);
    expect(JSON.stringify(detail.body)).not.toContain("tokenHash");
  });
  test("revoked/expired invitations fail and concurrent final-seat redemption never oversells", async () => {
    const created = await call("/learn/cohorts", { title: "Capacity test", capacity: 1, budgetUsd: 0, studentBudgetUsd: 0, endsAt: new Date(Date.now() + 86400000).toISOString() });
    const id = created.body.id;
    await manage({ action: "STATE", state: "ACTIVE" }, id);
    const ta = await invite(emails[1]!, id), tb = await invite(emails[2]!, id);
    const results = await Promise.all([
      call("/learn/redeem", { token: ta, acceptFreeTerms: true }, alice),
      call("/learn/redeem", { token: tb, acceptFreeTerms: true }, bob),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const dead = await invite(emails[2]!);
    const [i] = await db.select().from(invites).where(eq(invites.cohortId, cohortId)).orderBy(invites.createdAt);
    await db.update(invites).set({ expiresAt: new Date(0) }).where(eq(invites.tokenHash, (await import("node:crypto")).createHash("sha256").update(dead).digest("hex")));
    expect((await call("/learn/redeem", { token: dead, acceptFreeTerms: true }, bob)).status).toBe(409);
    expect(i).toBeTruthy();
  });
  test("lesson progression is version fenced, reviewable and separate from Quest eligibility", async () => {
    const before = await computeBadgeProgress(alice);
    expect((await submit("f1")).status).toBe(409);
    const r = await submit("orientation");
    expect(r.status).toBe(200); expect(r.body.state).toBe("SUBMITTED");
    expect((await submit("orientation")).status).toBe(409);
    const s = r.body.submissions[0];
    const review = { submissionId: s.id, expectedVersion: r.body.version, decision: "REVISION_REQUIRED", feedback: "Please explain actual artifacts versus simulated evidence." };
    expect((await call("/learn/reviews", review, bob)).status).toBe(404);
    const revised = await call("/learn/reviews", review);
    expect(revised.status).toBe(200);
    const second = await submit("orientation", revised.body.version);
    expect(second.status).toBe(200);
    const approved = await call("/learn/reviews", { ...review, submissionId: second.body.submissions[0].id, expectedVersion: second.body.version, decision: "LEARNING_COMPLETE" });
    expect(approved.status).toBe(200);
    expect(approved.body.submissions).toHaveLength(2);
    const after = await computeBadgeProgress(alice);
    expect(after.map((b) => [b.badgeId, b.eligible, b.status])).toEqual(before.map((b) => [b.badgeId, b.eligible, b.status]));
    expect((await manage({ action: "COMPLETE", subjectId: membershipId })).status).toBe(409);
  });
  test("actual exercises require owned artifacts of the proper type; changed evidence cannot be accepted", async () => {
    expect((await submit("f1")).status).toBe(400);
    expect((await submit("f1", 0, { artifactIds: [randomUUID()] })).status).toBe(404);
    const r = await submit("f1", 0, { artifactIds: [artifactId] });
    expect(r.status).toBe(200);
    await db.update(harnessArtifactsTable).set({ artifactContent: { changed: true } }).where(eq(harnessArtifactsTable.id, artifactId));
    expect((await call("/learn/reviews", {
      submissionId: r.body.submissions[0].id, expectedVersion: r.body.version,
      decision: "LEARNING_COMPLETE", feedback: "This must not approve changed evidence.",
    })).status).toBe(409);
    const home = await call("/learn", undefined, alice);
    expect(home.body.assignments.find((a: any) => a.lessonKey === "f1").submissions[0].sourceChanged).toBe(true);
    expect((await call(`/learn/portfolio/${membershipId}`, undefined, bob)).status).toBe(404);
    expect((await call(`/learn/portfolio/${membershipId}`, undefined, alice)).status).toBe(200);
  });
  test("source-bound reservations respect funded cohort/student limits and release failures", async () => {
    const scope = { cohortId, membershipId, userId: alice };
    const first = await learningCallContext.run(scope, () => reserveCostBudget(1.2));
    expect(first.ok).toBe(true);
    const denied = await learningCallContext.run(scope, () => reserveCostBudget(1.2));
    expect(denied.ok).toBe(false);
    if (!first.ok) throw new Error("Expected training reservation");
    await db.update(charges).set({ expiresAt: new Date(0) }).where(eq(charges.reservationId, first.reservationId));
    // Timeout/worker loss is not evidence of zero provider charge.
    expect((await learningCallContext.run(scope, () => reserveCostBudget(1.2))).ok).toBe(false);
    await releaseCostBudgetReservation(first.reservationId);
    const released = await db.select().from(charges).where(eq(charges.reservationId, first.reservationId));
    expect(released[0]).toMatchObject({ state: "RELEASED", amountUsd: "0.000000" });
    await manage({ action: "MEMBERSHIP", subjectId: membershipId, state: "SUSPENDED" });
    expect((await submit("baseline")).status).toBe(403);
    expect((await learningCallContext.run(scope, () => reserveCostBudget(0.1))).ok).toBe(false);
    expect((await call(`/learn/portfolio/${membershipId}`, undefined, alice)).status).toBe(200);
    await manage({ action: "MEMBERSHIP", subjectId: membershipId, state: "ACTIVE" });
  });
  test("protected operations stay closed and every F gate has a truthful worked example", () => {
    for (const path of ["/admin/badges", "/billing/checkout", "/f10/releases", "/harness/f9", "/spc-player/runs/id/deliver"]) {
      expect(learningRouteAllowed("POST", path, true), path).toBe(false);
    }
    expect(learningRouteAllowed("POST", "/harness/f8", true)).toBe(true);
    expect(learningRouteAllowed("POST", "/harness/f8", false)).toBe(false);
    expect(learningRouteAllowed("POST", "/me/badges/aise/claim", false)).toBe(true);
    expect(learningRouteAllowed("POST", "/me/badges/engineer", false)).toBe(true);
    const stages = new Set(LEARNING_LESSONS.map((l) => l.stage));
    for (const stage of ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F6-VDJ", "MM", "F7", "F8", "F8-HDJ", "F9", "F9.5", "F10", "F11", "F12"]) expect(stages.has(stage)).toBe(true);
    expect(LEARNING_LESSONS.find((l) => l.stage === "F12")?.mode).toBe("SIMULATION");
  });
  test("requires completion AND issued certification, not acceptance or an unreviewed completion flag", async () => {
    expect(await hasForgeLifetimePractitioner(alice)).toBe(false);
    expect((await manage({ action: "CERTIFY", subjectId: membershipId })).status).toBe(409);
    await db.update(members).set({ state: "COMPLETED", completedAt: new Date() }).where(eq(members.id, membershipId));
    expect(await hasForgeLifetimePractitioner(alice)).toBe(false);
    expect((await manage({ action: "CERTIFY", subjectId: membershipId })).status).toBe(409);
    await db.update(members).set({ state: "ACTIVE", completedAt: null }).where(eq(members.id, membershipId));

    // Owned synthetic evidence and independent instructor reviews for each
    // required lesson; no LLM call and no grant/certificate row is seeded.
    for (const lesson of LEARNING_LESSONS.filter((l) => l.required)) {
      const previous = (await db.select().from(assignments).where(eq(assignments.membershipId, membershipId)))
        .find((a) => a.lessonKey === lesson.key);
      const version = (previous?.version ?? 0) + 1;
      const [a] = await db.insert(assignments).values({
        membershipId, lessonKey: lesson.key, state: "LEARNING_COMPLETE", version,
      }).onConflictDoUpdate({
        target: [assignments.membershipId, assignments.lessonKey],
        set: { state: "LEARNING_COMPLETE", version },
      }).returning();
      const rows = lesson.mode === "ACTUAL_PLATFORM" ? await db.insert(harnessArtifactsTable).values({
        sessionId, userId: alice, featureId: 1, artifactType: (lesson.artifactType || "PROMPT_DIAGNOSTIC") as any,
        artifactContent: { syntheticTrainingEvidence: lesson.key },
      }).returning() : [];
      const text = `Reviewed synthetic coursework evidence for ${lesson.key}.`;
      const [s] = await db.insert(submissions).values({
        assignmentId: a!.id, version, mode: lesson.mode, text, artifactIds: rows.map((r) => r.id),
        sourceHash: evidenceHash(text, lesson.mode, rows),
      }).returning();
      await db.insert(reviews).values({
        submissionId: s!.id, reviewerId: owner, decision: "LEARNING_COMPLETE",
        feedback: "Reviewed owned synthetic evidence for this required lesson.",
      });
    }
    expect((await manage({ action: "COMPLETE", subjectId: membershipId })).status).toBe(200);
    expect(await hasForgeLifetimePractitioner(alice)).toBe(false);
    expect((await call(`/learn/cohorts/${cohortId}/manage`, { action: "CERTIFY", subjectId: membershipId }, alice)).status).toBe(404);
    expect((await call(`/learn/cohorts/${cohortId}/manage`, { action: "CERTIFY", subjectId: membershipId }, otherOwner)).status).toBe(404);

    // Stale evidence must not be certified even after course completion.
    const actual = (await db.select().from(submissions).where(eq(submissions.assignmentId,
      (await db.select().from(assignments).where(eq(assignments.membershipId, membershipId))).find((a) => a.lessonKey === "f1")!.id)))
      .sort((a, b) => b.version - a.version)[0]!;
    const [bound] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, actual.artifactIds[0]!));
    await db.update(harnessArtifactsTable).set({ artifactContent: { stale: true } }).where(eq(harnessArtifactsTable.id, bound!.id));
    expect((await manage({ action: "CERTIFY", subjectId: membershipId })).status).toBe(409);
    expect(await hasForgeLifetimePractitioner(alice)).toBe(false);
    await db.update(harnessArtifactsTable).set({ artifactContent: bound!.artifactContent }).where(eq(harnessArtifactsTable.id, bound!.id));
    const issued = await manage({ action: "CERTIFY", subjectId: membershipId });
    expect(issued.status).toBe(200);
    const certificate = issued.body.memberships.find((m: any) => m.id === membershipId).certification;
    expect(certificate).toMatchObject({ title: "FORGE FIELD ENGINEER Certification", membershipId, issuedBy: owner });
    expect(await hasForgeLifetimePractitioner(alice)).toBe(true);
    const again = await manage({ action: "CERTIFY", subjectId: membershipId });
    expect(again.body.memberships.find((m: any) => m.id === membershipId).certification.id).toBe(certificate.id);
  });
  test("issued certification retains lifetime access after cohort expiry without awarding Quest badges", async () => {
    await db.update(cohorts).set({ state: "ARCHIVED", endsAt: new Date(0) }).where(eq(cohorts.id, cohortId));
    expect(await hasForgeLifetimePractitioner(alice)).toBe(true);
    expect(await hasForgeLifetimePractitioner(owner)).toBe(false);
    const home = await call("/learn", undefined, alice);
    expect(home.body.lifetimePractitioner).toBe(true);
    expect(home.body.memberships.find((m: any) => m.id === membershipId).certification).toBeTruthy();
  });
});
