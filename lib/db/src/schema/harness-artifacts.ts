import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";

export const ARTIFACT_TYPES = [
  "PROMPT_DIAGNOSTIC",
  "ATOMIC_PROMPT",
  "MA_BIRTH_PACKAGE",
  "MICRO_PDD",
  "SPC",
  "ATLAS_PDD",
  "MVP_PDD",
  "CODEBASE_BUNDLE",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const harnessArtifactsTable = pgTable("harness_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  featureId: integer("feature_id").notNull(),
  artifactType: text("artifact_type").notNull().$type<ArtifactType>(),
  artifactContent: jsonb("artifact_content").notNull(),
  jcseScore: integer("jcse_score"),
  certTier: text("cert_tier"),
  groState: text("gro_state").notNull().default("SAFE_LIFE"),
  spartanCert: jsonb("spartan_cert"),
  spcOrigin: text("spc_origin").notNull().default("artisanal").$type<"artisanal" | "digitally_evolved">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHarnessArtifactSchema = createInsertSchema(harnessArtifactsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHarnessArtifact = z.infer<typeof insertHarnessArtifactSchema>;
export type HarnessArtifact = typeof harnessArtifactsTable.$inferSelect;
