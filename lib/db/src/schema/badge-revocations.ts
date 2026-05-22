import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const badgeRevocationsTable = pgTable(
  "badge_revocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "set null" }),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    badgeId: text("badge_id").notNull(),
    reason: text("reason").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("badge_revocations_target_idx").on(t.targetUserId),
    index("badge_revocations_revoked_at_idx").on(t.revokedAt),
  ],
);

export type BadgeRevocation = typeof badgeRevocationsTable.$inferSelect;
