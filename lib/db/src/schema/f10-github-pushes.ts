import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { harnessArtifactsTable } from "./harness-artifacts";

export const f10GitHubPushesTable = pgTable("f10_github_pushes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceArtifactId: uuid("source_artifact_id").notNull().references(() => harnessArtifactsTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("IN_PROGRESS"),
  result: jsonb("result"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdempotencyUniq: uniqueIndex("f10_github_pushes_user_idempotency_uniq").on(table.userId, table.idempotencyKey),
  sourceIdx: index("f10_github_pushes_source_idx").on(table.sourceArtifactId),
}));

export type F10GitHubPush = typeof f10GitHubPushesTable.$inferSelect;