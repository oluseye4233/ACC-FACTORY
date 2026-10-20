import { and, eq, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db, harnessArtifactsTable, preparationStorageLeasesTable as leases } from "@workspace/db";
import { logger } from "../logger";
import { deletePrivateVersion, inspectPrivate, type PrivateObjectVersion } from "./private-storage";
import { noteRecoveryFailure, resolveRecoveryFailure, dispatchRecoveryAlerts } from "../recovery-alerts";

const SAFETY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 5 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type RecoveryStorage = {
  inspect: (key: string) => Promise<PrivateObjectVersion | null>;
  remove: (key: string, generation: string) => Promise<"deleted" | "missing" | "changed">;
};
export type PreparationRecoveryReport = {
  dryRun: boolean; scanned: number; candidates: number; deleted: number;
  missing: number; retained: number; busy: number; errors: number;
};

/**
 * Only durable intents from THIS database qualify. Never bucket-scan unknown
 * files: dev/prod can share storage, and older archives lack this provenance.
 * Public preparation metadata only; no access to protected workflow records.
 */
export async function recoverPreparationStorage({
  dryRun = true, now = new Date(),
  storage = { inspect: inspectPrivate, remove: deletePrivateVersion },
}: { dryRun?: boolean; now?: Date; storage?: RecoveryStorage } = {}): Promise<PreparationRecoveryReport> {
  const report: PreparationRecoveryReport = {
    dryRun, scanned: 0, candidates: 0, deleted: 0, missing: 0, retained: 0, busy: 0, errors: 0,
  };
  const due = await db.select().from(leases).where(and(
    inArray(leases.state, ["UPLOADING", "RECOVERED"]), lte(leases.nextRecoveryAt, now),
    lte(leases.createdAt, new Date(now.getTime() - SAFETY_MS)),
  )).orderBy(leases.nextRecoveryAt, leases.id).limit(20);
  for (const candidate of due) {
    report.scanned++;
    let inspected = false;
    const subject = { kind: "preparation" as const, resourceId: candidate.id, scopeId: candidate.id };
    try {
      await db.transaction(async tx => {
        // Same cross-process owner lock as createPreparation, held through the
        // final reference check AND conditional storage deletion.
        const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${candidate.userId}), 210) AS acquired`);
        if (lock.rows[0]?.acquired !== true) { report.busy++; return; }
        const [lease] = await tx.select().from(leases).where(eq(leases.id, candidate.id)).for("update");
        if (!lease || !["UPLOADING", "RECOVERED"].includes(lease.state) || lease.nextRecoveryAt > now) { report.retained++; return; }
        const valid = UUID.test(lease.id) && UUID.test(lease.userId) &&
          Array.isArray(lease.fileKeys) && lease.fileKeys.length > 0 && lease.fileKeys.length <= 50 &&
          lease.fileKeys.every((key, i) => key === `spartan-preparations/${lease.userId}/${lease.id}/file-${i}`);
        if (!valid) throw new Error("Recovery intent has invalid keys; retained");
        const refs = await tx.select({ id: harnessArtifactsTable.id }).from(harnessArtifactsTable)
          .where(or(
            eq(harnessArtifactsTable.id, lease.id),
            ...lease.fileKeys.map(objectKey => sql`${harnessArtifactsTable.artifactContent} @> ${JSON.stringify({ files: [{ objectKey }] })}::jsonb`),
          )).limit(1);
        if (refs.length) {
          report.retained += lease.fileKeys.length;
          if (!dryRun) await tx.update(leases).set({ state: "COMMITTED", lastRecoveryAt: now }).where(eq(leases.id, lease.id));
          inspected = true;
          return;
        }
        let pending = false;
        for (const key of lease.fileKeys) {
          const object = await storage.inspect(key);
          if (!object) { report.missing++; continue; }
          if (!/^\d+$/.test(object.generation) || !Number.isFinite(object.createdAt.getTime()) ||
            object.createdAt.getTime() > now.getTime() - SAFETY_MS) {
            report.retained++; pending = true; continue;
          }
          report.candidates++;
          if (!dryRun) {
            const result = await storage.remove(key, object.generation);
            if (result === "deleted") report.deleted++;
            else if (result === "missing") report.missing++;
            else { report.retained++; pending = true; }
          }
        }
        if (!dryRun) await tx.update(leases).set({
          state: pending ? "UPLOADING" : "RECOVERED", lastRecoveryAt: now,
          // Retain intent and revisit even recovered rows: a delayed network PUT
          // must not become an untracked leak after a worker/connection failure.
          nextRecoveryAt: new Date(now.getTime() + SAFETY_MS),
        }).where(eq(leases.id, lease.id));
        inspected = true;
      }, { isolationLevel: "read committed" });
      if (inspected) await resolveRecoveryFailure(subject, now);
    } catch (err) {
      report.errors++;
      await noteRecoveryFailure(subject, now);
      logger.error({ err, preparationId: candidate.id }, "Preparation file recovery failed; retained intent for retry");
      // A permanently malformed intent or storage failure must not starve
      // later pages. Preserve provenance and retry tomorrow, never delete it.
      if (!dryRun) {
        try {
          await db.update(leases).set({ nextRecoveryAt: new Date(now.getTime() + SAFETY_MS) })
            .where(and(eq(leases.id, candidate.id), ne(leases.state, "COMMITTED")));
        } catch (rescheduleErr) {
          logger.error({ err: rescheduleErr, preparationId: candidate.id }, "Could not reschedule preparation recovery");
        }
      }
    }
  }
  return report;
}

/** Report-only by default. Applying deletion is an explicit operator opt-in. */
export function startPreparationStorageRecovery(): () => void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST || !process.env.PRIVATE_OBJECT_DIR) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const report = await recoverPreparationStorage({
        dryRun: process.env.PREPARATION_ORPHAN_RECOVERY_APPLY !== "true",
      });
      if (report.scanned) logger.info(report, "Private preparation storage recovery");
      await dispatchRecoveryAlerts();
    } catch (err) {
      logger.error({ err }, "Private preparation recovery scan failed; will retry");
    } finally { running = false; }
  };
  void tick();
  const interval = setInterval(() => void tick(), INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
}
