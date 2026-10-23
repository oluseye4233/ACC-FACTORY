import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { learningCohortsTable, learningMembershipsTable } from "./learning";
import { usersTable } from "./users";

export const learningFollowupsTable = pgTable("learning_followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  membershipId: uuid("membership_id").notNull().references(() => learningMembershipsTable.id),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  lessonKey: text("lesson_key"),
  title: text("title").notNull(),
  feedback: text("feedback").notNull(),
  actionPlan: text("action_plan").notNull(),
  state: text("state").notNull().default("OPEN"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("learning_followups_scope").on(t.cohortId, t.membershipId)]);

export const learningMeetingsTable = pgTable("learning_meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  agenda: text("agenda").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  meetingUrl: text("meeting_url"),
  membershipIds: jsonb("membership_ids").notNull().$type<string[]>().default([]),
  state: text("state").notNull().default("SCHEDULED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("learning_meetings_scope").on(t.cohortId, t.startsAt)]);

/** A deliberate, immutable content snapshot shared only within this cohort. */
export const learningResourcesTable = pgTable("learning_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  notes: text("notes").notNull().default(""),
  lessonKey: text("lesson_key"),
  state: text("state").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("learning_resources_scope").on(t.cohortId, t.state)]);

export const learningMessagesTable = pgTable("learning_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  requestId: uuid("request_id").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("learning_messages_request").on(t.cohortId, t.requestId)]);

export const learningDeliveriesTable = pgTable("learning_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => learningMessagesTable.id),
  membershipId: uuid("membership_id").notNull().references(() => learningMembershipsTable.id),
  state: text("state").notNull().default("PENDING"),
  providerId: text("provider_id"),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("learning_deliveries_recipient").on(t.messageId, t.membershipId)]);
