import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessSessionsTable } from "./harness-sessions";

export const harnessEscalationsTable = pgTable("harness_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  fromFeature: integer("from_feature").notNull().default(3),
  toFeature: integer("to_feature").notNull().default(5),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHarnessEscalationSchema = createInsertSchema(harnessEscalationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHarnessEscalation = z.infer<typeof insertHarnessEscalationSchema>;
export type HarnessEscalation = typeof harnessEscalationsTable.$inferSelect;
