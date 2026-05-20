import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const SOURCE_DOC_KINDS = [
  "product_design_document",
  "software_design_document",
  "concept_note",
  "spec_sheet",
  "other",
] as const;
export type SourceDocKind = (typeof SOURCE_DOC_KINDS)[number];

export const ingestionDocumentsTable = pgTable("ingestion_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  originalFilename: varchar("original_filename", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  sourceDocKind: text("source_doc_kind")
    .notNull()
    .$type<SourceDocKind>()
    .default("other"),
  detectedTitle: varchar("detected_title", { length: 512 }),
  extractedTextSha256: varchar("extracted_text_sha256", { length: 64 }).notNull(),
  extractedTextChars: integer("extracted_text_chars").notNull(),
  summary: text("summary").notNull(),
  seedPrompt: text("seed_prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIngestionDocumentSchema = createInsertSchema(
  ingestionDocumentsTable,
).omit({ id: true, createdAt: true });
export type InsertIngestionDocument = z.infer<typeof insertIngestionDocumentSchema>;
export type IngestionDocument = typeof ingestionDocumentsTable.$inferSelect;
