import {
  boolean,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { harnessArtifactsTable } from "./harness-artifacts";

export const spcLibraryCardsTable = pgTable(
  "spc_library_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    provenance: jsonb("provenance").notNull(),
    status: text("status").notNull().default("PRE_BUILD"),
    preBuild: boolean("pre_build").notNull().default(true),
    cheatSheetPublished: boolean("cheat_sheet_published").notNull().default(false),
    cheatSheet: jsonb("cheat_sheet"),
    thirdPartyDefinitions: jsonb("third_party_definitions"),
    environmentNotes: jsonb("environment_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("spc_library_cards_slug_unique").on(table.slug)],
);

export const spcDevKitsTable = pgTable(
  "spc_dev_kits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    cardIds: jsonb("card_ids").notNull(),
    registrationNote: text("registration_note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("spc_dev_kits_name_unique").on(table.name)],
);

export const spcPlayerDraftRunsTable = pgTable(
  "spc_player_draft_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sourceArtifactId: uuid("source_artifact_id").references(() => harnessArtifactsTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    selectedCardIds: jsonb("selected_card_ids").notNull(),
    profile: text("profile").notNull().default("full"),
    status: text("status").notNull().default("DRAFT"),
    governance: jsonb("governance").notNull(),
    outputPackage: jsonb("output_package"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "spc_player_draft_runs_no_composite_score",
      sql`"output_package" IS NULL OR (
        NOT ("output_package" ? 'composite')
        AND NOT ("output_package" ? 'compositeScore')
        AND NOT (("output_package" -> 'scores') ? 'composite')
        AND NOT (("output_package" -> 'scores') ? 'compositeScore')
      )`,
    ),
  ],
);

/**
 * Per-run webhook consent. Endpoint metadata and the consent time are the
 * only persisted webhook values; credentials and request payloads are never
 * stored.
 */
export const spcPlayerWebhookAuthorizationsTable = pgTable(
  "spc_player_webhook_authorizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => spcPlayerDraftRunsTable.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("spc_player_webhook_authorizations_run_unique").on(table.runId)],
);
export const insertSpcLibraryCardSchema = createInsertSchema(spcLibraryCardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSpcDevKitSchema = createInsertSchema(spcDevKitsTable).omit({
  id: true,
  createdAt: true,
});
export const insertSpcPlayerDraftRunSchema = createInsertSchema(spcPlayerDraftRunsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSpcLibraryCard = z.infer<typeof insertSpcLibraryCardSchema>;
export type SpcLibraryCard = typeof spcLibraryCardsTable.$inferSelect;
export type InsertSpcDevKit = z.infer<typeof insertSpcDevKitSchema>;
export type SpcDevKit = typeof spcDevKitsTable.$inferSelect;
export type InsertSpcPlayerDraftRun = z.infer<typeof insertSpcPlayerDraftRunSchema>;
export type SpcPlayerDraftRun = typeof spcPlayerDraftRunsTable.$inferSelect;

export const insertSpcPlayerWebhookAuthorizationSchema = createInsertSchema(
  spcPlayerWebhookAuthorizationsTable,
).omit({
  id: true,
});

export type InsertSpcPlayerWebhookAuthorization = z.infer<
  typeof insertSpcPlayerWebhookAuthorizationSchema
>;

export type SpcPlayerWebhookAuthorization =
  typeof spcPlayerWebhookAuthorizationsTable.$inferSelect;
