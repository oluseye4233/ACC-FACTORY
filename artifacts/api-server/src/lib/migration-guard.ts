import { getMigrationStatus, MIGRATE_FIX_COMMAND, pool } from "@workspace/db";

/**
 * Startup guard against unapplied drizzle migrations.
 *
 * A merge can land a new migration under `lib/db/migrations/` without the dev
 * DB having applied it (e.g. post-merge sync was skipped or failed). The
 * schema objects then exist in code + a committed migration but not in the
 * DB, so features 500 at runtime with "relation/column does not exist" and
 * nothing points at the real cause. This guard compares the committed
 * migration journal against `drizzle.__drizzle_migrations` at boot:
 *
 * - Outside production, a pending migration is FATAL: log + throw so the dev
 *   server refuses to boot with the exact fix command, instead of coming up
 *   and 500ing later.
 * - In production it only warns. The prod DB is synced by Replit's Publish
 *   flow, not by drizzle migrations, so its `__drizzle_migrations` table may
 *   legitimately not track the journal (usually the check reports "unknown"
 *   there and is skipped).
 * - If the check itself cannot run (no journal file in the deploy bundle, DB
 *   briefly unreachable at boot), it logs and moves on — the guard must never
 *   create a new way to fail that isn't real drift.
 */
export async function assertMigrationsApplied(log: {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}): Promise<void> {
  let status;
  try {
    status = await getMigrationStatus(pool);
  } catch (err) {
    log.warn(
      { err },
      "Migration status check could not query the database; skipping (this is not a drift verdict)",
    );
    return;
  }

  if (status.status === "unknown") {
    log.info({ reason: status.reason }, "Migration status check skipped");
    return;
  }

  if (status.status === "ok") {
    log.info(
      { applied: status.appliedCount, journal: status.journalCount },
      "All committed DB migrations are applied",
    );
    return;
  }

  const message =
    `PENDING DB MIGRATIONS: ${status.appliedCount}/${status.journalCount} applied — ` +
    `${status.pendingTags.length} committed migration(s) have NOT been applied to this database: ` +
    `${status.pendingTags.join(", ")}. ` +
    `The DB is behind the committed schema; affected features will 500 with "relation/column does not exist". ` +
    `Fix with: ${MIGRATE_FIX_COMMAND}`;

  if (process.env.NODE_ENV === "production") {
    log.warn(message);
    return;
  }

  log.error(message);
  throw new Error(message);
}
