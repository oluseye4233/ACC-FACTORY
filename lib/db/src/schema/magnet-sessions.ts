import { boolean, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Anonymous, pre-auth "acquisition magnet" runs (D25).
 *
 * Two lightweight public tools funnel anonymous visitors toward the staff front
 * door: the Test Kit (returns a coarse quality band) and the Savings Calculator
 * (returns a compression-savings percentage RANGE). Neither result exposes a raw
 * numeric score — the band/range is always recomputed server-side.
 *
 * These rows are TELEMETRY ONLY. The visitor's submitted prompt/artifact text is
 * NEVER persisted here (ephemeral by design); we keep only a character count, an
 * IP hash for rate-limit/abuse forensics, an optional email, and the coarse
 * outcome. `rawScore` is stored for internal audit but is never returned to the
 * client.
 */
export const magnetSessionsTable = pgTable(
  "magnet_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Which magnet produced this row.
    tool: text("tool").notNull(), // 'test_kit' | 'calculator'
    // SHA-256 of the client IP — never the raw IP (privacy + abuse forensics).
    ipHash: text("ip_hash").notNull(),
    // Optional email the visitor typed (attribution / follow-up). Never required.
    email: text("email"),
    // Length of the submitted text. The text itself is intentionally not stored.
    inputChars: integer("input_chars").notNull().default(0),
    // Test Kit outcome (coarse band). Null for calculator runs.
    band: text("band"), // 'LITE-PASS' | 'LITE-REVIEW' | 'LITE-FAIL'
    // Calculator outcome (savings RANGE). Null for test-kit runs.
    savingsLowPct: integer("savings_low_pct"),
    savingsHighPct: integer("savings_high_pct"),
    compressionClass: text("compression_class"), // 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
    // Server-only raw score behind the band/range. NEVER returned to the client.
    rawScore: integer("raw_score"),
    provider: text("provider"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    // Conversion telemetry: flipped when the visitor clicks through to the front door.
    converted: boolean("converted").notNull().default(false),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Backs the funnel/conversion reporting and any per-tool time-series.
    toolCreatedIdx: index("magnet_sessions_tool_created_idx").on(t.tool, t.createdAt),
  }),
);

export type MagnetSession = typeof magnetSessionsTable.$inferSelect;
