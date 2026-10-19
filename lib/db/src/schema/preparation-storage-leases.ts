import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Intent metadata only; bytes stay in private App Storage. Deliberately no
// cascading user FK: an account deletion must not erase recovery provenance.
export const preparationStorageLeasesTable = pgTable("preparation_storage_leases", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  fileKeys: jsonb("file_keys").$type<string[]>().notNull(),
  state: text("state").$type<"UPLOADING" | "COMMITTED" | "RECOVERED">().notNull().default("UPLOADING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  nextRecoveryAt: timestamp("next_recovery_at", { withTimezone: true }).notNull()
    .default(sql`now() + interval '1 day'`),
  lastRecoveryAt: timestamp("last_recovery_at", { withTimezone: true }),
}, table => [
  index("preparation_storage_leases_due_idx").on(table.nextRecoveryAt)
    .where(sql`${table.state} <> 'COMMITTED'`),
]);
