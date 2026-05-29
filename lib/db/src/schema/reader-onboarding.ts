import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Reader-onboarding track. A reader of *The Atomic Prompt* who claims a reader
 * code is placed on the `atomic_prompt_v1` onboarding track so the platform can
 * surface the Ascension Protocol journey organically. One row per user.
 */
export const ONBOARDING_TRACKS = ["default", "atomic_prompt_v1"] as const;
export type OnboardingTrack = (typeof ONBOARDING_TRACKS)[number];

export const readerOnboardingTable = pgTable("reader_onboarding", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  track: varchar("track", { length: 32 })
    .notNull()
    .default("default")
    .$type<OnboardingTrack>(),
  readerCode: varchar("reader_code", { length: 64 }),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ReaderOnboardingRow = typeof readerOnboardingTable.$inferSelect;
