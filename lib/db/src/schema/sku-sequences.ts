import { integer, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Universal SKU Catalog (D24 · SKU-002) — monotonic sequence counters.
 *
 * One row per (creatorHash, productType, sector) combination holds the last
 * issued sequence number. SKU issuance increments this atomically via an
 * `INSERT … ON CONFLICT DO UPDATE SET seq = seq + 1 RETURNING seq` upsert so
 * concurrent publishes can never mint duplicate sequence numbers for the same
 * combination. Keeps SKU issuance deterministic and collision-safe.
 */
export const skuSequencesTable = pgTable(
  "sku_sequences",
  {
    creatorHash: varchar("creator_hash", { length: 6 }).notNull(),
    productType: varchar("product_type", { length: 3 }).notNull(),
    sector: varchar("sector", { length: 3 }).notNull(),
    seq: integer("seq").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.creatorHash, t.productType, t.sector] }),
  }),
);

export const insertSkuSequenceSchema = createInsertSchema(skuSequencesTable);
export type InsertSkuSequence = z.infer<typeof insertSkuSequenceSchema>;
export type SkuSequence = typeof skuSequencesTable.$inferSelect;
