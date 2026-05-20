import {
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { harnessArtifactsTable } from "./harness-artifacts";

export const CONTEXT_CRAFT_PILLARS = [
  "SYSTEM",
  "ROLE",
  "INSTRUCTION",
  "DATA",
  "FORMAT",
  "EXAMPLE",
  "CONSTRAINT",
] as const;
export type ContextCraftPillar = (typeof CONTEXT_CRAFT_PILLARS)[number];

export const PILLAR_LETTERS: Record<ContextCraftPillar, string> = {
  SYSTEM: "S",
  ROLE: "R",
  INSTRUCTION: "I",
  DATA: "D",
  FORMAT: "F",
  EXAMPLE: "E",
  CONSTRAINT: "C",
};

export const contextCraftBadgesTable = pgTable(
  "context_craft_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    pillar: varchar("pillar", { length: 16 })
      .notNull()
      .$type<ContextCraftPillar>(),
    bestScore: integer("best_score").notNull(),
    evidenceArtifactId: uuid("evidence_artifact_id").references(
      () => harnessArtifactsTable.id,
      { onDelete: "set null" },
    ),
    firstEarnedAt: timestamp("first_earned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userPillarUnique: unique("context_craft_badges_user_pillar_unique").on(
      t.userId,
      t.pillar,
    ),
  }),
);

export type ContextCraftBadgeRow = typeof contextCraftBadgesTable.$inferSelect;
