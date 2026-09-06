import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Permanent ARK-X-to-ACC account link. This is deliberately a separate record
 * from an assertion redemption: a linked account can use a later, fresh
 * eligibility assertion (for example, when re-subscribing).
 */
export const arkXAccountLinksTable = pgTable(
  "ark_x_account_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    arkSubject: text("ark_subject").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ark_x_account_links_subject_idx").on(table.arkSubject),
    uniqueIndex("ark_x_account_links_user_idx").on(table.userId),
  ],
);

/**
 * A completed one-time assertion redemption. `arkSubject` is audit context,
 * not an account-link uniqueness constraint; only `jti` is one-time.
 */
export const arkXRedemptionsTable = pgTable(
  "command_centre_ark_x_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jti: text("jti").notNull(),
    arkSubject: text("ark_subject").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    checkoutSessionId: varchar("checkout_session_id", { length: 255 }).notNull(),
    checkoutStatus: text("checkout_status").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ark_x_redemptions_jti_idx").on(table.jti)],
);

export type ArkXAccountLink = typeof arkXAccountLinksTable.$inferSelect;
export type ArkXRedemption = typeof arkXRedemptionsTable.$inferSelect;