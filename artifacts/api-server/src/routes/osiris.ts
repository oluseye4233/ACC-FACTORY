import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  osirisCalibrationsTable,
  osirisCustodiesTable,
  osirisCustodyEventsTable,
  osirisDeviationsTable,
  organizationMembersTable,
  f9MechaRunsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getOsirisCustodyAttestation } from "../lib/osiris";

const router: IRouter = Router();
const uuid = z.string().uuid();
const custodyBody = z.object({
  machineArtifactId: uuid,
  sourceHash: z.string().min(1),
  sourceSignature: z.string().min(1),
  artifactVersion: z.string().min(1),
  mediaType: z.string().min(1),
  telemetryContract: z.record(z.string(), z.unknown()),
  expiresAt: z.coerce.date(),
  organizationId: uuid.optional(),
});
const telemetryBody = z.object({
  health: z.enum(["healthy", "degraded", "unknown"]),
  // Recovery and expiry are privileged/system transitions with dedicated
  // paths. Telemetry can only report custody loss.
  custodyState: z.literal("lost").optional(),
  reason: z.string().min(1),
  metrics: z.record(z.string(), z.unknown()).optional(),
  deviation: z
    .object({
      severity: z.string().min(1),
      category: z.string().min(1),
      detail: z.string().min(1),
    })
    .optional(),
  calibration: z.string().min(1).optional(),
});

async function canAccess(
  userId: string,
  ownerUserId: string,
  organizationId: string | null,
): Promise<boolean> {
  if (userId === ownerUserId) return true;
  if (!organizationId) return false;
  const member = await db
    .select({ userId: organizationMembersTable.userId })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.userId, userId),
        eq(organizationMembersTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(member[0]);
}

async function isOrganizationMember(userId: string, organizationId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: organizationMembersTable.userId })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.userId, userId),
        eq(organizationMembersTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

async function loadVisibleCustody(userId: string, id: string) {
  const rows = await db
    .select()
    .from(osirisCustodiesTable)
    .where(eq(osirisCustodiesTable.id, id))
    .limit(1);
  const custody = rows[0];
  if (!custody || !(await canAccess(userId, custody.ownerUserId, custody.organizationId))) return null;
  return custody;
}

function lineage(custody: {
  id: string;
  machineArtifactId: string;
  sourceHash: string;
  sourceSignature: string;
  artifactVersion: string;
}) {
  return {
    custodyId: custody.id,
    machineArtifactId: custody.machineArtifactId,
    sourceHash: custody.sourceHash,
    sourceSignature: custody.sourceSignature,
    artifactVersion: custody.artifactVersion,
    routedFrom: "OSIRIS",
    routedTo: "SOLVA_F0",
  };
}

/**
 * F9.5 OSIRIS: source bytes and signatures are never accepted again after
 * registration. Every observation is an append-only event and only the
 * custody's derived state is updated.
 */
router.post("/osiris/custodies", requireAuth, async (req, res): Promise<void> => {
  const parsed = custodyBody.safeParse(req.body);
  if (!parsed.success || parsed.data.expiresAt <= new Date()) {
    res.status(400).json({ error: "Invalid custody contract or expiry" });
    return;
  }
  const input = parsed.data;
  const [f9Run] = await db
    .select()
    .from(f9MechaRunsTable)
    .where(and(
      eq(f9MechaRunsTable.id, input.machineArtifactId),
      eq(f9MechaRunsTable.userId, req.localUser!.id),
      eq(f9MechaRunsTable.status, "EMITTED"),
    ))
    .limit(1);
  // Legacy custody records may predate F9 run persistence. Whenever the
  // public ID resolves to an F9 run, however, registration is strictly bound
  // to that tenant's immutable snapshot.
  if (f9Run && (f9Run.payloadHash !== input.sourceHash || f9Run.artifactSignature !== input.sourceSignature || f9Run.artifactVersion !== input.artifactVersion)) {
    res.status(409).json({ error: "Custody source hash, signature, and version must match the emitted F9 artifact for this tenant" });
    return;
  }
  if (input.organizationId && !(await isOrganizationMember(req.localUser!.id, input.organizationId))) {
    res.status(403).json({ error: "Organization membership required" });
    return;
  }
  try {
    const custody = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(osirisCustodiesTable)
        .values({
          ...input,
          ownerUserId: req.localUser!.id,
          organizationId: input.organizationId ?? null,
        })
        .returning();
      if (!created) throw new Error("Custody registration failed");
      await tx.insert(osirisCustodyEventsTable).values({
        custodyId: created.id,
        machineArtifactId: created.machineArtifactId,
        eventType: "registered",
        custodyState: "active",
        reason: "F9 Machine Artifact registered into OSIRIS custody",
        lineage: lineage(created),
        actorUserId: req.localUser!.id,
      });
      return created;
    });
    res.status(201).json(custody);
  } catch (error) {
    if (String(error).includes("osiris_custodies_machine_artifact_unique")) {
      res.status(409).json({ error: "Machine Artifact is already in custody" });
      return;
    }
    throw error;
  }
});

router.get("/osiris/custodies", requireAuth, async (req, res): Promise<void> => {
  const orgIds = (
    await db
      .select({ organizationId: organizationMembersTable.organizationId })
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.userId, req.localUser!.id))
  ).map((row) => row.organizationId);
  const conditions = orgIds.length
    ? or(eq(osirisCustodiesTable.ownerUserId, req.localUser!.id), inArray(osirisCustodiesTable.organizationId, orgIds))
    : eq(osirisCustodiesTable.ownerUserId, req.localUser!.id);
  const rows = await db
    .select()
    .from(osirisCustodiesTable)
    .where(conditions)
    .orderBy(desc(osirisCustodiesTable.createdAt));
  res.json(rows);
});

router.get("/osiris/custodies/:id", requireAuth, async (req, res): Promise<void> => {
  const custody = await loadVisibleCustody(req.localUser!.id, String(req.params.id));
  if (!custody) {
    res.status(404).json({ error: "Custody not found" });
    return;
  }
  const [events, deviations, calibrations] = await Promise.all([
    db.select().from(osirisCustodyEventsTable).where(eq(osirisCustodyEventsTable.custodyId, custody.id)).orderBy(desc(osirisCustodyEventsTable.occurredAt)),
    db.select().from(osirisDeviationsTable).where(eq(osirisDeviationsTable.custodyId, custody.id)).orderBy(desc(osirisDeviationsTable.createdAt)),
    db.select().from(osirisCalibrationsTable).where(eq(osirisCalibrationsTable.custodyId, custody.id)).orderBy(desc(osirisCalibrationsTable.createdAt)),
  ]);
  res.json({ custody, events, deviations, calibrations });
});

router.post("/osiris/custodies/:id/telemetry", requireAuth, async (req, res): Promise<void> => {
  const custody = await loadVisibleCustody(req.localUser!.id, String(req.params.id));
  const parsed = telemetryBody.safeParse(req.body);
  if (!custody || !parsed.success) {
    const error = custody ? (parsed.success ? "Invalid telemetry" : parsed.error.message) : "Custody not found";
    res.status(custody ? 400 : 404).json({ error });
    return;
  }
  const input = parsed.data;
  const nextState = input.custodyState ?? (input.health === "degraded" ? "lost" : custody.custodyState);
  const now = new Date();
  const sourceLineage = lineage(custody);
  const updated = await db.transaction(async (tx) => {
    await tx.insert(osirisCustodyEventsTable).values({
      custodyId: custody.id,
      machineArtifactId: custody.machineArtifactId,
      eventType: nextState !== custody.custodyState ? "custody" : "health",
      health: input.health,
      custodyState: nextState,
      reason: input.reason,
      lineage: { ...sourceLineage, metrics: input.metrics ?? {} },
      actorUserId: req.localUser!.id,
    });
    const [result] = await tx
      .update(osirisCustodiesTable)
      .set({ health: input.health, custodyState: nextState, lastTelemetryAt: now })
      .where(eq(osirisCustodiesTable.id, custody.id))
      .returning();
    if (!result) throw new Error("Custody telemetry update failed");
    if (input.deviation) {
      await tx.insert(osirisDeviationsTable).values({
        custodyId: custody.id,
        machineArtifactId: custody.machineArtifactId,
        ownerUserId: custody.ownerUserId,
        organizationId: custody.organizationId,
        ...input.deviation,
        lineage: sourceLineage,
      });
      await tx.insert(osirisCustodyEventsTable).values({
        custodyId: custody.id,
        machineArtifactId: custody.machineArtifactId,
        eventType: "deviation",
        health: input.health,
        custodyState: nextState,
        reason: input.deviation.detail,
        lineage: { ...sourceLineage, severity: input.deviation.severity, category: input.deviation.category },
        actorUserId: req.localUser!.id,
      });
    }
    if (input.calibration) {
      await tx.insert(osirisCalibrationsTable).values({
        custodyId: custody.id,
        machineArtifactId: custody.machineArtifactId,
        ownerUserId: custody.ownerUserId,
        organizationId: custody.organizationId,
        recommendation: input.calibration,
        lineage: sourceLineage,
      });
      await tx.insert(osirisCustodyEventsTable).values({
        custodyId: custody.id,
        machineArtifactId: custody.machineArtifactId,
        eventType: "calibration",
        health: input.health,
        custodyState: nextState,
        reason: input.calibration,
        lineage: sourceLineage,
        actorUserId: req.localUser!.id,
      });
    }
    return result;
  });
  res.json(updated);
});

router.post("/osiris/custodies/:id/recover", requireAuth, async (req, res): Promise<void> => {
  const custody = await loadVisibleCustody(req.localUser!.id, String(req.params.id));
  if (!custody) {
    res.status(404).json({ error: "Custody not found" });
    return;
  }
  const role = custody.organizationId
    ? await db
        .select({ role: organizationMembersTable.role })
        .from(organizationMembersTable)
        .where(and(eq(organizationMembersTable.organizationId, custody.organizationId), eq(organizationMembersTable.userId, req.localUser!.id)))
        .limit(1)
    : [];
  if (custody.ownerUserId !== req.localUser!.id && !["owner", "admin"].includes(role[0]?.role ?? "")) {
    res.status(403).json({ error: "Owner or organization administrator authorization required" });
    return;
  }
  if (new Date() >= custody.expiresAt) {
    res.status(409).json({ error: "Expired custody cannot be recovered" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [result] = await tx.update(osirisCustodiesTable).set({ custodyState: "recovered", health: "healthy", lastTelemetryAt: new Date() }).where(eq(osirisCustodiesTable.id, custody.id)).returning();
    if (!result) throw new Error("Custody recovery update failed");
    await tx.insert(osirisCustodyEventsTable).values({
      custodyId: custody.id,
      machineArtifactId: custody.machineArtifactId,
      eventType: "recovery",
      health: "healthy",
      custodyState: "recovered",
      reason: typeof req.body?.reason === "string" ? req.body.reason : "Authorized custody recovery",
      lineage: lineage(custody),
      actorUserId: req.localUser!.id,
    });
    return result;
  });
  res.json(updated);
});

router.get("/osiris/attestations/:machineArtifactId", requireAuth, async (req, res): Promise<void> => {
  const attestation = await getOsirisCustodyAttestation(String(req.params.machineArtifactId));
  if (!attestation.active) {
    if (attestation.custodyId) {
      const visible = await loadVisibleCustody(req.localUser!.id, attestation.custodyId);
      if (!visible) {
        res.status(404).json({ error: "Custody not found" });
        return;
      }
    }
    res.status(409).json({ ...attestation, error: "F10 release blocked: active OSIRIS custody is required" });
    return;
  }
  const custody = await loadVisibleCustody(req.localUser!.id, attestation.custodyId);
  if (!custody) {
    res.status(404).json({ error: "Custody not found" });
    return;
  }
  res.json(attestation);
});

export default router;