import { boolean, integer, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const SUBSCRIBER_TIERS = ["EXPLORER", "PRACTITIONER", "ARCHITECT", "INSTITUTION"] as const;
export type SubscriberTier = (typeof SUBSCRIBER_TIERS)[number];

export const commandCentreSubscribersTable = pgTable("command_centre_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tier: text("tier").notNull().default("EXPLORER").$type<SubscriberTier>(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  status: text("status").notNull().default("inactive"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),

  f1Today: integer("f1_today").notNull().default(0),
  f2Today: integer("f2_today").notNull().default(0),
  f3Today: integer("f3_today").notNull().default(0),
  f4Today: integer("f4_today").notNull().default(0),
  f5Today: integer("f5_today").notNull().default(0),
  f6Today: integer("f6_today").notNull().default(0),
  f7Today: integer("f7_today").notNull().default(0),
  f8Today: integer("f8_today").notNull().default(0),
  limitsResetAt: timestamp("limits_reset_at", { withTimezone: true }).notNull().defaultNow(),

  // Per-subscriber monthly LLM cost cap override (USD). NULL = use the tier
  // default from MONTHLY_COST_CAP_USD in lib/tier.ts. Admins can set this to
  // raise (or temporarily lower) a specific account's runaway-spend ceiling
  // without changing the tier defaults for everyone else.
  monthlyCostCapUsdOverride: numeric("monthly_cost_cap_usd_override", {
    precision: 12,
    scale: 2,
  }),

  // F1000 soft-launch promo membership. Set true when an F1000 invite code is
  // redeemed. Drives the $39-off Practitioner coupon at checkout and the
  // one-click Architect on-ramp shown when the $49 AI-usage cap is reached.
  f1000Member: boolean("f1000_member").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSubscriberSchema = createInsertSchema(commandCentreSubscribersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof commandCentreSubscribersTable.$inferSelect;
