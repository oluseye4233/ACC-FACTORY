import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";

/** Owner-authored acceptance contracts; append-only through the application. */
export const xvlEvalsetsTable = pgTable("xvl_evalsets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  title: text("title").notNull(),
  rules: jsonb("rules").notNull().$type<Record<string, unknown>[]>(),
  contentHash: text("content_hash").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerSessionIdx: index("xvl_evalsets_owner_session_idx").on(t.ownerUserId, t.sessionId),
  hashRequired: check("xvl_evalsets_sha256_required", sql`${t.contentHash} ~ '^[a-f0-9]{64}$'`),
}));
export const insertXvlEvalsetSchema = createInsertSchema(xvlEvalsetsTable).omit({ id: true, registeredAt: true });
