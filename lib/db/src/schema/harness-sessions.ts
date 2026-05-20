import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ingestionDocumentsTable } from "./ingestion-documents";

export const SESSION_ORIGINS = ["manual", "ingested"] as const;
export type SessionOrigin = (typeof SESSION_ORIGINS)[number];

export const harnessSessionsTable = pgTable("harness_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionName: varchar("session_name", { length: 255 }).notNull().default("Untitled Session"),
  status: text("status").notNull().default("ACTIVE"),
  origin: text("origin").notNull().$type<SessionOrigin>().default("manual"),
  ingestionId: uuid("ingestion_id").references(() => ingestionDocumentsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  ingestionIdx: index("harness_sessions_ingestion_id_idx").on(t.ingestionId),
}));

export const insertHarnessSessionSchema = createInsertSchema(harnessSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHarnessSession = z.infer<typeof insertHarnessSessionSchema>;
export type HarnessSession = typeof harnessSessionsTable.$inferSelect;
