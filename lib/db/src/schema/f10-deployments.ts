import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const f10Provider = pgEnum("f10_provider", ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS"]);
export const f10DeploymentState = pgEnum("f10_deployment_state", ["REQUESTED", "QUEUED", "DISPATCHING", "ACKNOWLEDGED", "BLOCKED", "FAILED_PERMANENT", "DEAD_LETTERED"]);
export const f10DeploymentAttemptState = pgEnum("f10_deployment_attempt_state", ["CLAIMED", "ACKNOWLEDGED", "RETRYABLE", "PERMANENT", "FENCED"]);

/** References only: provider credentials are held by the user's authorization flow. */
export const f10ProviderConnectionsTable = pgTable("f10_provider_connections", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull().references(() => usersTable.id),
  provider: f10Provider("provider").notNull(), name: text("name").notNull(), authorizationRef: text("authorization_ref").notNull(),
  authorizationKeyVersion: text("authorization_key_version"),
  scopes: jsonb("scopes").notNull().default([]), active: boolean("active").notNull().default(true),
  reconnectRequiredAt: timestamp("reconnect_required_at", { withTimezone: true }), reconnectReason: text("reconnect_reason"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ nameUniq: uniqueIndex("f10_provider_connection_name_uniq").on(t.tenantId, t.name), tenantIdx: index("f10_provider_connection_tenant_idx").on(t.tenantId) }));

export const f10BundleDeploymentsTable = pgTable("f10_bundle_deployments", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull().references(() => usersTable.id), actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  sourceArtifactId: uuid("source_artifact_id").notNull(), provider: f10Provider("provider").notNull(), target: text("target").notNull(),
  connectionRef: uuid("connection_ref").notNull().references(() => f10ProviderConnectionsTable.id), outputKind: text("output_kind").notNull(),
  bundleHash: text("bundle_hash").notNull(), idempotencyKey: text("idempotency_key").notNull(), policySnapshot: jsonb("policy_snapshot").notNull(),
  state: f10DeploymentState("state").notNull().default("REQUESTED"), attemptCount: integer("attempt_count").notNull().default(0),
  executionStatus: text("execution_status").notNull().default("NOT_CONFIRMED"),
  executionCheckedAt: timestamp("execution_checked_at", { withTimezone: true }),
  providerExecutionUpdatedAt: timestamp("provider_execution_updated_at", { withTimezone: true }),
  reconciliationPausedAt: timestamp("reconciliation_paused_at", { withTimezone: true }),
  reconciliationPauseReason: text("reconciliation_pause_reason"),
  reconciliationPauseNotifiedAt: timestamp("reconciliation_pause_notified_at", { withTimezone: true }),
  reconciliationPauseNotificationClaimedAt: timestamp("reconciliation_pause_notification_claimed_at", { withTimezone: true }),
  reconciliationPauseNotificationRequired: boolean("reconciliation_pause_notification_required").notNull().default(false),
  reconciliationClaimToken: text("reconciliation_claim_token"),
  reconciliationClaimExpiresAt: timestamp("reconciliation_claim_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idemUniq: uniqueIndex("f10_bundle_deployment_idem_uniq").on(t.tenantId, t.idempotencyKey),
  tenantIdx: index("f10_bundle_deployment_tenant_idx").on(t.tenantId),
  reconciliationIdx: index("f10_bundle_deployment_reconciliation_idx").on(t.state, t.executionStatus, t.reconciliationClaimExpiresAt, t.executionCheckedAt),
}));

export const f10BundleDeploymentAttemptsTable = pgTable("f10_bundle_deployment_attempts", {
  id: uuid("id").primaryKey().defaultRandom(), deploymentId: uuid("deployment_id").notNull().references(() => f10BundleDeploymentsTable.id),
  attempt: integer("attempt").notNull(), fenceToken: text("fence_token").notNull(), state: f10DeploymentAttemptState("state").notNull().default("CLAIMED"),
  resultClass: text("result_class"), nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull(), deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ fenceUniq: uniqueIndex("f10_bundle_attempt_fence_uniq").on(t.deploymentId, t.fenceToken), numberUniq: uniqueIndex("f10_bundle_attempt_number_uniq").on(t.deploymentId, t.attempt) }));

export const f10BundleDeploymentReceiptsTable = pgTable("f10_bundle_deployment_receipts", {
  id: uuid("id").primaryKey().defaultRandom(), deploymentId: uuid("deployment_id").notNull().references(() => f10BundleDeploymentsTable.id),
  bundleHash: text("bundle_hash").notNull(), provider: f10Provider("provider").notNull(), target: text("target").notNull(),
  accepted: boolean("accepted").notNull(), providerReceiptId: text("provider_receipt_id"), receiptSignature: text("receipt_signature").notNull(), payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ deploymentUniq: uniqueIndex("f10_bundle_receipt_deployment_uniq").on(t.deploymentId) }));

export const f10BundleDeploymentAuditTable = pgTable("f10_bundle_deployment_audit", {
  id: uuid("id").primaryKey().defaultRandom(), deploymentId: uuid("deployment_id").notNull().references(() => f10BundleDeploymentsTable.id),
  actorId: uuid("actor_id"), fromState: text("from_state"), toState: text("to_state").notNull(), reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ deploymentIdx: index("f10_bundle_audit_deployment_idx").on(t.deploymentId) }));
