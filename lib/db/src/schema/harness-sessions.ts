import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const harnessSessionsTable = pgTable("harness_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionName: varchar("session_name", { length: 255 }).notNull().default("Untitled Session"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertHarnessSessionSchema = createInsertSchema(harnessSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHarnessSession = z.infer<typeof insertHarnessSessionSchema>;
export type HarnessSession = typeof harnessSessionsTable.$inferSelect;
