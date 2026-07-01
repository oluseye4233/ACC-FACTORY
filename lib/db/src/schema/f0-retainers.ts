import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";

/**
 * F0 · Retainer Mode.
 *
 * A retainer keeps the F0 advisor engaged across a build: it drives a task
 * catalog with approvals (see `f0_retainer_tasks`), stage-by-stage F1–F9
 * commentary, and weekly CAPI monitoring with event alerts. Access is open to
 * all staff; billing is dormant behind SUBSCRIPTIONS_ENABLED.
 */
export const F0_RETAINER_STATUSES = ["ACTIVE", "PAUSED", "ENDED"] as const;
export type F0RetainerStatus = (typeof F0_RETAINER_STATUSES)[number];

export const f0RetainersTable = pgTable(
  "f0_retainers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("F0 Retainer"),
    status: text("status").notNull().$type<F0RetainerStatus>().default("ACTIVE"),
    /** Optional HARNESS session this retainer monitors stage-by-stage. */
    sessionId: uuid("session_id").references(() => harnessSessionsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: index("f0_retainers_user_id_idx").on(t.userId),
  }),
);

export const insertF0RetainerSchema = createInsertSchema(f0RetainersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertF0Retainer = z.infer<typeof insertF0RetainerSchema>;
export type F0Retainer = typeof f0RetainersTable.$inferSelect;
