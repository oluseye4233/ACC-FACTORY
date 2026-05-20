import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ingestionDocumentsTable } from "./ingestion-documents";

export const INGESTION_CREDIT_STATUSES = ["available", "consumed"] as const;
export type IngestionCreditStatus = (typeof INGESTION_CREDIT_STATUSES)[number];

export const ingestionCreditsTable = pgTable("ingestion_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status")
    .notNull()
    .default("available")
    .$type<IngestionCreditStatus>(),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).unique(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  amountUsdCents: integer("amount_usd_cents"),
  ingestionDocumentId: uuid("ingestion_document_id").references(
    () => ingestionDocumentsTable.id,
    { onDelete: "set null" },
  ),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

export const insertIngestionCreditSchema = createInsertSchema(ingestionCreditsTable).omit({
  id: true,
  purchasedAt: true,
});
export type InsertIngestionCredit = z.infer<typeof insertIngestionCreditSchema>;
export type IngestionCredit = typeof ingestionCreditsTable.$inferSelect;
