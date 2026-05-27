import {
  boolean,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

/**
 * Per-user notification preferences. One row per (userId, orgId).
 * orgId NULL = personal-scope preferences (billing/high-cost alerts on the
 * user's own subscription). orgId set = org-scope (only meaningful for
 * owner/admin members — those rows are what the weekly digest cron reads).
 *
 * `unsubscribeToken` is a one-shot opaque token that flips all three flags
 * off when GET'd, so transactional emails can include a footer link that
 * works without a login.
 */
export const notificationPreferencesTable = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    billingAlertsEnabled: boolean("billing_alerts_enabled").notNull().default(true),
    highCostAlertsEnabled: boolean("high_cost_alerts_enabled").notNull().default(false),
    highCostThresholdUsd: numeric("high_cost_threshold_usd", { precision: 8, scale: 2 })
      .notNull()
      .default("1.00"),
    unsubscribeToken: varchar("unsubscribe_token", { length: 64 }).notNull(),
    lastDigestSentAt: timestamp("last_digest_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userOrgUniq: uniqueIndex("notification_preferences_user_org_uniq").on(
      t.userId,
      t.organizationId,
    ),
    tokenUniq: uniqueIndex("notification_preferences_token_uniq").on(t.unsubscribeToken),
    userIdx: index("notification_preferences_user_id_idx").on(t.userId),
  }),
);

export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
