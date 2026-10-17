import { and, eq, inArray, desc, sql } from "drizzle-orm";
import {
  db, learningCohortsTable as cohorts, learningMembershipsTable as members,
  learningAssignmentsTable as assignments, learningSubmissionsTable as submissions,
  learningReviewsTable as reviews, learningInvitationsTable as invites,
  learningAuditTable as audit, learningChargesTable as charges, usersTable,
  harnessArtifactsTable,
} from "@workspace/db";
import { boomerangHash } from "./boomerang";
import { CURRICULUM_VERSION, LEARNING_LESSONS } from "./learning-curriculum";

export type LearningReader = Pick<typeof db, "select">;
export class LearningError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function fail(status: number, message: string): never { throw new LearningError(status, message); }
export function cohortOpen(c: typeof cohorts.$inferSelect) {
  return c.state === "ACTIVE" && c.endsAt.getTime() > Date.now();
}
export function lessonsFor(track: string) {
  return LEARNING_LESSONS.filter((l) => track === "BOTH" || l.track === "BOTH" || l.track === track);
}
export async function teachingScope(reader: LearningReader, userId: string, cohortId: string) {
  const [c] = await reader.select().from(cohorts).where(eq(cohorts.id, cohortId));
  if (!c) return fail(404, "Cohort not found");
  if (c.ownerId === userId) return { cohort: c, isOwner: true };
  const [m] = await reader.select().from(members).where(and(
    eq(members.cohortId, cohortId), eq(members.userId, userId),
    eq(members.role, "INSTRUCTOR"), eq(members.state, "ACTIVE"),
  ));
  if (!m || !cohortOpen(c)) return fail(404, "Cohort not found");
  return { cohort: c, isOwner: false };
}
export async function ownedMembership(reader: LearningReader, userId: string, id: string, write = false) {
  const [m] = await reader.select().from(members).where(and(eq(members.id, id), eq(members.userId, userId)));
  if (!m) return fail(404, "Membership not found");
  const [c] = await reader.select().from(cohorts).where(eq(cohorts.id, m.cohortId));
  if (!c) return fail(404, "Cohort not found");
  if (write && (m.role !== "STUDENT" || m.state !== "ACTIVE" || !cohortOpen(c))) {
    return fail(403, "Learning actions require an active student membership and unexpired active cohort");
  }
  return { member: m, cohort: c };
}
export async function artifactSnapshot(reader: LearningReader, userId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await reader.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.userId, userId), inArray(harnessArtifactsTable.id, ids),
  ));
  if (rows.length !== new Set(ids).size) return fail(404, "An evidence artifact is unavailable or not owned by this student");
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}
export const evidenceHash = (text: string, mode: string, rows: unknown[]) => boomerangHash({ text, mode, rows });
export async function submissionChanged(reader: LearningReader, userId: string, s: typeof submissions.$inferSelect) {
  try {
    return evidenceHash(s.text, s.mode, await artifactSnapshot(reader, userId, s.artifactIds)) !== s.sourceHash;
  } catch (error) {
    if (error instanceof LearningError && error.status === 404) return true;
    throw error;
  }
}
export async function assignmentView(reader: LearningReader, a: typeof assignments.$inferSelect, userId: string) {
  const rows = await reader.select().from(submissions).where(eq(submissions.assignmentId, a.id)).orderBy(desc(submissions.version));
  return { ...a, submissions: await Promise.all(rows.map(async (s) => ({
    ...s, sourceChanged: await submissionChanged(reader, userId, s),
    reviews: await reader.select().from(reviews).where(eq(reviews.submissionId, s.id)),
  }))) };
}
export async function usage(reader: LearningReader, cohortId: string, userId?: string) {
  const [r] = await reader.select({
    spent: sql<string>`coalesce(sum(case when ${charges.state} = 'SETTLED' then ${charges.amountUsd} else 0 end),0)`,
    // A timeout does not prove a provider did not bill. Keep unfinalised
    // programme funds held until usage settles or a confirmed failure releases.
    reserved: sql<string>`coalesce(sum(case when ${charges.state} = 'RESERVED' then ${charges.amountUsd} else 0 end),0)`,
  }).from(charges).where(and(eq(charges.cohortId, cohortId), userId ? eq(charges.userId, userId) : undefined));
  return { spentUsd: Number(r?.spent ?? 0), reservedUsd: Number(r?.reserved ?? 0) };
}
export async function memberView(reader: LearningReader, m: typeof members.$inferSelect) {
  const [u] = await reader.select({ name: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, m.userId));
  return { ...m, name: u?.name || "Student", ...await usage(reader, m.cohortId, m.userId) };
}
async function cohortView(reader: LearningReader, c: typeof cohorts.$inferSelect) {
  return { ...c, budgetUsd: Number(c.budgetUsd), studentBudgetUsd: Number(c.studentBudgetUsd), ...await usage(reader, c.id) };
}
export async function homeView(userId: string, isAdmin: boolean, cohortId?: string, onlyMembershipId?: string) {
  const own = await db.select().from(members).where(and(eq(members.userId, userId), onlyMembershipId ? eq(members.id, onlyMembershipId) : undefined));
  let memberships = own;
  let cRows: (typeof cohorts.$inferSelect)[];
  let owner = false;
  if (cohortId) {
    const scope = await teachingScope(db, userId, cohortId);
    owner = scope.isOwner;
    cRows = [scope.cohort];
    memberships = await db.select().from(members).where(eq(members.cohortId, cohortId));
  } else {
    const visible = new Set(own.map((m) => m.cohortId));
    const owned = isAdmin && !onlyMembershipId ? await db.select().from(cohorts).where(eq(cohorts.ownerId, userId)) : [];
    for (const c of owned) visible.add(c.id);
    cRows = visible.size ? await db.select().from(cohorts).where(inArray(cohorts.id, [...visible])) : [];
  }
  const ids = memberships.map((m) => m.id);
  const aRows = ids.length ? await db.select().from(assignments).where(inArray(assignments.membershipId, ids)) : [];
  const userByMembership = new Map(memberships.map((m) => [m.id, m.userId]));
  const result = {
    plan: "FORGE FIELD ENGINEER", price: 0, curriculumVersion: CURRICULUM_VERSION,
    lessons: LEARNING_LESSONS,
    memberships: await Promise.all(memberships.map((m) => memberView(db, m))),
    cohorts: await Promise.all(cRows.map((c) => cohortView(db, c))),
    assignments: await Promise.all(aRows.map((a) => assignmentView(db, a, userByMembership.get(a.membershipId)!))),
    canCreateCohort: isAdmin,
    terms: "Free, invite-only training. No card, checkout or automatic paid conversion. Inference is programme-funded and bounded. Course assessment does not award, withhold or override existing Quest badges. Use synthetic data. Only explicitly submitted work is shared with assigned instructors.",
  };
  if (!cohortId) return result;
  return {
    ...result, isOwner: owner,
    invitations: owner ? (await db.select().from(invites).where(eq(invites.cohortId, cohortId))
      .orderBy(desc(invites.createdAt)).limit(500)).map(({ tokenHash: _hash, acceptedUserId: _user, ...i }) => ({
        ...i, state: i.state === "ISSUED" && i.expiresAt < new Date() ? "EXPIRED" : i.state,
      })) : [],
    audit: await db.select().from(audit).where(eq(audit.cohortId, cohortId)).orderBy(desc(audit.createdAt)).limit(100),
  };
}
