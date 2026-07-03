/**
 * Janitor for orphaned test-fixture data in the shared dev database.
 *
 * The identity + age + cascade safety model (and the SQL implementing it)
 * lives in `@workspace/db` (`lib/db/src/test-fixture-janitor.ts`), shared
 * with the dev-only periodic sweep inside the API server process. This CLI
 * is the manual / post-merge / test-bootstrap entry point.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run cleanup-test-cost-data              # delete stale fixtures
 *   pnpm --filter @workspace/scripts run cleanup-test-cost-data -- --dry-run # report only
 *   pnpm --filter @workspace/scripts run cleanup-test-cost-data -- --min-age-minutes=120
 */
import {
  pool,
  deleteStaleTestFixtures,
  summariseStaleTestFixtures,
  TEST_FIXTURE_DEFAULT_MIN_AGE_MINUTES,
  TEST_FIXTURE_EMAIL_SUFFIX,
} from "@workspace/db";

const TEST_EMAIL_SUFFIX = TEST_FIXTURE_EMAIL_SUFFIX;
const DEFAULT_MIN_AGE_MINUTES = TEST_FIXTURE_DEFAULT_MIN_AGE_MINUTES;

interface CliOptions {
  dryRun: boolean;
  minAgeMinutes: number;
}

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let minAgeMinutes = DEFAULT_MIN_AGE_MINUTES;
  for (const arg of argv) {
    if (arg === "--") {
      continue;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--min-age-minutes=")) {
      const raw = arg.slice("--min-age-minutes=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid --min-age-minutes value: ${raw}`);
      }
      minAgeMinutes = n;
    } else {
      throw new Error(`Unknown argument: ${arg} (expected --dry-run and/or --min-age-minutes=N)`);
    }
  }
  return { dryRun, minAgeMinutes };
}

async function main(): Promise<void> {
  const { dryRun, minAgeMinutes } = parseArgs(process.argv.slice(2));

  console.log(
    `[cleanup-test-cost-data] scanning for users with '${TEST_EMAIL_SUFFIX}' emails older than ${minAgeMinutes} minute(s)${dryRun ? " (dry run)" : ""}`,
  );

  const summary = await summariseStaleTestFixtures(pool, minAgeMinutes);
  console.log(
    `[cleanup-test-cost-data] found ${summary.userCount} stale test user(s) owning ${summary.runCount} engine-run row(s); ` +
      `$${summary.currentMonthCostUsd.toFixed(6)} of current-month spend attributed to them`,
  );

  if (summary.userCount === 0) {
    console.log("[cleanup-test-cost-data] nothing to clean up");
    return;
  }

  if (dryRun) {
    console.log("[cleanup-test-cost-data] dry run — no rows deleted");
    return;
  }

  const deleted = await deleteStaleTestFixtures(pool, minAgeMinutes);
  console.log(
    `[cleanup-test-cost-data] deleted ${deleted} test user(s); their engine runs (and all other per-user rows) cascade-deleted. ` +
      `Dev spend meter reclaimed ~$${summary.currentMonthCostUsd.toFixed(6)} for the current month.`,
  );
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[cleanup-test-cost-data] failed:", err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
