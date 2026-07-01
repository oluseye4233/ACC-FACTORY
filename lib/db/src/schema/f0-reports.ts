import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { f0EngagementsTable } from "./f0-engagements";

/**
 * F0 · Business Intelligence Consulting Layer — advisory reports.
 *
 * Each report is produced by the 9-SPC ensemble for one core or boutique
 * service, grounded in its engagement's SOCRATES discovery transcript. Every
 * report carries a mandatory SOLVA bear-case section, range-based financials
 * (bear/base/bull) with the non-suppressible Honesty Gate disclosure, and a
 * report code (`reportCode`) anchored to the engagement artifact's SKU.
 *
 * Reports live in their OWN table — they are NOT harness_artifacts — so the F0
 * advisory layer never pollutes the production-floor artifact catalog.
 */
export const F0_CORE_SERVICES = [
  "PRODUCT_VIABILITY",
  "MARKET_VIABILITY",
  "CAPI_POSITIONING",
  "CUSTOMER_ACQUISITION",
  "GO_TO_MARKET",
  "FINANCIAL_PROJECTIONS",
  "PRODUCT_SYNTHESIS_ADVISORY",
  "OFFICER_ANALYSIS",
] as const;

export const F0_BOUTIQUE_SERVICES = [
  "COMPETITIVE_TEARDOWN",
  "PRICING_STRATEGY",
  "BRAND_NARRATIVE",
  "INVESTOR_READINESS",
] as const;

export const F0_SERVICES = [...F0_CORE_SERVICES, ...F0_BOUTIQUE_SERVICES] as const;
export type F0Service = (typeof F0_SERVICES)[number];

export const f0ReportsTable = pgTable(
  "f0_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => f0EngagementsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    service: text("service").notNull().$type<F0Service>(),
    /** Advisory reference `[CODE]-[SKU]-[TIMESTAMP]` (see lib/sku.ts). */
    reportCode: text("report_code").notNull(),
    /** The owning SKU the report is anchored to (artifact SKU or advisory SKU). */
    sku: text("sku"),
    /** Full report body: ensemble sections, SOLVA bear case, range financials, honesty gate. */
    content: jsonb("content").notNull(),
    /**
     * Dormant per-report charge (USD). Kept for the deferred subscriptions
     * upgrade; access is open to all staff so nothing is charged today.
     */
    accruedCostUsd: numeric("accrued_cost_usd", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engagementIdx: index("f0_reports_engagement_id_idx").on(t.engagementId),
    userIdx: index("f0_reports_user_id_idx").on(t.userId),
  }),
);

export const insertF0ReportSchema = createInsertSchema(f0ReportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertF0Report = z.infer<typeof insertF0ReportSchema>;
export type F0Report = typeof f0ReportsTable.$inferSelect;
