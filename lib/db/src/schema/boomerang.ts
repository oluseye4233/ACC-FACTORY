import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/** Supporting-work cases, never stage clearance or release authority. */
export const boomerangCasesTable = pgTable("boomerang_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  originKind: text("origin_kind").notNull(),
  originId: uuid("origin_id").notNull(),
  stage: text("stage").notNull(),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  sourceHash: text("source_hash").notNull(),
  sourceRefs: jsonb("source_refs").notNull(),
  state: text("state").notNull().default("REQUESTED"),
  version: integer("version").notNull().default(1),
  resultText: text("result_text"),
  resultHash: text("result_hash"),
  spcPlayerRunId: uuid("spc_player_run_id"),
  history: jsonb("history").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("boomerang_owner_origin_idx").on(t.userId, t.originKind, t.originId, t.stage),
]);
export const insertBoomerangCaseSchema = createInsertSchema(boomerangCasesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type BoomerangCaseRow = typeof boomerangCasesTable.$inferSelect;
export type InsertBoomerangCase = z.infer<typeof insertBoomerangCaseSchema>;
