import { bigint, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Operational metadata only: no private paths, email addresses or provider errors.
export const recoveryFailuresTable = pgTable("recovery_failures", {
  kind: text("kind").$type<"credit" | "preparation">().notNull(),
  resourceId: uuid("resource_id").notNull(),
  scopeId: uuid("scope_id").notNull(), // credit claim token, or immutable upload intent ID
  episodeId: uuid("episode_id").notNull(),
  failures: integer("failures").notNull(),
  lastBucket: bigint("last_bucket", { mode: "number" }).notNull(),
  firstFailedAt: timestamp("first_failed_at", { withTimezone: true }).notNull(),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.kind, t.resourceId, t.scopeId] }),
  index("recovery_failures_pending_idx").on(t.resolvedAt, t.lastFailedAt),
]);

export const recoveryAlertDeliveriesTable = pgTable("recovery_alert_deliveries", {
  episodeId: uuid("episode_id").notNull(),
  recipientHash: text("recipient_hash").notNull(),
  claimToken: uuid("claim_token").notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.episodeId, t.recipientHash] }),
]);
