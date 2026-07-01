import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { harnessSessionsTable } from "./harness-sessions";
import { harnessArtifactsTable } from "./harness-artifacts";

/**
 * F0 · Business Intelligence Consulting Layer (Domain 23) — engagements.
 *
 * An F0 engagement is a boutique advisory case that sits OUTSIDE the F1–F9
 * production floor and never modifies it. Every engagement opens with the
 * SOCRATES 7-question Discovery Session (`discoveryTranscript`) and closes with
 * the SOCRATES "what would make you NOT proceed?" challenge (`challengeResponse`).
 * Reports (see `f0_reports`) are grounded in the recorded discovery transcript;
 * no report is produced before discovery is recorded.
 *
 * An engagement can optionally anchor to a HARNESS session and/or a specific
 * artifact (so report codes anchor to that artifact's SKU), but F0 is advisory
 * only — it reads production-floor artifacts, it never writes them.
 */
export const F0_ENGAGEMENT_STATUSES = ["DISCOVERY", "ACTIVE", "CLOSED"] as const;
export type F0EngagementStatus = (typeof F0_ENGAGEMENT_STATUSES)[number];

export const f0EngagementsTable = pgTable(
  "f0_engagements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Engagement"),
    status: text("status").notNull().$type<F0EngagementStatus>().default("DISCOVERY"),
    /** Optional HARNESS session this engagement advises on. */
    sessionId: uuid("session_id").references(() => harnessSessionsTable.id, {
      onDelete: "set null",
    }),
    /** Optional artifact whose SKU anchors this engagement's report codes. */
    artifactId: uuid("artifact_id").references(() => harnessArtifactsTable.id, {
      onDelete: "set null",
    }),
    /** SOCRATES discovery: the 7 questions and the operator's recorded answers. */
    discoveryTranscript: jsonb("discovery_transcript"),
    /** SOCRATES close: the "what would make you NOT proceed?" challenge + answer. */
    challengeResponse: jsonb("challenge_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: index("f0_engagements_user_id_idx").on(t.userId),
    sessionIdx: index("f0_engagements_session_id_idx").on(t.sessionId),
  }),
);

export const insertF0EngagementSchema = createInsertSchema(f0EngagementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertF0Engagement = z.infer<typeof insertF0EngagementSchema>;
export type F0Engagement = typeof f0EngagementsTable.$inferSelect;
