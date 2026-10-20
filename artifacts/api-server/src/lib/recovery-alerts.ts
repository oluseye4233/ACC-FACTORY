import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendRecoveryFailureAlert } from "@workspace/email";
import { logger } from "./logger";
import { subscriptionsEnabled } from "./feature-flags";

export type RecoverySubject = { kind: "credit" | "preparation"; resourceId: string; scopeId: string };
const BUCKET_MS = 5 * 60_000;
const THRESHOLD = 3;

/** Atomic, restart-safe counting; overlapping replicas cannot multiply a period. */
export async function noteRecoveryFailure(subject: RecoverySubject, now = new Date()): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO recovery_failures
        (kind, resource_id, scope_id, episode_id, failures, last_bucket, first_failed_at, last_failed_at)
      VALUES (${subject.kind}, ${subject.resourceId}::uuid, ${subject.scopeId}::uuid, ${randomUUID()}::uuid,
        1, ${Math.floor(now.getTime() / BUCKET_MS)}, ${now}, ${now})
      ON CONFLICT (kind, resource_id, scope_id) DO UPDATE SET
        episode_id = CASE WHEN recovery_failures.resolved_at IS NOT NULL THEN excluded.episode_id ELSE recovery_failures.episode_id END,
        failures = CASE WHEN recovery_failures.resolved_at IS NOT NULL THEN 1
          WHEN recovery_failures.last_bucket < excluded.last_bucket THEN recovery_failures.failures + 1 ELSE recovery_failures.failures END,
        last_bucket = greatest(recovery_failures.last_bucket, excluded.last_bucket),
        first_failed_at = CASE WHEN recovery_failures.resolved_at IS NOT NULL THEN excluded.first_failed_at ELSE recovery_failures.first_failed_at END,
        last_failed_at = greatest(recovery_failures.last_failed_at, excluded.last_failed_at),
        resolved_at = NULL
      WHERE recovery_failures.last_failed_at <= excluded.last_failed_at
        AND (recovery_failures.resolved_at IS NULL OR recovery_failures.resolved_at < excluded.last_failed_at)
    `);
  } catch (err) {
    // A tracking outage must not change credit fencing or mask the worker error.
    logger.error({ err, kind: subject.kind, resourceId: subject.resourceId }, "Could not persist recovery failure");
  }
}

export async function resolveRecoveryFailure(subject: RecoverySubject, now = new Date()): Promise<void> {
  try {
    await db.execute(sql`UPDATE recovery_failures SET resolved_at = ${now}
      WHERE kind = ${subject.kind} AND resource_id = ${subject.resourceId}::uuid
        AND scope_id = ${subject.scopeId}::uuid AND resolved_at IS NULL AND last_failed_at <= ${now}`);
  } catch (err) {
    logger.error({ err, kind: subject.kind, resourceId: subject.resourceId }, "Could not resolve recovery failure");
  }
}

export interface RecoveryAlertReport { delivered: number; failed: number; deferred: boolean }

/**
 * Bounded per-recipient outbox with fenced delivery leases. Rechecks live
 * provenance/claim identity: a later credit claim never inherits an old alert.
 */
export async function dispatchRecoveryAlerts(now = new Date(), resourceIds?: readonly string[]): Promise<RecoveryAlertReport> {
  const report: RecoveryAlertReport = { delivered: 0, failed: 0, deferred: false };
  const recipients = [...new Set((process.env.ADMIN_EMAILS ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return { ...report, deferred: true };
  if (recipients.length > 20) {
    logger.error({ recipients: recipients.length }, "Recovery alert recipient limit exceeded (maximum 20)");
    return { ...report, failed: 1 };
  }
  try {
    const rows = await db.execute<{
      kind: "credit" | "preparation"; resource_id: string; episode_id: string;
      failures: number; first_failed_at: Date; last_failed_at: Date;
    }>(sql`
      SELECT f.kind, f.resource_id, f.episode_id, f.failures, f.first_failed_at, f.last_failed_at
      FROM recovery_failures f
      WHERE f.resolved_at IS NULL AND f.failures >= ${THRESHOLD} AND f.last_failed_at <= ${now}
      AND ${resourceIds ? (resourceIds.length
        ? sql`f.resource_id IN (${sql.join(resourceIds.map(id => sql`${id}::uuid`), sql`, `)})`
        : sql`false`) : sql`true`} AND (
        (f.kind = 'credit' AND ${subscriptionsEnabled()} AND EXISTS (
          SELECT 1 FROM cartridge_credits c WHERE c.id = f.resource_id
          AND c.reservation_token = f.scope_id AND c.status = 'consumed'
          AND c.cartridge_package_id IS NULL AND c.consumed_at < ${new Date(now.getTime() - 15 * 60_000)}
        )) OR
        (f.kind = 'preparation' AND ${Boolean(process.env.PRIVATE_OBJECT_DIR)} AND EXISTS (
          SELECT 1 FROM preparation_storage_leases l WHERE l.id = f.resource_id
          AND l.id = f.scope_id AND l.state IN ('UPLOADING', 'RECOVERED')
        ))
      )
      AND EXISTS (
        SELECT 1 FROM unnest(ARRAY[${sql.join(recipients.map(to =>
          sql`${createHash("sha256").update(to).digest("hex")}`), sql`, `)}]::text[]) recipient(hash)
        WHERE NOT EXISTS (
          SELECT 1 FROM recovery_alert_deliveries d
          WHERE d.episode_id = f.episode_id AND d.recipient_hash = recipient.hash AND d.sent_at IS NOT NULL
        )
      )
      ORDER BY (SELECT max(d.lease_until) FROM recovery_alert_deliveries d WHERE d.episode_id = f.episode_id) ASC NULLS FIRST,
        f.last_failed_at, f.resource_id LIMIT 20
    `);
    let budget = 40;
    for (const row of rows.rows) {
      for (const to of recipients) {
        if (budget <= 0) return { ...report, deferred: true };
        const hash = createHash("sha256").update(to).digest("hex");
        const token = randomUUID();
        const claim = await db.execute(sql`
          INSERT INTO recovery_alert_deliveries (episode_id, recipient_hash, claim_token, lease_until)
          SELECT ${row.episode_id}::uuid, ${hash}, ${token}::uuid, ${new Date(now.getTime() + 2 * 60_000)}
          WHERE EXISTS (SELECT 1 FROM recovery_failures WHERE episode_id = ${row.episode_id}::uuid AND resolved_at IS NULL)
          ON CONFLICT (episode_id, recipient_hash) DO UPDATE
            SET claim_token = excluded.claim_token, lease_until = excluded.lease_until
          WHERE recovery_alert_deliveries.sent_at IS NULL AND recovery_alert_deliveries.lease_until <= ${now}
          RETURNING claim_token
        `);
        if (!claim.rows.length) continue;
        budget--;
        try {
          const result = await sendRecoveryFailureAlert({
            to, kind: row.kind, resourceId: row.resource_id, failures: row.failures,
            firstFailedAt: new Date(row.first_failed_at).toISOString(),
            lastFailedAt: new Date(row.last_failed_at).toISOString(),
            idempotencyKey: `recovery/${row.episode_id}/${hash}`,
          });
          if (!result.ok || result.dryRun) {
            report.failed++;
            logger.warn({ kind: row.kind, resourceId: row.resource_id, dryRun: result.ok && result.dryRun === true },
              "Recovery alert not delivered; retained for retry");
            continue; // Leave the lease retryable; never stamp a dry-run as sent.
          }
          const stamped = await db.execute(sql`UPDATE recovery_alert_deliveries SET sent_at = ${now}
            WHERE episode_id = ${row.episode_id}::uuid AND recipient_hash = ${hash}
              AND claim_token = ${token}::uuid AND sent_at IS NULL RETURNING episode_id`);
          if (stamped.rows.length) report.delivered++;
        } catch (err) {
          report.failed++;
          logger.error({ err, kind: row.kind, resourceId: row.resource_id }, "Recovery alert delivery failed; will retry");
        }
      }
    }
  } catch (err) {
    report.failed++;
    logger.error({ err }, "Recovery alert dispatch failed; will retry");
  }
  return report;
}
