import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const BADGE_IDS = ["ASPE", "AISA", "AISE", "AISA_PWDD", "AISE_BUILD"] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export const BADGE_STATUSES = ["LOCKED", "UNLOCKED", "CLAIMED", "REVOKED"] as const;
export type BadgeStatus = (typeof BADGE_STATUSES)[number];

export interface BadgeRevocationRecord {
  revokedAt: string;
  revokedByUserId: string;
  reason: string;
}

export const commandCentreBadgesTable = pgTable(
  "command_centre_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    badgeId: text("badge_id").notNull().$type<BadgeId>(),
    status: text("status").notNull().default("UNLOCKED").$type<BadgeStatus>(),
    evidence: jsonb("evidence").notNull().default({}),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    revokedByUserId: uuid("revoked_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    revokeHistory: jsonb("revoke_history")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<BadgeRevocationRecord[]>(),
    restoredAt: timestamp("restored_at", { withTimezone: true }),
    restoredByUserId: uuid("restored_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    restoredNote: text("restored_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("badges_user_badge_uniq").on(t.userId, t.badgeId)],
);

export type CommandCentreBadge = typeof commandCentreBadgesTable.$inferSelect;
