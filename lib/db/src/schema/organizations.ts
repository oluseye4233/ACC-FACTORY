import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ORG_MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];

export const ORG_SUBSCRIPTION_TIER = "INSTITUTION" as const;

export const organizationsTable = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),

    // Stripe — one customer + one team-seat sub per org.
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    seatsPurchased: integer("seats_purchased").notNull().default(0),
    status: text("status").notNull().default("inactive"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugUniq: uniqueIndex("organizations_slug_uniq").on(t.slug),
    stripeCustomerIdx: index("organizations_stripe_customer_id_idx").on(t.stripeCustomerId),
  }),
);

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const organizationMembersTable = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<OrgMemberRole>().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.userId] }),
    userIdx: index("organization_members_user_id_idx").on(t.userId),
  }),
);
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;

export const organizationInvitesTable = pgTable(
  "organization_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: text("role").notNull().$type<OrgMemberRole>().default("member"),
    token: varchar("token", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUniq: uniqueIndex("organization_invites_token_uniq").on(t.token),
    orgIdx: index("organization_invites_org_id_idx").on(t.organizationId),
  }),
);
export type OrganizationInvite = typeof organizationInvitesTable.$inferSelect;
