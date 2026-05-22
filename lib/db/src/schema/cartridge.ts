import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const CARTRIDGE_CREDIT_STATUSES = ["available", "consumed"] as const;
export type CartridgeCreditStatus = (typeof CARTRIDGE_CREDIT_STATUSES)[number];

export const cartridgePackagesTable = pgTable(
  "cartridge_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    projectName: varchar("project_name", { length: 255 }).notNull(),
    outcomeOneLiner: text("outcome_one_liner").notNull(),
    scopeStatement: text("scope_statement").notNull(),
    targetPlatformHint: text("target_platform_hint"),
    seedPrompt: text("seed_prompt").notNull(),
    summary: text("summary").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("cartridge_packages_user_id_idx").on(t.userId),
  }),
);

export const cartridgeCreditsTable = pgTable("cartridge_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status")
    .notNull()
    .default("available")
    .$type<CartridgeCreditStatus>(),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
    length: 255,
  }).unique(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  amountUsdCents: integer("amount_usd_cents"),
  cartridgePackageId: uuid("cartridge_package_id").references(
    () => cartridgePackagesTable.id,
    { onDelete: "set null" },
  ),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

export const cartridgeDocumentsTable = pgTable(
  "cartridge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartridgeId: uuid("cartridge_id")
      .notNull()
      .references(() => cartridgePackagesTable.id, { onDelete: "cascade" }),
    originalFilename: varchar("original_filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    extractedTextChars: integer("extracted_text_chars").notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    cartridgeIdx: index("cartridge_documents_cartridge_id_idx").on(t.cartridgeId),
  }),
);

export const cartridgeSpcsTable = pgTable(
  "cartridge_spcs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartridgeId: uuid("cartridge_id")
      .notNull()
      .references(() => cartridgePackagesTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    body: text("body").notNull(),
    summary: text("summary").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    cartridgeIdx: index("cartridge_spcs_cartridge_id_idx").on(t.cartridgeId),
  }),
);

export const CARTRIDGE_LINK_KINDS = ["git", "database"] as const;
export type CartridgeLinkKind = (typeof CARTRIDGE_LINK_KINDS)[number];

export const cartridgeLinksTable = pgTable(
  "cartridge_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartridgeId: uuid("cartridge_id")
      .notNull()
      .references(() => cartridgePackagesTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<CartridgeLinkKind>(),
    descriptor: text("descriptor").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    cartridgeIdx: index("cartridge_links_cartridge_id_idx").on(t.cartridgeId),
  }),
);

export const insertCartridgePackageSchema = createInsertSchema(
  cartridgePackagesTable,
).omit({ id: true, createdAt: true });
export type InsertCartridgePackage = z.infer<typeof insertCartridgePackageSchema>;
export type CartridgePackage = typeof cartridgePackagesTable.$inferSelect;
export type CartridgeCredit = typeof cartridgeCreditsTable.$inferSelect;
export type CartridgeDocument = typeof cartridgeDocumentsTable.$inferSelect;
export type CartridgeSpc = typeof cartridgeSpcsTable.$inferSelect;
export type CartridgeLink = typeof cartridgeLinksTable.$inferSelect;
