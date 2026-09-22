import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const f10ColonizationState = pgEnum("f10_colonization_state", ["RUNNING", "REFUSED", "STAGED_ONLY", "PROMOTED"]);
export const f10ColonizationPhase = pgEnum("f10_colonization_phase", ["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
export const f10ColonizationConsentPurpose = pgEnum("f10_colonization_consent_purpose", ["STAGE", "PROMOTION"]);

export const f10ColonizationRunsTable = pgTable("f10_colonization_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: text("run_id").notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => usersTable.id),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  requestClass: text("request_class").notNull(),
  artifactRef: text("artifact_ref").notNull(),
  artifactHash: text("artifact_hash").notNull(),
  artifactClass: text("artifact_class").notNull(),
  ucgCertificateRef: text("ucg_certificate_ref").notNull(),
  target: text("target").notNull(),
  targetClass: text("target_class").notNull(),
  connectorAdapter: text("connector_adapter").notNull(),
  customizationSet: jsonb("customization_set").notNull().default({}),
  f9AttestationRef: text("f9_attestation_ref"),
  consentChannel: text("consent_channel").notNull(),
  deploymentSubject: text("deployment_subject"),
  ucgColCertificate: jsonb("ucg_col_certificate"),
  stageConsent: jsonb("stage_consent"),
  promotionConsent: jsonb("promotion_consent"),
  vaultHandle: jsonb("vault_handle"),
  state: f10ColonizationState("state").notNull().default("RUNNING"),
  phase: f10ColonizationPhase("phase").notNull().default("C0"),
  maxReachablePhase: f10ColonizationPhase("max_reachable_phase").notNull().default("C8"),
  groMode: text("gro_mode").notNull().default("SAFE_LIFE"),
  phaseStatuses: jsonb("phase_statuses").notNull(),
  adapterReadiness: jsonb("adapter_readiness").notNull(),
  refusal: jsonb("refusal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  runUniq: uniqueIndex("f10_colonization_run_id_uniq").on(t.runId),
  tenantIdx: index("f10_colonization_tenant_idx").on(t.tenantId),
}));

export type F10ColonizationRun = typeof f10ColonizationRunsTable.$inferSelect;

export const f10ColonizationConsentsTable = pgTable("f10_colonization_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  consentId: uuid("consent_id").notNull(),
  runId: uuid("run_id").notNull().references(() => f10ColonizationRunsTable.id),
  tenantId: uuid("tenant_id").notNull().references(() => usersTable.id),
  purpose: f10ColonizationConsentPurpose("purpose").notNull(),
  deploymentSubject: text("deployment_subject").notNull(),
  exactWriteHash: text("exact_write_hash").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  consentOnce: uniqueIndex("f10_colonization_consent_once_uniq").on(t.consentId),
  runPurposeOnce: uniqueIndex("f10_colonization_run_purpose_once_uniq").on(t.runId, t.purpose),
  tenantIdx: index("f10_colonization_consent_tenant_idx").on(t.tenantId),
}));