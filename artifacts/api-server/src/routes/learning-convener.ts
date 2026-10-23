import { Router, type Request, type Response, type NextFunction } from "express";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, usersTable, learningCohortsTable as cohorts, learningMembershipsTable as members,
  learningFollowupsTable as followups, learningMeetingsTable as meetings,
  learningResourcesTable as resources, learningMessagesTable as messages,
  learningDeliveriesTable as deliveries, learningAuditTable as audit,
  exemplarLibraryItemsTable as exemplars,
} from "@workspace/db";
import { learningEmailConfigured, sendLearningMessage } from "@workspace/email";
import { requireAuth } from "../lib/auth";
import { fail, LearningError, teachingScope } from "../lib/learning-service";
import { LEARNING_LESSONS } from "../lib/learning-curriculum";
import { convenerDashboard, traineeSupport, messageView, scopedStudents } from "../lib/learning-convener";
import { getExemplar } from "../data/exemplars";
import { logger } from "../lib/logger";

const router = Router();
const uuid = z.string().uuid();
const lesson = z.string().refine(k => LEARNING_LESSONS.some(l => l.key === k), "Unknown lesson").nullable().optional();
const ids = z.array(uuid).max(500).refine(v => new Set(v).size === v.length, "Duplicate trainee");
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof LearningError) res.status(e.status).json({ error: e.message });
    else if (e instanceof z.ZodError) res.status(400).json({ error: "Invalid convener request", details: e.flatten() });
    else next(e);
  }
};
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function writable(tx: Tx, userId: string, id: string) {
  await tx.select().from(cohorts).where(eq(cohorts.id, id)).for("update");
  const scope = await teachingScope(tx, userId, id);
  if (!["DRAFT", "INVITING", "ACTIVE", "SUSPENDED"].includes(scope.cohort.state) || scope.cohort.endsAt <= new Date()) {
    fail(409, "This cohort is read-only");
  }
  return scope;
}
async function log(tx: Tx, cohortId: string, actorId: string, action: string, subjectId: string) {
  await tx.insert(audit).values({ cohortId, actorId, action, subjectId });
}
router.get("/learn/cohorts/:id/convener", requireAuth, wrap(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await convenerDashboard(req.localUser!.id, uuid.parse(req.params.id)));
}));
router.get("/learn/memberships/:id/support", requireAuth, wrap(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await traineeSupport(req.localUser!.id, uuid.parse(req.params.id)));
}));
const FollowupInput = z.object({
  id: uuid.optional(), membershipId: uuid, title: z.string().trim().min(3).max(160),
  feedback: z.string().trim().min(3).max(4000), actionPlan: z.string().trim().min(3).max(4000),
  state: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]), lessonKey: lesson,
  dueAt: z.iso.datetime().nullable().optional(),
}).strict();
router.post("/learn/cohorts/:id/followups", requireAuth, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id), b = FollowupInput.parse(req.body), actor = req.localUser!.id;
  const result = await db.transaction(async tx => {
    await writable(tx, actor, id);
    const [member] = await tx.select().from(members).where(and(
      eq(members.id, b.membershipId), eq(members.cohortId, id), eq(members.role, "STUDENT"),
    ));
    if (!member) fail(404, "Trainee not found");
    const values = { title: b.title, feedback: b.feedback, actionPlan: b.actionPlan, state: b.state,
      lessonKey: b.lessonKey ?? null, dueAt: b.dueAt ? new Date(b.dueAt) : null, updatedAt: new Date() };
    const [saved] = b.id
      ? await tx.update(followups).set(values).where(and(eq(followups.id, b.id), eq(followups.cohortId, id), eq(followups.membershipId, b.membershipId))).returning()
      : await tx.insert(followups).values({ ...values, cohortId: id, membershipId: b.membershipId, authorId: actor }).returning();
    if (!saved) fail(404, "Follow-up not found");
    await log(tx, id, actor, b.id ? "FOLLOWUP_UPDATED" : "FOLLOWUP_CREATED", saved.id);
    return saved;
  });
  res.json(result);
}));
const MeetingInput = z.object({
  id: uuid.optional(), title: z.string().trim().min(3).max(160), agenda: z.string().trim().max(4000),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), membershipIds: ids,
  meetingUrl: z.url().refine(u => new URL(u).protocol === "https:" && !new URL(u).username && !new URL(u).password, "Use a public HTTPS meeting URL").nullable().optional(),
  state: z.enum(["SCHEDULED", "CANCELLED"]),
}).strict();
router.post("/learn/cohorts/:id/meetings", requireAuth, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id), b = MeetingInput.parse(req.body), actor = req.localUser!.id;
  if (new Date(b.endsAt) <= new Date(b.startsAt)) fail(400, "Meeting end must follow its start");
  const result = await db.transaction(async tx => {
    const { cohort } = await writable(tx, actor, id);
    if (b.state === "SCHEDULED" && (new Date(b.startsAt) <= new Date() || new Date(b.endsAt) > cohort.endsAt)) {
      fail(400, "Schedule a future meeting before the cohort ends");
    }
    if (b.membershipIds.length && (await scopedStudents(tx, id, b.membershipIds)).length !== b.membershipIds.length) fail(404, "A selected trainee is unavailable");
    const { id: meetingId, ...fields } = b;
    const values = { ...fields, meetingUrl: b.meetingUrl ?? null, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt), updatedAt: new Date() };
    const [saved] = meetingId
      ? await tx.update(meetings).set(values).where(and(eq(meetings.id, meetingId), eq(meetings.cohortId, id))).returning()
      : await tx.insert(meetings).values({ ...values, cohortId: id, authorId: actor }).returning();
    if (!saved) fail(404, "Meeting not found");
    await log(tx, id, actor, b.state === "CANCELLED" ? "MEETING_CANCELLED" : meetingId ? "MEETING_UPDATED" : "MEETING_CREATED", saved.id);
    return saved;
  });
  res.json(result);
}));
const ResourceInput = z.object({
  action: z.enum(["SHARE", "ARCHIVE"]), id: uuid.optional(), sourceId: z.string().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(), lessonKey: lesson,
}).strict();
router.post("/learn/cohorts/:id/resources", requireAuth, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id), b = ResourceInput.parse(req.body), actor = req.localUser!.id;
  const result = await db.transaction(async tx => {
    await writable(tx, actor, id);
    if (b.action === "ARCHIVE") {
      if (!b.id) fail(400, "Resource ID required");
      const [saved] = await tx.update(resources).set({ state: "ARCHIVED" }).where(and(eq(resources.id, b.id), eq(resources.cohortId, id))).returning();
      if (!saved) fail(404, "Resource not found");
      await log(tx, id, actor, "RESOURCE_ARCHIVED", saved.id);
      return saved;
    }
    if (!b.sourceId) fail(400, "Choose an Exemplar");
    const curated = getExemplar(b.sourceId);
    const [owned] = curated ? [] : await tx.select().from(exemplars).where(and(
      eq(exemplars.id, uuid.parse(b.sourceId)), eq(exemplars.ownerUserId, actor), eq(exemplars.active, true),
    ));
    const source = curated ?? owned;
    if (!source) fail(404, "Active owned or curated Exemplar not found");
    if (source.body.length > 2_000_000) fail(400, "Exemplar is too large for a cohort reference");
    const [saved] = await tx.insert(resources).values({
      cohortId: id, authorId: actor, sourceId: b.sourceId, title: source.title, kind: source.kind,
      body: source.body, notes: b.notes ?? "", lessonKey: b.lessonKey ?? null,
    }).returning();
    await log(tx, id, actor, "RESOURCE_SHARED", saved!.id);
    return saved!;
  });
  res.json(result);
}));
const MessageInput = z.object({
  requestId: uuid, subject: z.string().trim().min(3).max(160).refine(s => !/[\r\n]/.test(s)),
  body: z.string().trim().min(3).max(10000), membershipIds: ids, meetingId: uuid.optional(),
}).strict();
router.post("/learn/cohorts/:id/messages", requireAuth, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id), b = MessageInput.parse(req.body), actor = req.localUser!.id;
  // Authorization precedes configuration disclosure. No simulated successful sends.
  await teachingScope(db, actor, id);
  if (!learningEmailConfigured()) fail(503, "Cohort email is not configured. Configure the existing email service before sending.");
  const send = await db.transaction(async tx => {
    const { cohort } = await writable(tx, actor, id);
    const [existing] = await tx.select().from(messages).where(and(eq(messages.cohortId, id), eq(messages.requestId, b.requestId)));
    if (existing) return { message: existing, cohort, recipients: [], fresh: false };
    // Bound sends across instances through the same cohort row lock.
    const [last] = await tx.select().from(messages).where(eq(messages.cohortId, id)).orderBy(desc(messages.createdAt)).limit(1);
    if (last && Date.now() - last.createdAt.getTime() < 30_000) fail(429, "Wait 30 seconds before another cohort email");
    let audience = b.membershipIds;
    let body = b.body;
    if (b.meetingId) {
      const [meeting] = await tx.select().from(meetings).where(and(eq(meetings.id, b.meetingId), eq(meetings.cohortId, id)));
      if (!meeting) fail(404, "Meeting not found");
      if (meeting.membershipIds.length) {
        if (audience.length && audience.some(v => !meeting.membershipIds.includes(v))) fail(400, "Choose only trainees addressed by this meeting");
        if (!audience.length) audience = meeting.membershipIds;
      }
      body += `\n\nMeeting: ${meeting.title}\nStatus: ${meeting.state}\nStarts: ${meeting.startsAt.toISOString()}\nEnds: ${meeting.endsAt.toISOString()}\n${meeting.agenda}${meeting.meetingUrl ? `\nJoin: ${meeting.meetingUrl}` : ""}`;
    }
    const selected = await scopedStudents(tx, id, audience);
    if (audience.length && selected.length !== audience.length) fail(404, "A selected trainee is unavailable");
    if (!selected.length) fail(409, "No active trainees to email");
    const [message] = await tx.insert(messages).values({ cohortId: id, authorId: actor, requestId: b.requestId, subject: b.subject, body }).returning();
    await tx.insert(deliveries).values(selected.map(m => ({ messageId: message!.id, membershipId: m.id })));
    await log(tx, id, actor, "COHORT_EMAIL_CREATED", message!.id);
    return { message: message!, cohort, recipients: selected, fresh: true };
  });
  if (send.fresh) {
    // Bounded batches keep recipient addresses private and provider work finite.
    for (let offset = 0; offset < send.recipients.length; offset += 4) {
      await Promise.all(send.recipients.slice(offset, offset + 4).map(async member => {
        const [claim] = await db.update(deliveries).set({ state: "SENDING", updatedAt: new Date() }).where(and(
          eq(deliveries.messageId, send.message.id), eq(deliveries.membershipId, member.id), eq(deliveries.state, "PENDING"),
        )).returning();
        if (!claim) return;
        try {
          const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, member.userId));
          const result = user?.email ? await sendLearningMessage({
            to: user.email, subject: send.message.subject, body: send.message.body,
            cohortTitle: send.cohort.title, idempotencyKey: `cohort:${send.message.id}:${member.id}`,
          }) : { ok: false as const, error: "Recipient has no email address" };
          const accepted = result.ok && !result.dryRun;
          await db.update(deliveries).set({
            state: accepted ? "SENT" : "FAILED", providerId: result.ok ? result.id : null,
            error: accepted ? null : result.ok ? "Email was not dispatched" : "Provider did not accept this email",
            updatedAt: new Date(),
          }).where(eq(deliveries.id, claim.id));
        } catch (error) {
          // Unknown delivery outcomes must not be retried as if they were unsent.
          logger.warn({ err: error, deliveryId: claim.id }, "Cohort email outcome uncertain; leaving SENDING");
        }
      }));
    }
  }
  res.json(await messageView(send.message.id));
}));
export default router;
