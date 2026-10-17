import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";

/** Internal metadata audit, never the training corpus or artifact body. */
export const commandDeckTracesTable = pgTable("command_deck_traces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  envelope: jsonb("envelope").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerSessionTimeIdx: index("command_deck_traces_owner_session_time_idx").on(t.ownerUserId, t.sessionId, t.createdAt),
}));

export const insertCommandDeckTraceSchema = createInsertSchema(commandDeckTracesTable).omit({ id: true, createdAt: true });
export type CommandDeckTrace = typeof commandDeckTracesTable.$inferSelect;
