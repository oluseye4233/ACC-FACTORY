import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessSessionsTable } from "./harness-sessions";

export const FEATURE_STATUSES = ["LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETE"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const harnessFeatureStateTable = pgTable(
  "harness_feature_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
    featureId: integer("feature_id").notNull(),
    status: text("status").notNull().default("LOCKED").$type<FeatureStatus>(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    sessionFeatureIdx: uniqueIndex("harness_feature_state_session_feature_idx").on(
      t.sessionId,
      t.featureId,
    ),
  }),
);

export const insertHarnessFeatureStateSchema = createInsertSchema(harnessFeatureStateTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertHarnessFeatureState = z.infer<typeof insertHarnessFeatureStateSchema>;
export type HarnessFeatureState = typeof harnessFeatureStateTable.$inferSelect;
