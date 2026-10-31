import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Private intake only. A draft is never a payment, free-offer claim or production job. */
export const autoCommandDraftsTable = pgTable("autocommand_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestKey: uuid("request_key").notNull(),
  verifiedEmail: text("verified_email").notNull(),
  projectName: text("project_name").notNull(),
  packageType: text("package_type").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("autocommand_drafts_user_request_key").on(table.userId, table.requestKey),
  index("autocommand_drafts_user_created").on(table.userId, table.createdAt),
]);

/** Exact bytes live in private App Storage, never JSONB. No public serving URL. */
export const autoCommandUploadsTable = pgTable("autocommand_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  state: text("state").notNull().default("PENDING"),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  storageKey: text("storage_key").notNull(),
  contentHash: text("content_hash").notNull(),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("autocommand_uploads_user_created").on(table.userId, table.createdAt)]);

/** A frozen production request, not payment confirmation or a free-offer claim. */
export const autoCommandOrdersTable = pgTable("autocommand_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  draftId: uuid("draft_id").notNull().references(() => autoCommandDraftsTable.id),
  verifiedEmail: text("verified_email").notNull(),
  projectName: text("project_name").notNull(),
  packageType: text("package_type").notNull(),
  standardPriceCents: integer("standard_price_cents").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  planVersion: integer("plan_version").notNull().default(1),
  state: text("state").notNull().default("AWAITING_AUTHORIZATION"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("autocommand_orders_draft").on(table.draftId),
  index("autocommand_orders_user_created").on(table.userId, table.createdAt),
]);

/** Dispatch intent is durable before invoking an external adapter. Never reclaim by age. */
export const autoCommandStepsTable = pgTable("autocommand_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => autoCommandOrdersTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  key: text("key").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull().default("PENDING"),
  claimToken: uuid("claim_token"),
  evidence: jsonb("evidence").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, table => [uniqueIndex("autocommand_steps_order_position").on(table.orderId, table.position)]);
