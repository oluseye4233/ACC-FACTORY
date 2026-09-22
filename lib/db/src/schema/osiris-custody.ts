import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const OSIRIS_HEALTH_STATES = ["healthy", "degraded", "unknown"] as const;
export type OsirisHealthState = (typeof OSIRIS_HEALTH_STATES)[number];
export const OSIRIS_CUSTODY_STATES = ["active", "lost", "recovered", "expired"] as const;
export type OsirisCustodyState = (typeof OSIRIS_CUSTODY_STATES)[number];
export const OSIRIS_EVENT_TYPES = [
  "registered",
  "health",
  "custody",
  "deviation",
  "calibration",
  "recovery",
  "expired",
] as const;
export type OsirisEventType = (typeof OSIRIS_EVENT_TYPES)[number];

/**
 * F9.5 custody deliberately has no FK to F9. F9 can evolve its persistence
 * independently; machineArtifactId plus these immutable source snapshots are
 * the stable hand-off contract.
 */
export const osirisCustodiesTable = pgTable(
  "osiris_custodies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineArtifactId: uuid("machine_artifact_id").notNull(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
    sourceHash: text("source_hash").notNull(),
    sourceSignature: text("source_signature").notNull(),
    artifactVersion: text("artifact_version").notNull(),
    mediaType: text("media_type").notNull(),
    telemetryContract: jsonb("telemetry_contract").notNull(),
    health: text("health").notNull().$type<OsirisHealthState>().default("unknown"),
    custodyState: text("custody_state").notNull().$type<OsirisCustodyState>().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastTelemetryAt: timestamp("last_telemetry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("osiris_custodies_machine_artifact_unique").on(table.machineArtifactId),
    index("osiris_custodies_owner_idx").on(table.ownerUserId),
    index("osiris_custodies_org_idx").on(table.organizationId),
  ],
);

export const osirisCustodyEventsTable = pgTable(
  "osiris_custody_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    custodyId: uuid("custody_id").notNull().references(() => osirisCustodiesTable.id, { onDelete: "cascade" }),
    machineArtifactId: uuid("machine_artifact_id").notNull(),
    eventType: text("event_type").notNull().$type<OsirisEventType>(),
    health: text("health").$type<OsirisHealthState>(),
    custodyState: text("custody_state").$type<OsirisCustodyState>(),
    reason: text("reason").notNull(),
    lineage: jsonb("lineage").notNull(),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("osiris_custody_events_custody_idx").on(table.custodyId, table.occurredAt),
    index("osiris_custody_events_artifact_idx").on(table.machineArtifactId, table.occurredAt),
  ],
);

export const osirisDeviationsTable = pgTable(
  "osiris_deviations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    custodyId: uuid("custody_id").notNull().references(() => osirisCustodiesTable.id, { onDelete: "cascade" }),
    machineArtifactId: uuid("machine_artifact_id").notNull(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    detail: text("detail").notNull(),
    lineage: jsonb("lineage").notNull(),
    routedTo: text("routed_to").notNull().default("SOLVA_F0"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("osiris_deviations_owner_idx").on(table.ownerUserId, table.createdAt)],
);

export const osirisCalibrationsTable = pgTable(
  "osiris_calibrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    custodyId: uuid("custody_id").notNull().references(() => osirisCustodiesTable.id, { onDelete: "cascade" }),
    machineArtifactId: uuid("machine_artifact_id").notNull(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
    recommendation: text("recommendation").notNull(),
    lineage: jsonb("lineage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("osiris_calibrations_owner_idx").on(table.ownerUserId, table.createdAt)],
);

export const insertOsirisCustodySchema = createInsertSchema(osirisCustodiesTable).omit({
  id: true,
  createdAt: true,
  health: true,
  custodyState: true,
  lastTelemetryAt: true,
});
export type InsertOsirisCustody = z.infer<typeof insertOsirisCustodySchema>;
export type OsirisCustody = typeof osirisCustodiesTable.$inferSelect;
export type OsirisCustodyEvent = typeof osirisCustodyEventsTable.$inferSelect;
export type OsirisDeviation = typeof osirisDeviationsTable.$inferSelect;
export type OsirisCalibration = typeof osirisCalibrationsTable.$inferSelect;