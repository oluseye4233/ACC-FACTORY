import { and, eq, inArray, lte } from "drizzle-orm";
import { db, osirisCustodiesTable, osirisCustodyEventsTable } from "@workspace/db";

export function custodyAttestationStatus(
  custody: { custodyState: string; expiresAt: Date } | undefined,
  now = new Date(),
): { active: boolean; reason?: string } {
  if (
    !custody ||
    custody.custodyState === "lost" ||
    custody.custodyState === "expired" ||
    custody.expiresAt <= now
  ) {
    return { active: false, reason: !custody ? "NOT_REGISTERED" : "CUSTODY_UNAVAILABLE" };
  }
  return { active: true };
}

/**
 * F10 calls this before any adapter/network I/O. It intentionally returns no
 * artifact bytes: the connector must retrieve the immutable source through its
 * own custody-aware path and can only proceed when this proof is active.
 */
export async function getOsirisCustodyAttestation(machineArtifactId: string) {
  const custody = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(osirisCustodiesTable)
      .where(eq(osirisCustodiesTable.machineArtifactId, machineArtifactId))
      .limit(1);
    const found = rows[0];
    if (
      !found ||
      !["active", "recovered"].includes(found.custodyState) ||
      found.expiresAt > new Date()
    ) return found;
    const [expired] = await tx
      .update(osirisCustodiesTable)
      .set({ custodyState: "expired" })
      .where(
        and(
          eq(osirisCustodiesTable.id, found.id),
          inArray(osirisCustodiesTable.custodyState, ["active", "recovered"]),
          lte(osirisCustodiesTable.expiresAt, new Date()),
        ),
      )
      .returning();
    if (expired) {
      await tx.insert(osirisCustodyEventsTable).values({
        custodyId: expired.id,
        machineArtifactId: expired.machineArtifactId,
        eventType: "expired",
        custodyState: "expired",
        reason: "OSIRIS custody contract expired",
        lineage: {
          custodyId: expired.id,
          machineArtifactId: expired.machineArtifactId,
          sourceHash: expired.sourceHash,
          sourceSignature: expired.sourceSignature,
          artifactVersion: expired.artifactVersion,
          routedFrom: "OSIRIS",
          routedTo: "SOLVA_F0",
        },
      });
      return expired;
    }
    const refreshed = await tx
      .select()
      .from(osirisCustodiesTable)
      .where(eq(osirisCustodiesTable.id, found.id))
      .limit(1);
    return refreshed[0] ?? found;
  });
  const status = custodyAttestationStatus(custody);
  if (!status.active) {
    return {
      active: false as const,
      reason: status.reason!,
      custodyId: custody?.id,
    };
  }
  return {
    active: true as const,
    custodyId: custody.id,
    machineArtifactId: custody.machineArtifactId,
    sourceHash: custody.sourceHash,
    sourceSignature: custody.sourceSignature,
    artifactVersion: custody.artifactVersion,
    mediaType: custody.mediaType,
    telemetryContract: custody.telemetryContract,
    expiresAt: custody.expiresAt,
    health: custody.health,
  };
}