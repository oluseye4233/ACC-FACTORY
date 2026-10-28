import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { harnessArtifactsTable } from "./harness-artifacts";
import { harnessSessionsTable } from "./harness-sessions";

export const createdAgentsTable = pgTable("created_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  sourceArtifactId: uuid("source_artifact_id").notNull().references(() => harnessArtifactsTable.id),
  companionArtifactId: uuid("companion_artifact_id").references(() => harnessArtifactsTable.id),
  artifactId: uuid("artifact_id").references(() => harnessArtifactsTable.id),
  requestKey: uuid("request_key").notNull(),
  state: text("state").notNull().default("BUILDING"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("created_agents_owner_request").on(t.userId, t.requestKey), index("created_agents_owner").on(t.userId)]);

export const createdAgentRunsTable = pgTable("created_agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => createdAgentsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestKey: uuid("request_key").notNull(),
  state: text("state").notNull().default("RUNNING"),
  input: text("input").notNull(),
  output: text("output"),
  disclosure: text("disclosure"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("created_agent_runs_owner_request").on(t.userId, t.requestKey), index("created_agent_runs_agent").on(t.agentId)]);

export const portalPublicationsTable = pgTable("portal_publications", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id").notNull(),
  sourceHash: text("source_hash").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  format: text("format").notNull(),
  state: text("state").notNull().default("PREPARING"),
  storageKey: text("storage_key").notNull(),
  contentHash: text("content_hash"),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  editorial: jsonb("editorial").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("portal_publications_owner").on(t.userId)]);

export const portalChallengesTable = pgTable("portal_challenges", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  publicationId: uuid("publication_id").notNull().references(() => portalPublicationsTable.id),
  codeHash: text("code_hash").notNull(),
  state: text("state").notNull().default("PENDING_EMAIL"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  downloadIssuedAt: timestamp("download_issued_at", { withTimezone: true }),
  controlMessageId: text("control_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("portal_challenges_owner_time").on(t.userId, t.createdAt)]);
