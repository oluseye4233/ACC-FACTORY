import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ingestionDocumentsTable } from "./ingestion-documents";
import { cartridgePackagesTable } from "./cartridge";

export const SESSION_ORIGINS = ["manual", "ingested", "cartridge"] as const;
export type SessionOrigin = (typeof SESSION_ORIGINS)[number];

export const LLM_PROVIDERS = ["claude", "openai", "gemini"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const harnessSessionsTable = pgTable("harness_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionName: varchar("session_name", { length: 255 }).notNull().default("Untitled Session"),
  status: text("status").notNull().default("ACTIVE"),
  origin: text("origin").notNull().$type<SessionOrigin>().default("manual"),
  preferredModelProvider: text("preferred_model_provider")
    .notNull()
    .$type<LlmProvider>()
    .default("claude"),
  ingestionId: uuid("ingestion_id").references(() => ingestionDocumentsTable.id, {
    onDelete: "set null",
  }),
  cartridgeId: uuid("cartridge_id").references(() => cartridgePackagesTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  ingestionIdx: index("harness_sessions_ingestion_id_idx").on(t.ingestionId),
  cartridgeIdx: index("harness_sessions_cartridge_id_idx").on(t.cartridgeId),
}));

export const insertHarnessSessionSchema = createInsertSchema(harnessSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHarnessSession = z.infer<typeof insertHarnessSessionSchema>;
export type HarnessSession = typeof harnessSessionsTable.$inferSelect;
