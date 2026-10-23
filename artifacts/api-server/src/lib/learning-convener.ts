import { and, eq, desc, inArray } from "drizzle-orm";
import {
  db, learningMembershipsTable as members, learningFollowupsTable as followups,
  learningMeetingsTable as meetings, learningResourcesTable as resources,
  learningMessagesTable as messages, learningDeliveriesTable as deliveries,
  exemplarLibraryItemsTable as exemplars,
} from "@workspace/db";
import { learningEmailConfigured } from "@workspace/email";
import { getExemplar, listExemplars } from "../data/exemplars";
import { homeView, lessonsFor, ownedMembership } from "./learning-service";

export async function messageView(id: string) {
  const [message] = await db.select().from(messages).where(eq(messages.id, id));
  return {
    ...message,
    deliveries: (await db.select().from(deliveries).where(eq(deliveries.messageId, id)))
      .map(({ membershipId, state, error }) => ({ membershipId, state, error })),
  };
}

export async function convenerDashboard(userId: string, cohortId: string) {
  const home = await homeView(userId, false, cohortId);
  const [f, m, r, options, history] = await Promise.all([
    db.select().from(followups).where(eq(followups.cohortId, cohortId)).orderBy(desc(followups.createdAt)),
    db.select().from(meetings).where(eq(meetings.cohortId, cohortId)).orderBy(desc(meetings.startsAt)),
    db.select().from(resources).where(eq(resources.cohortId, cohortId)).orderBy(desc(resources.createdAt)),
    db.select({ id: exemplars.id, title: exemplars.title, kind: exemplars.kind }).from(exemplars)
      .where(and(eq(exemplars.ownerUserId, userId), eq(exemplars.active, true))),
    db.select({ id: messages.id }).from(messages).where(eq(messages.cohortId, cohortId))
      .orderBy(desc(messages.createdAt)).limit(50),
  ]);
  const learners = home.memberships.filter(m => m.role === "STUDENT").map(member => {
    const required = lessonsFor(member.track).filter(l => l.required);
    const work = home.assignments.filter(a => a.membershipId === member.id);
    const completed = required.filter(l => work.some(a => a.lessonKey === l.key && a.state === "LEARNING_COMPLETE")).length;
    const revisions = work.filter(a => a.state === "REVISION_REQUIRED").length;
    const submitted = work.filter(a => a.state === "SUBMITTED").length;
    const feedback = work.flatMap(a => a.submissions.flatMap(s => s.reviews))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3).map(r => r.feedback);
    return {
      membershipId: member.id, name: member.name, state: member.state, track: member.track,
      required: required.length, completed, submitted, revisions,
      progressPercent: required.length ? Math.round(completed * 100 / required.length) : 0,
      recentFeedback: feedback,
      recommendation: revisions ? "Review revision feedback, assign a targeted worked example, and agree a resubmission date."
        : submitted ? "Review the pending submission before assigning further work."
        : completed === required.length ? "Review the course portfolio. Check Quest eligibility separately; course completion is not certification."
        : work.length ? "Continue the next required lesson and discuss any blockers."
        : "Arrange an onboarding check-in and select the first worked example for this trainee's track.",
    };
  });
  return {
    learners, followups: f, meetings: m, resources: r, isOwner: "isOwner" in home && home.isOwner,
    exemplarOptions: [...listExemplars().filter(e => Boolean(getExemplar(e.id))).map(e => ({ id: e.id, title: e.title, kind: e.kind })), ...options],
    messages: await Promise.all(history.map(m => messageView(m.id))),
    emailConfigured: learningEmailConfigured(),
  };
}

export async function traineeSupport(userId: string, membershipId: string) {
  const { member } = await ownedMembership(db, userId, membershipId);
  const [f, m, r] = await Promise.all([
    db.select().from(followups).where(and(eq(followups.cohortId, member.cohortId), eq(followups.membershipId, member.id)))
      .orderBy(desc(followups.createdAt)),
    db.select().from(meetings).where(eq(meetings.cohortId, member.cohortId)).orderBy(desc(meetings.startsAt)),
    db.select().from(resources).where(and(eq(resources.cohortId, member.cohortId), eq(resources.state, "ACTIVE")))
      .orderBy(desc(resources.createdAt)),
  ]);
  // Do not reveal other participants' membership identifiers to trainees.
  return {
    followups: f,
    meetings: m.filter(m => ["ACTIVE", "COMPLETED"].includes(member.state) && (!m.membershipIds.length || m.membershipIds.includes(member.id)))
      .map(m => ({ ...m, membershipIds: [] })),
    resources: ["ACTIVE", "COMPLETED"].includes(member.state) ? r : [],
  };
}

export async function scopedStudents(reader: Pick<typeof db, "select">, cohortId: string, ids: string[]) {
  const rows = await reader.select().from(members).where(and(
    eq(members.cohortId, cohortId), eq(members.role, "STUDENT"), eq(members.state, "ACTIVE"),
    ids.length ? inArray(members.id, ids) : undefined,
  ));
  return rows;
}
