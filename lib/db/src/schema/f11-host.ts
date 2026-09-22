import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { harnessArtifactsTable } from "./harness-artifacts";
import { harnessSessionsTable } from "./harness-sessions";
import { usersTable } from "./users";

export const f11HostSource = pgEnum("f11_host_source", ["F8_BUNDLE", "F10_HANDOFF", "CHAT_ONLY"]);
export const f11HostState = pgEnum("f11_host_state", [
  "H4_STAGE_REQUESTED",
  "H4_STAGED",
  "H5_VERIFIED",
  "H6_CERTIFIED",
  "H7_PROMOTED",
  "H8_HANDED_OFF",
  "ROLLED_BACK",
  "REFUSED",
]);

/**
 * F11 stores control-plane evidence only. Provider bytes and credentials stay
 * with the provider/Vault; the handle below is an opaque reference fingerprint.
 */
export const f11HostRunsTable = pgTable(
  "f11_host_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull().references(() => harnessSessionsTable.id, { onDelete: "cascade" }),
    planArtifactId: uuid("plan_artifact_id").notNull().references(() => harnessArtifactsTable.id),
    sourceArtifactId: uuid("source_artifact_id").notNull().references(() => harnessArtifactsTable.id),
    source: f11HostSource("source").notNull(),
    provider: text("provider").notNull(),
    adapterId: text("adapter_id").notNull(),
    adapterVersion: text("adapter_version").notNull(),
    accountRef: text("account_ref").notNull(),
    region: text("region").notNull(),
    exactContentHash: text("exact_content_hash").notNull(),
    deploymentSubject: text("deployment_subject").notNull(),
    costCeilingCents: integer("cost_ceiling_cents").notNull(),
    stageConsentId: uuid("stage_consent_id").notNull(),
    stageWriteHash: text("stage_write_hash").notNull(),
    stageVaultRef: text("stage_vault_ref").notNull(),
    rollbackPlan: text("rollback_plan").notNull(),
    humanAttestations: jsonb("human_attestations").notNull(),
    state: f11HostState("state").notNull().default("H4_STAGE_REQUESTED"),
    providerOperationRef: text("provider_operation_ref"),
    stageEvidence: jsonb("stage_evidence"),
    ucgHostEvidence: jsonb("ucg_host_evidence"),
    promotionConsentId: uuid("promotion_consent_id"),
    promotionWriteHash: text("promotion_write_hash"),
    promotionVaultRef: text("promotion_vault_ref"),
    promotionSubject: text("promotion_subject"),
    monitoringRef: text("monitoring_ref"),
    hostReceipt: jsonb("host_receipt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("f11_host_stage_consent_unique").on(table.stageConsentId),
    index("f11_host_tenant_idx").on(table.tenantId, table.createdAt),
    index("f11_host_session_idx").on(table.sessionId, table.createdAt),
  ],
);

export const f11HostEventsTable = pgTable(
  "f11_host_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostRunId: uuid("host_run_id").notNull().references(() => f11HostRunsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    eventType: text("event_type").notNull(),
    evidence: jsonb("evidence").notNull(),
    actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("f11_host_event_run_idx").on(table.hostRunId, table.createdAt)],
);

export type F11HostRun = typeof f11HostRunsTable.$inferSelect;
export type F11HostEvent = typeof f11HostEventsTable.$inferSelect;