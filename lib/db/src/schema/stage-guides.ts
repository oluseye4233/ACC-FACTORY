import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const stageGuidesTable = pgTable("stage_guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageKey: text("stage_key").notNull(),
  kind: text("kind").notNull(),
  version: integer("version").notNull(),
  script: text("script").notNull(),
  state: text("state").notNull().default("DRAFT"),
  providerVideoId: uuid("provider_video_id"),
  isTest: boolean("is_test").notNull().default(true),
  generationStartedAt: timestamp("generation_started_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => usersTable.id),
  publishedByUserId: uuid("published_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("stage_guides_variant_version").on(t.stageKey, t.kind, t.version)]);
