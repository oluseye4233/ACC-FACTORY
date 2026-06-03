import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * F1000 ("First 1000") soft-launch invite pool. Exactly 1000 rows are
 * pre-seeded with `seq` 1..1000 and an unguessable `code`. The single public
 * QR code points at /f1000; activating it hands out the next AVAILABLE code
 * (status -> 'issued'), and redeeming it after sign-up binds the code to a
 * user (status -> 'redeemed') and flips the subscriber's `f1000Member` flag.
 *
 * `issued` codes that are never redeemed are recycled back to `available`
 * after 48h (see routes/f1000.ts) so a scanner that bails can't permanently
 * lock a slot. The pool is strictly capped at 1000 — once every code is
 * 'redeemed', the offer is closed.
 */
export const F1000_INVITE_STATUSES = ["available", "issued", "redeemed"] as const;
export type F1000InviteStatus = (typeof F1000_INVITE_STATUSES)[number];

export const f1000InvitesTable = pgTable("command_centre_f1000_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  seq: integer("seq").notNull().unique(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("available").$type<F1000InviteStatus>(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  redeemedByUserId: uuid("redeemed_by_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  // Enforce one redeemed seat per account at the DB level so two concurrent
  // redeem requests from the same user can't each bind a different code.
  uniqueIndex("f1000_invites_redeemed_by_user_idx")
    .on(table.redeemedByUserId)
    .where(sql`${table.redeemedByUserId} IS NOT NULL`),
]);

export const insertF1000InviteSchema = createInsertSchema(f1000InvitesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertF1000Invite = z.infer<typeof insertF1000InviteSchema>;
export type F1000Invite = typeof f1000InvitesTable.$inferSelect;
