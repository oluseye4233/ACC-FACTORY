import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  "ATLAS_PDD_JSON",
  "MVP_PDD",
  "CODEBASE_BUNDLE",
  "PFP_REPORT",
  "HOSTING_PLAN",
  "ATLAS_360_PLAN_VIEW",
  "ATLAS_360_SCAN_VIEW",
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
  name: text("name"),
  artifactContent: jsonb("artifact_content").notNull(),
  // Structured score explanations for any JCSE/MATHMON scores carried by this artifact.
  scorecards: jsonb("scorecards").$type<unknown[]>().notNull().default([]),
  // Universal SKU Catalog (D24 · SKU-002). Canonical identity issued at publish
  // for SKU-eligible artifact types (SPC, MVP_PDD). Format:
  //   ARK-[TYPE:3]-[SECTOR:3]-[CREATORHASH:6]-[SEQ:4]-V[VER]
  // Nullable: intermediate artifact types never carry a SKU, and pre-existing
  // eligible rows are backfilled. Unique across the catalog.
  sku: text("sku").unique(),
  jcseScore: integer("jcse_score"),
  certTier: text("cert_tier"),
  groState: text("gro_state").notNull().default("SAFE_LIFE"),
  spartanCert: jsonb("spartan_cert"),
  // MATHMON / FORGE VERIFIED gate (D26 · MM-FV). Set once at F7 certification.
  // mathmonScore is the server-recomputed composite from the session's MAP
  // (mathCoherence×0.40 + applicability×0.35 + predictiveReliability×0.25),
  // never the model's self-report. forgeVerified is the absolute gate result:
  // (sessionJcse ≥ 45 AND mathmonScore ≥ 70). Both are null/false on artifacts
  // that never ran the gate.
  mathmonScore: integer("mathmon_score"),
  forgeVerified: boolean("forge_verified").notNull().default(false),
  spcOrigin: text("spc_origin").notNull().default("artisanal").$type<"artisanal" | "digitally_evolved">(),
  provider: text("provider"),
  modelId: text("model_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHarnessArtifactSchema = createInsertSchema(harnessArtifactsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHarnessArtifact = z.infer<typeof insertHarnessArtifactSchema>;
export type HarnessArtifact = typeof harnessArtifactsTable.$inferSelect;
