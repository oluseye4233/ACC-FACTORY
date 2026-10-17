import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { harnessArtifactsTable } from "./harness-artifacts";
import { f0ReportsTable } from "./f0-reports";

export const EXEMPLAR_KINDS = ["SPC", "MA", "MPDD", "PDD", "F0_REPORT"] as const;
export type ExemplarKind = (typeof EXEMPLAR_KINDS)[number];

export type ExemplarQualification = {
  decision: "APPROVED" | "REJECTED";
  policyVersion: "SPHINX_BASELINE_V1";
  contentHash: string;
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
  jcse: number;
  tokenCount: number;
  version: string;
  documentation: string;
  tests: string;
  rightsCleared: boolean;
  safetyReviewed: boolean;
};

export const exemplarLibraryItemsTable = pgTable(
  "exemplar_library_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sourceArtifactId: uuid("source_artifact_id").references(
      () => harnessArtifactsTable.id,
      { onDelete: "set null" },
    ),
    sourceF0ReportId: uuid("source_f0_report_id").references(
      () => f0ReportsTable.id,
      { onDelete: "set null" },
    ),
    kind: text("kind").notNull().$type<ExemplarKind>(),
    title: text("title").notNull(),
    tagline: text("tagline").notNull(),
    body: text("body").notNull(),
    originalFilename: text("original_filename"),
    artifactSnapshot: jsonb("artifact_snapshot"),
    active: boolean("active").notNull().default(true),
    artifactMode: text("artifact_mode").notNull().default("LIBRARY_ARTIFACT")
      .$type<"LIBRARY_ARTIFACT" | "SPHINX_ARTIFACT">(),
    qualification: jsonb("qualification").$type<ExemplarQualification>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("exemplar_library_source_artifact_unique").on(
      table.sourceArtifactId,
    ),
    uniqueIndex("exemplar_library_source_f0_report_unique").on(
      table.sourceF0ReportId,
    ),
  ],
);

export const insertExemplarLibraryItemSchema = createInsertSchema(
  exemplarLibraryItemsTable,
).omit({ id: true, createdAt: true });
export type InsertExemplarLibraryItem = z.infer<
  typeof insertExemplarLibraryItemSchema
>;
export type ExemplarLibraryItem =
  typeof exemplarLibraryItemsTable.$inferSelect;

// A closed-by-default public catalog; changing this never activates checkout.
export const sphinxMarketplaceSettingsTable = pgTable("sphinx_marketplace_settings", {
  id: text("id").primaryKey(),
  publicOpen: boolean("public_open").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});