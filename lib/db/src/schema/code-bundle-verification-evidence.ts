import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessArtifactsTable } from "./harness-artifacts";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";

export const codeBundleVerificationEvidenceTable = pgTable(
  "code_bundle_verification_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceArtifactId: uuid("source_artifact_id")
      .notNull()
      .references(() => harnessArtifactsTable.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    evidenceKind: text("evidence_kind").notNull().$type<"CI" | "IDE_TEST">(),
    passed: boolean("passed").notNull().default(true),
    runReference: text("run_reference").notNull(),
    command: text("command").notNull(),
    summary: text("summary").notNull(),
    evidencePayload: jsonb("evidence_payload"),
    evidenceHash: text("evidence_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const insertCodeBundleVerificationEvidenceSchema = createInsertSchema(
  codeBundleVerificationEvidenceTable,
).omit({ id: true, createdAt: true });
export type InsertCodeBundleVerificationEvidence = z.infer<
  typeof insertCodeBundleVerificationEvidenceSchema
>;
export type CodeBundleVerificationEvidence =
  typeof codeBundleVerificationEvidenceTable.$inferSelect;