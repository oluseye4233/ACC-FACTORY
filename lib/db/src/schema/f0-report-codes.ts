import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessArtifactsTable } from "./harness-artifacts";
import { usersTable } from "./users";

/**
 * F0 advisory report-code registry (D24 · F0-021).
 *
 * The F0 Business Intelligence Consulting layer (a downstream task) issues one
 * report code at every advisory report generation event. The advisory reference
 * is formatted as `[CODE]-[SKU]-[TIMESTAMP]` and anchored to the owning SKU so
 * every report is traceable back to the cognitive asset it advises on. This
 * table is the persistent registry those codes are minted into; the F0 layer
 * consumes `issueF0ReportCode` (see api-server `lib/sku.ts`).
 */
export const f0ReportCodesTable = pgTable("f0_report_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The full formatted advisory reference: `[CODE]-[SKU]-[TIMESTAMP]`. */
  reportCode: text("report_code").notNull().unique(),
  /** The short report `[CODE]` component (e.g. the F0 report kind code). */
  code: text("code").notNull(),
  /** The owning SKU this advisory report is anchored to. */
  sku: text("sku").notNull(),
  /** Owning artifact, when the report advises on a specific listing. */
  artifactId: uuid("artifact_id").references(() => harnessArtifactsTable.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertF0ReportCodeSchema = createInsertSchema(f0ReportCodesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertF0ReportCode = z.infer<typeof insertF0ReportCodeSchema>;
export type F0ReportCode = typeof f0ReportCodesTable.$inferSelect;
