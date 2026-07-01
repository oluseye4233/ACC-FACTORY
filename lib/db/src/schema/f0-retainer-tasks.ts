import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { f0RetainersTable } from "./f0-retainers";

/**
 * F0 · Retainer task catalog with approvals.
 *
 * The advisor proposes advisory tasks (PROPOSED); the operator approves or
 * declines them before any work runs (APPROVED / DECLINED), and completed work
 * is marked COMPLETED. Tasks may pin to a production stage (F1–F9) so the
 * retainer can drive stage-by-stage commentary. `estCostUsd` is a dormant
 * estimate for the deferred subscriptions upgrade — nothing is charged today.
 */
export const F0_RETAINER_TASK_STATUSES = [
  "PROPOSED",
  "APPROVED",
  "DECLINED",
  "COMPLETED",
] as const;
export type F0RetainerTaskStatus = (typeof F0_RETAINER_TASK_STATUSES)[number];

export const f0RetainerTasksTable = pgTable(
  "f0_retainer_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    retainerId: uuid("retainer_id")
      .notNull()
      .references(() => f0RetainersTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    status: text("status").notNull().$type<F0RetainerTaskStatus>().default("PROPOSED"),
    /** Optional production stage this task pins to (e.g. "F1".."F9"). */
    stage: text("stage"),
    /** Dormant advisory estimate (USD); billing deferred behind SUBSCRIPTIONS_ENABLED. */
    estCostUsd: numeric("est_cost_usd", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    retainerIdx: index("f0_retainer_tasks_retainer_id_idx").on(t.retainerId),
  }),
);

export const insertF0RetainerTaskSchema = createInsertSchema(f0RetainerTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertF0RetainerTask = z.infer<typeof insertF0RetainerTaskSchema>;
export type F0RetainerTask = typeof f0RetainerTasksTable.$inferSelect;
