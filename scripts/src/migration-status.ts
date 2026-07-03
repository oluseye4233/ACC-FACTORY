import {
  pool,
  getMigrationStatus,
  MIGRATE_FIX_COMMAND,
} from "@workspace/db";

/**
 * Print the applied-vs-pending migration status of the current DATABASE_URL.
 * Exits non-zero when migrations are pending so callers (post-merge.sh, CI)
 * fail loud instead of leaving the DB silently behind the committed schema.
 */
async function main(): Promise<void> {
  const status = await getMigrationStatus(pool);

  if (status.status === "unknown") {
    console.log(`[migration-status] cannot determine status: ${status.reason}`);
    return;
  }

  if (status.status === "pending") {
    console.error(
      `[migration-status] DRIFT: ${status.appliedCount}/${status.journalCount} migrations applied — ${status.pendingTags.length} PENDING: ${status.pendingTags.join(", ")}`,
    );
    console.error(`[migration-status] fix with: ${MIGRATE_FIX_COMMAND}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `[migration-status] ok: ${status.appliedCount}/${status.journalCount} migrations applied, 0 pending`,
  );
}

main()
  .catch((err) => {
    console.error("[migration-status] check failed:", err);
    process.exitCode = 1;
  })
  .finally(() => void pool.end());
