import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, learningCohortsTable as cohorts, learningMembershipsTable as members,
  learningInvitationsTable as invites, learningAssignmentsTable as assignments,
  learningSubmissionsTable as submissions, learningReviewsTable as reviews,
  learningAuditTable as audit,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import { LEARNING_LESSONS, CURRICULUM_VERSION } from "../lib/learning-curriculum";
import {
  fail, LearningError, homeView, teachingScope, cohortOpen, ownedMembership,
  artifactSnapshot, evidenceHash, assignmentView, submissionChanged, memberView, lessonsFor,
} from "../lib/learning-service";

const router = Router();
const uuid = z.string().uuid();
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const wrap = (fn: (req: any, res: any) => Promise<void>) => async (req: any, res: any, next: any) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof LearningError) res.status(e.status).json({ error: e.message });
    else if (e instanceof z.ZodError) res.status(400).json({ error: "Invalid learning request", details: e.flatten() });
    else next(e);
  }
};
router.get("/learn", requireAuth, wrap(async (req, res) => {
  res.json(await homeView(req.localUser.id, req.localUser.role === "ADMIN"));
}));
const CohortInput = z.object({
  title: z.string().trim().min(3).max(160), capacity: z.number().int().min(1).max(500),
  budgetUsd: z.number().min(0).max(100000), studentBudgetUsd: z.number().min(0).max(1000),
  endsAt: z.iso.datetime(),
}).strict();
router.post("/learn/cohorts", requireAuth, requireAdmin, wrap(async (req, res) => {
  const b = CohortInput.parse(req.body);
  if (new Date(b.endsAt) <= new Date()) fail(400, "Cohort end date must be in the future");
  const [c] = await db.insert(cohorts).values({
    ...b, ownerId: req.localUser.id, endsAt: new Date(b.endsAt),
    budgetUsd: String(b.budgetUsd), studentBudgetUsd: String(b.studentBudgetUsd),
  }).returning();
  await db.insert(audit).values({ cohortId: c!.id, actorId: req.localUser.id, action: "COHORT_CREATED", subjectId: c!.id });
  res.status(201).json({ ...c, budgetUsd: b.budgetUsd, studentBudgetUsd: b.studentBudgetUsd, spentUsd: 0, reservedUsd: 0 });
}));
router.get("/learn/cohorts/:id", requireAuth, wrap(async (req, res) => {
  res.json(await homeView(req.localUser.id, req.localUser.role === "ADMIN", uuid.parse(req.params.id)));
}));
const Manage = z.object({
  action: z.enum(["STATE", "INVITE", "REVOKE_INVITE", "MEMBERSHIP", "COMPLETE"]),
  state: z.string().optional(), email: z.email().max(320).optional(),
  role: z.enum(["STUDENT", "INSTRUCTOR"]).optional(), subjectId: uuid.optional(),
  track: z.enum(["BOTH", "ARCHITECT", "ENGINEER"]).optional(),
}).strict();
const transitions: Record<string, string[]> = {
  DRAFT: ["INVITING", "ACTIVE", "ARCHIVED"], INVITING: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "COMPLETED"], SUSPENDED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"], ARCHIVED: [],
};
router.post("/learn/cohorts/:id/manage", requireAuth, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id); const b = Manage.parse(req.body);
  const { isOwner } = await teachingScope(db, req.localUser.id, id);
  if (!isOwner) fail(403, "Only the cohort owner can manage admission and membership");
  let issuedInviteToken: string | undefined;
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(cohorts).where(eq(cohorts.id, id)).for("update");
    if (!c || c.ownerId !== req.localUser.id) fail(404, "Cohort not found");
    let subjectId = id;
    if (b.action === "STATE") {
      if (!b.state || !transitions[c.state]?.includes(b.state)) fail(409, "Invalid cohort state transition");
      if (b.state === "ACTIVE" && c.endsAt <= new Date()) fail(409, "An expired cohort cannot be activated");
      await tx.update(cohorts).set({ state: b.state }).where(eq(cohorts.id, id));
    } else if (b.action === "INVITE") {
      if (!b.email || !["INVITING", "ACTIVE"].includes(c.state) || c.endsAt <= new Date()) fail(409, "Open an unexpired cohort for invitations first");
      issuedInviteToken = randomBytes(32).toString("base64url");
      const [i] = await tx.insert(invites).values({
        cohortId: id, email: b.email.toLowerCase().trim(), role: b.role || "STUDENT",
        tokenHash: tokenHash(issuedInviteToken), expiresAt: new Date(Math.min(Date.now() + 7 * 86400000, c.endsAt.getTime())),
      }).returning({ id: invites.id });
      subjectId = i!.id;
    } else if (b.action === "REVOKE_INVITE") {
      if (!b.subjectId) fail(400, "Invitation ID required");
      const [i] = await tx.update(invites).set({ state: "REVOKED" }).where(and(
        eq(invites.id, b.subjectId), eq(invites.cohortId, id), eq(invites.state, "ISSUED"),
      )).returning();
      if (!i) fail(409, "Invitation is not revocable");
      subjectId = i.id;
    } else {
      if (!b.subjectId) fail(400, "Membership ID required");
      const [m] = await tx.select().from(members).where(and(eq(members.id, b.subjectId), eq(members.cohortId, id))).for("update");
      if (!m) fail(404, "Membership not found");
      subjectId = m.id;
      if (b.action === "COMPLETE") {
        if (m.role !== "STUDENT" || m.state !== "ACTIVE" || !cohortOpen(c)) fail(409, "Completion requires an active student in an active cohort");
        const a = await tx.select().from(assignments).where(eq(assignments.membershipId, m.id));
        for (const lesson of lessonsFor(m.track).filter((l) => l.required)) {
          const attempt = a.find((item) => item.lessonKey === lesson.key);
          if (!attempt || attempt.state !== "LEARNING_COMPLETE") fail(409, `Learning review still required: ${lesson.title}`);
          const [s] = await tx.select().from(submissions).where(eq(submissions.assignmentId, attempt.id)).orderBy(desc(submissions.version)).limit(1);
          if (!s || await submissionChanged(tx, m.userId, s)) fail(409, `Evidence changed: ${lesson.title}`);
        }
        await tx.update(members).set({ state: "COMPLETED", completedAt: new Date() }).where(eq(members.id, m.id));
      } else {
        if (!["ACTIVE", "SUSPENDED", "REVOKED"].includes(b.state || "")) fail(400, "Valid membership state required");
        if (m.state === "REVOKED" || m.state === "COMPLETED" || c.state === "ARCHIVED") fail(409, "Terminal membership/cohort is read-only");
        await tx.update(members).set({ state: b.state, ...(b.track ? { track: b.track } : {}) }).where(eq(members.id, m.id));
      }
    }
    await tx.insert(audit).values({ cohortId: id, actorId: req.localUser.id, action: b.action + (b.state ? `:${b.state}` : ""), subjectId });
  });
  res.json({ ...await homeView(req.localUser.id, true, id), ...(issuedInviteToken ? { issuedInviteToken } : {}) });
}));
router.post("/learn/redeem", requireAuth, wrap(async (req, res) => {
  const b = z.object({ token: z.string().min(40).max(200), acceptFreeTerms: z.literal(true) }).strict().parse(req.body);
  // Only the Clerk bridge supplies a verified, individually authenticated email.
  if (!req.studentVerifiedEmail) fail(403, "Sign in with an individually verified student identity");
  const m = await db.transaction(async (tx) => {
    const [peek] = await tx.select().from(invites).where(eq(invites.tokenHash, tokenHash(b.token)));
    if (!peek) return fail(404, "Invitation unavailable");
    // Cohort-first lock order is shared by management and all redemption workers.
    const [c] = await tx.select().from(cohorts).where(eq(cohorts.id, peek.cohortId)).for("update");
    const [i] = await tx.select().from(invites).where(eq(invites.id, peek.id)).for("update");
    if (!c || !i || i.email !== req.studentVerifiedEmail.toLowerCase()) return fail(404, "Invitation unavailable");
    if (i.state === "ACCEPTED" && i.acceptedUserId === req.localUser.id) {
      const [existing] = await tx.select().from(members).where(and(eq(members.cohortId, c.id), eq(members.userId, req.localUser.id)));
      return existing!;
    }
    if (i.state !== "ISSUED" || i.expiresAt <= new Date() || !["INVITING", "ACTIVE"].includes(c.state) || c.endsAt <= new Date()) fail(409, "Invitation expired, revoked or cohort closed");
    const existing = await tx.select().from(members).where(eq(members.cohortId, c.id));
    if (existing.some((v) => v.userId === req.localUser.id)) fail(409, "A membership already exists; ask the owner to manage it");
    if (existing.filter((v) => v.state !== "REVOKED").length >= c.capacity) fail(409, "Cohort is full");
    const [created] = await tx.insert(members).values({ cohortId: c.id, userId: req.localUser.id, role: i.role }).returning();
    await tx.update(invites).set({ state: "ACCEPTED", acceptedUserId: req.localUser.id }).where(eq(invites.id, i.id));
    await tx.insert(audit).values({ cohortId: c.id, actorId: req.localUser.id, action: "INVITATION_ACCEPTED", subjectId: created!.id });
    return created!;
  });
  res.json(await memberView(db, m));
}));
const Attempt = z.object({
  membershipId: uuid, lessonKey: z.string().max(80), action: z.enum(["START", "SUBMIT"]),
  expectedVersion: z.number().int().min(0), mode: z.enum(["ACTUAL_PLATFORM", "SIMULATION", "REFLECTION"]).optional(),
  text: z.string().trim().max(12000).optional(), artifactIds: z.array(uuid).max(12).optional(),
}).strict();
router.post("/learn/attempts", requireAuth, wrap(async (req, res) => {
  const b = Attempt.parse(req.body);
  const a = await db.transaction(async (tx) => {
    const peek = await ownedMembership(tx, req.localUser.id, b.membershipId, true);
    await tx.select().from(cohorts).where(eq(cohorts.id, peek.cohort.id)).for("update");
    await tx.select().from(members).where(eq(members.id, peek.member.id)).for("update");
    // Share management's lock order; suspension, track changes and completion serialize.
    const { member: m } = await ownedMembership(tx, req.localUser.id, b.membershipId, true);
    const lesson = lessonsFor(m.track).find((l) => l.key === b.lessonKey);
    if (!lesson) return fail(404, "Lesson not assigned");
    if (lesson.key !== "orientation") {
      const [orientation] = await tx.select().from(assignments).where(and(eq(assignments.membershipId, m.id), eq(assignments.lessonKey, "orientation")));
      if (!orientation || !["SUBMITTED", "LEARNING_COMPLETE"].includes(orientation.state)) fail(409, "Submit your orientation before starting other lessons");
    }
    let [a] = await tx.select().from(assignments).where(and(eq(assignments.membershipId, m.id), eq(assignments.lessonKey, b.lessonKey))).for("update");
    if ((a?.version || 0) !== b.expectedVersion) fail(409, "Lesson changed; refresh before continuing");
    if (a?.state === "SUBMITTED") fail(409, "This submission is awaiting instructor review");
    if (b.action === "START") {
      if (!a) [a] = await tx.insert(assignments).values({ membershipId: m.id, lessonKey: lesson.key }).returning();
      return a!;
    }
    if (!b.text || b.text.length < 20 || b.mode !== lesson.mode) fail(400, "Submit at least 20 characters using the lesson's declared evidence mode");
    const ids = [...new Set(b.artifactIds || [])];
    const evidence = await artifactSnapshot(tx, m.userId, ids);
    if (lesson.mode === "ACTUAL_PLATFORM" && lesson.artifactType &&
      !evidence.some((r) => r.artifactType === lesson.artifactType)) fail(400, `Attach your own ${lesson.artifactType} artifact from the normal engine flow`);
    if (!a) [a] = await tx.insert(assignments).values({ membershipId: m.id, lessonKey: lesson.key }).returning();
    const version = a!.version + 1;
    await tx.insert(submissions).values({
      assignmentId: a!.id, version, mode: b.mode, text: b.text, artifactIds: ids,
      sourceHash: evidenceHash(b.text, b.mode, evidence),
    });
    const [updated] = await tx.update(assignments).set({ state: "SUBMITTED", version }).where(eq(assignments.id, a!.id)).returning();
    return updated!;
  });
  res.json(await assignmentView(db, a, req.localUser.id));
}));
router.post("/learn/reviews", requireAuth, wrap(async (req, res) => {
  const b = z.object({
    submissionId: uuid, expectedVersion: z.number().int().min(1),
    decision: z.enum(["LEARNING_COMPLETE", "REVISION_REQUIRED"]), feedback: z.string().trim().min(10).max(4000),
  }).strict().parse(req.body);
  const { a, userId } = await db.transaction(async (tx) => {
    const [s] = await tx.select().from(submissions).where(eq(submissions.id, b.submissionId));
    if (!s) return fail(404, "Submission not found");
    const [peekA] = await tx.select().from(assignments).where(eq(assignments.id, s.assignmentId));
    if (!peekA) return fail(404, "Assignment not found");
    const [peekM] = await tx.select().from(members).where(eq(members.id, peekA.membershipId));
    if (!peekM) return fail(404, "Membership not found");
    await teachingScope(tx, req.localUser.id, peekM.cohortId);
    await tx.select().from(cohorts).where(eq(cohorts.id, peekM.cohortId)).for("update");
    await tx.select().from(members).where(eq(members.id, peekM.id)).for("update");
    const [a] = await tx.select().from(assignments).where(eq(assignments.id, s.assignmentId)).for("update");
    const [m] = await tx.select().from(members).where(eq(members.id, a!.membershipId));
    const { cohort } = await teachingScope(tx, req.localUser.id, m!.cohortId);
    if (!cohortOpen(cohort) || m!.state !== "ACTIVE") fail(403, "Reviews require an active cohort and student");
    if (req.localUser.id === m!.userId) fail(403, "Self-review is not allowed");
    if (a!.state !== "SUBMITTED" || a!.version !== b.expectedVersion || s.version !== a!.version) fail(409, "Stale or already reviewed submission");
    if (b.decision === "LEARNING_COMPLETE" && await submissionChanged(tx, m!.userId, s)) fail(409, "Evidence changed; request a revised submission");
    await tx.insert(reviews).values({ submissionId: s.id, reviewerId: req.localUser.id, decision: b.decision, feedback: b.feedback });
    const [updated] = await tx.update(assignments).set({ state: b.decision, version: a!.version + 1 }).where(eq(assignments.id, a!.id)).returning();
    await tx.insert(audit).values({ cohortId: cohort.id, actorId: req.localUser.id, action: b.decision, subjectId: s.id });
    return { a: updated!, userId: m!.userId };
  });
  res.json(await assignmentView(db, a, userId));
}));
router.get("/learn/portfolio/:id", requireAuth, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id);
  await ownedMembership(db, req.localUser.id, id);
  res.json(await homeView(req.localUser.id, false, undefined, id));
}));
export default router;
