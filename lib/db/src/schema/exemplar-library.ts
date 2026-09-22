import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { harnessArtifactsTable } from "./harness-artifacts";

export const EXEMPLAR_KINDS = ["SPC", "MA", "MPDD", "PDD"] as const;
export type ExemplarKind = (typeof EXEMPLAR_KINDS)[number];

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
    kind: text("kind").notNull().$type<ExemplarKind>(),
    title: text("title").notNull(),
    tagline: text("tagline").notNull(),
    body: text("body").notNull(),
    originalFilename: text("original_filename"),
    artifactSnapshot: jsonb("artifact_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("exemplar_library_source_artifact_unique").on(
      table.sourceArtifactId,
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