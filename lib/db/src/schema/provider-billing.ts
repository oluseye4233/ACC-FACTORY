import { createInsertSchema } from "drizzle-zod";
import {
  date,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const providerBillingReportsTable = pgTable(
  "provider_billing_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 48 }).notNull(),
    billingMonth: date("billing_month", { mode: "string" }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    providerMonthUnique: uniqueIndex("provider_billing_reports_provider_month_uq").on(
      t.provider,
      t.billingMonth,
    ),
    monthIdx: index("provider_billing_reports_month_idx").on(t.billingMonth),
  }),
);

export const providerBillingReportLinesTable = pgTable(
  "provider_billing_report_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => providerBillingReportsTable.id, { onDelete: "cascade" }),
    modelId: varchar("model_id", { length: 160 }).notNull(),
    amountUsd: numeric("amount_usd", { precision: 14, scale: 6 }).notNull(),
  },
  (t) => ({
    reportModelUnique: uniqueIndex("provider_billing_report_lines_report_model_uq").on(
      t.reportId,
      t.modelId,
    ),
    reportIdx: index("provider_billing_report_lines_report_idx").on(t.reportId),
  }),
);

export const insertProviderBillingReportSchema = createInsertSchema(
  providerBillingReportsTable,
).omit({ id: true, importedAt: true });
export type InsertProviderBillingReport = z.infer<
  typeof insertProviderBillingReportSchema
>;
export type ProviderBillingReport = typeof providerBillingReportsTable.$inferSelect;
export type ProviderBillingReportLine =
  typeof providerBillingReportLinesTable.$inferSelect;