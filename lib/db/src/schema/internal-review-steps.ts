import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

/** Private adapter checkpoints, not publication/approval/certification evidence. */
export const internalReviewStepsTable = pgTable("internal_review_steps", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  inputHash: text("input_hash").notNull(),
  phase: text("phase").notNull().default("READY"),
  result: jsonb("result"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertInternalReviewStepSchema = createInsertSchema(internalReviewStepsTable).omit({ updatedAt: true });
export type InternalReviewStep = typeof internalReviewStepsTable.$inferSelect;
