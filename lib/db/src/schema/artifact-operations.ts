import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";

// These new surfaces use transaction-local actor context. Existing application
// tables and their authorization model are deliberately not changed here.
const actor = sql`nullif(current_setting('app.operations_actor', true), '')::uuid`;
const approval = sql`current_setting('app.operations_admin', true) = 'true'`;

export const imprimaJobsTable = pgTable("imprima_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => harnessSessionsTable.id, { onDelete: "set null" }),
  sourceKind: text("source_kind").notNull(),
  sourceId: text("source_id").notNull(),
  sourceHash: text("source_hash").notNull(),
  sourceObjectKey: text("source_object_key").notNull(),
  version: integer("version").notNull(),
  revision: integer("revision").notNull().default(0),
  state: text("state").notNull().default("QUEUED"),
  config: jsonb("config").notNull().$type<Record<string, unknown>>(),
  result: jsonb("result").notNull().default({}).$type<Record<string, unknown>>(),
  attemptToken: uuid("attempt_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("imprima_source_version_unique").on(t.userId, t.sourceKind, t.sourceId, t.version),
  index("imprima_owner_created_idx").on(t.userId, t.createdAt),
  check("imprima_revision_positive", sql`${t.revision} >= 0 AND ${t.version} > 0`),
  pgPolicy("imprima_jobs_owner", { for: "all", using: sql`${t.userId} = ${actor} OR ${approval}`, withCheck: sql`${t.userId} = ${actor} OR ${approval}` }),
]).enableRLS();

export const imprimaFilesTable = pgTable("imprima_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => imprimaJobsTable.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  variant: text("variant").notNull(),
  filename: text("filename").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentHash: text("content_hash").notNull(),
  fileHash: text("file_hash").notNull(),
  size: integer("size").notNull(),
  validation: jsonb("validation").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("imprima_job_format_variant_unique").on(t.jobId, t.format, t.variant),
  pgPolicy("imprima_files_owner", { for: "all", using: sql`${t.userId} = ${actor} OR ${approval}`, withCheck: sql`${t.userId} = ${actor} OR ${approval}` }),
]).enableRLS();

export const shortSprintRunsTable = pgTable("short_sprint_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  circuit: text("circuit").notNull(),
  target: text("target").notNull(),
  profile: text("profile").notNull(),
  sourceArtifactId: uuid("source_artifact_id").notNull(),
  sourceHash: text("source_hash").notNull(),
  sourceObjectKey: text("source_object_key").notNull(),
  revision: integer("revision").notNull().default(0),
  state: text("state").notNull().default("PROPOSED"),
  activeRoute: integer("active_route").notNull().default(0),
  config: jsonb("config").notNull().$type<Record<string, unknown>>(),
  result: jsonb("result").notNull().default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("short_sprint_active_route_unique").on(t.sessionId).where(sql`${t.activeRoute} = 1`),
  index("short_sprint_owner_session_idx").on(t.userId, t.sessionId),
  check("short_sprint_active_route_boolean", sql`${t.activeRoute} IN (0, 1)`),
  pgPolicy("short_sprint_runs_owner", { for: "all", using: sql`${t.userId} = ${actor} OR ${approval}`, withCheck: sql`${t.userId} = ${actor} OR ${approval}` }),
]).enableRLS();

export const artifactOperationEventsTable = pgTable("artifact_operation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workflowId: uuid("workflow_id").notNull(),
  kind: text("kind").notNull(),
  action: text("action").notNull(),
  revision: integer("revision").notNull(),
  data: jsonb("data").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("artifact_operation_events_workflow_idx").on(t.workflowId, t.createdAt),
  pgPolicy("artifact_operation_events_owner", { for: "all", using: sql`${t.userId} = ${actor} OR ${approval}`, withCheck: sql`${t.userId} = ${actor} OR ${approval}` }),
]).enableRLS();

export const sprintVerifierAuthoritiesTable = pgTable("sprint_verifier_authorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  registeredBy: uuid("registered_by").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  publicKey: text("public_key").notNull(),
  fingerprint: text("fingerprint").notNull().unique(),
  mechanism: text("mechanism").notNull(),
  scopes: jsonb("scopes").notNull().$type<string[]>(),
  governanceNote: text("governance_note").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, () => [
  pgPolicy("sprint_verifiers_read", { for: "select", using: sql`${actor} IS NOT NULL` }),
  pgPolicy("sprint_verifiers_admin_insert", { for: "insert", withCheck: approval }),
  pgPolicy("sprint_verifiers_admin_update", { for: "update", using: approval, withCheck: approval }),
]).enableRLS();
