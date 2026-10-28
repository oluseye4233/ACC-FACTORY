import { boolean, check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const emailDeliverySettingsTable = pgTable("email_delivery_settings", {
  scopeKey: text("scope_key").primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("MANAGED"),
  provider: text("provider"),
  senderName: text("sender_name"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
  credentialEncrypted: text("credential_encrypted"),
  status: text("status").notNull().default("ACTIVE"),
  revision: uuid("revision").notNull().defaultRandom(),
  verificationId: uuid("verification_id"),
  verificationHash: text("verification_hash"),
  verificationUserId: uuid("verification_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
  verificationAttempts: integer("verification_attempts").notNull().default(0),
  verificationSent: boolean("verification_sent").notNull().default(false),
  testWindowStart: timestamp("test_window_start", { withTimezone: true }),
  testCount: integer("test_count").notNull().default(0),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("email_delivery_exact_scope", sql`
  (${table.userId} IS NOT NULL AND ${table.organizationId} IS NULL AND ${table.scopeKey} = 'user:' || ${table.userId}::text)
  OR (${table.userId} IS NULL AND ${table.organizationId} IS NOT NULL AND ${table.scopeKey} = 'org:' || ${table.organizationId}::text)
`)]);
