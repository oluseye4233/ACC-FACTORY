import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const learningCohortsTable = pgTable("learning_cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  state: text("state").notNull().default("DRAFT"),
  capacity: integer("capacity").notNull().default(20),
  budgetUsd: numeric("budget_usd", { precision: 12, scale: 6 }).notNull(),
  studentBudgetUsd: numeric("student_budget_usd", { precision: 12, scale: 6 }).notNull(),
  curriculumVersion: text("curriculum_version").notNull().default("ffe-1"),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const learningMembershipsTable = pgTable("learning_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("STUDENT"),
  state: text("state").notNull().default("ACTIVE"),
  track: text("track").notNull().default("BOTH"),
  termsVersion: text("terms_version").notNull().default("ffe-free-1"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("learning_membership_unique").on(t.cohortId, t.userId)]);
export const learningInvitationsTable = pgTable("learning_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("STUDENT"),
  tokenHash: text("token_hash").notNull().unique(),
  state: text("state").notNull().default("ISSUED"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedUserId: uuid("accepted_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const learningAssignmentsTable = pgTable("learning_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id").notNull().references(() => learningMembershipsTable.id),
  lessonKey: text("lesson_key").notNull(),
  state: text("state").notNull().default("IN_PROGRESS"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("learning_assignment_unique").on(t.membershipId, t.lessonKey)]);
export const learningSubmissionsTable = pgTable("learning_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id").notNull().references(() => learningAssignmentsTable.id),
  version: integer("version").notNull(),
  mode: text("mode").notNull(),
  text: text("text").notNull(),
  artifactIds: jsonb("artifact_ids").notNull().$type<string[]>(),
  sourceHash: text("source_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("learning_submission_version_unique").on(t.assignmentId, t.version)]);
export const learningReviewsTable = pgTable("learning_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().references(() => learningSubmissionsTable.id),
  reviewerId: uuid("reviewer_id").notNull().references(() => usersTable.id),
  decision: text("decision").notNull(),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("learning_review_once").on(t.submissionId)]);
export const learningAuditTable = pgTable("learning_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(),
  subjectId: text("subject_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
/** Completed charges and temporary reservations are deliberately separate. */
export const learningChargesTable = pgTable("learning_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  cohortId: uuid("cohort_id").notNull().references(() => learningCohortsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  reservationId: uuid("reservation_id").notNull().unique(),
  state: text("state").notNull().default("RESERVED"),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 6 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("learning_charges_scope").on(t.cohortId, t.userId, t.state)]);
