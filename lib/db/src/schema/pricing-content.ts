import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pricingContentTable = pgTable("pricing_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  content: jsonb("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPricingContentSchema = createInsertSchema(pricingContentTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertPricingContent = z.infer<typeof insertPricingContentSchema>;
export type PricingContent = typeof pricingContentTable.$inferSelect;
