import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * JST = Jobs / Skills / Talent self-assessment ("Know Your Number"), the
 * emotional core of *The Atomic Prompt* onboarding. Each axis is scored 1-10
 * by the reader; the composite (0-100) and band are derived server-side from
 * those three numbers (the reader's self-reported composite is never trusted).
 * History is append-only so the "JST Ascendant" rung can detect growth across
 * a re-assessment.
 */
export const JST_BANDS = ["SEEKER", "BUILDER", "OPERATOR", "ASCENDANT"] as const;
export type JstBand = (typeof JST_BANDS)[number];

export const jstAssessmentsTable = pgTable(
  "jst_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    jobsScore: integer("jobs_score").notNull(),
    skillsScore: integer("skills_score").notNull(),
    talentScore: integer("talent_score").notNull(),
    composite: numeric("composite", { precision: 5, scale: 2 }).notNull(),
    band: varchar("band", { length: 16 }).notNull().$type<JstBand>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("jst_assessments_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export type JstAssessmentRow = typeof jstAssessmentsTable.$inferSelect;
