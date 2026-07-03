/**
 * Shared query logic for the test-fixture janitor.
 *
 * Test suites seed real rows into the shared dev database (users +
 * `harness_engine_runs` cost rows) and clean up after themselves via user
 * deletes. A killed or crashed run leaves its rows behind — and those
 * orphaned cost rows count toward the LIVE dev app's company-wide monthly
 * spend SUM (`currentMonthCostGlobal`), inflating the spend meter with money
 * no human ever spent, potentially 402-blocking real staff usage.
 *
 * This module is the single source of the janitor's identity + age + cascade
 * safety model, shared by:
 *   - the CLI script `scripts/src/cleanup-test-cost-data.ts` (manual /
 *     post-merge / test-bootstrap invocation)
 *   - the dev-only periodic sweep inside the API server process
 *
 * Safety model — why this can never touch real dev usage or a live suite:
 *   1. Identity: only users whose email ends in `@example.test` are
 *      candidates. `.test` is an IETF-reserved TLD (RFC 2606) that can never
 *      belong to a real person; every test fixture in
 *      `artifacts/api-server/test` uses it.
 *   2. Age: only users created more than `minAgeMinutes` ago (default 60)
 *      are deleted. The full workspace test run finishes in well under that,
 *      so a suite that is mid-flight still owns fixtures far younger than the
 *      threshold and is never raced.
 *   3. Cascade: deletion goes through the `users` row, exactly like the
 *      suites' own `afterAll` cleanup — `harness_engine_runs` (and every
 *      other per-user table) cascade-deletes with it, so no dangling rows.
 */
import type pg from "pg";

export const TEST_FIXTURE_EMAIL_SUFFIX = "@example.test";
export const TEST_FIXTURE_DEFAULT_MIN_AGE_MINUTES = 60;

export interface StaleTestFixtureSummary {
  userCount: number;
  runCount: number;
  currentMonthCostUsd: number;
}

/** Report (without deleting) the stale test fixtures currently in the DB. */
export async function summariseStaleTestFixtures(
  pool: pg.Pool,
  minAgeMinutes: number = TEST_FIXTURE_DEFAULT_MIN_AGE_MINUTES,
): Promise<StaleTestFixtureSummary> {
  const { rows } = await pool.query<{
    user_count: string;
    run_count: string;
    current_month_cost: string;
  }>(
    `
    WITH candidates AS (
      SELECT id FROM users
      WHERE email LIKE '%' || $1
        AND created_at < now() - make_interval(mins => $2)
    )
    SELECT
      (SELECT COUNT(*) FROM candidates)::text AS user_count,
      COUNT(r.id)::text AS run_count,
      COALESCE(SUM(r.cost_usd) FILTER (
        WHERE r.created_at >= date_trunc('month', now() AT TIME ZONE 'utc')
      ), 0)::text AS current_month_cost
    FROM candidates c
    LEFT JOIN harness_engine_runs r ON r.user_id = c.id
    `,
    [TEST_FIXTURE_EMAIL_SUFFIX, minAgeMinutes],
  );
  const row = rows[0];
  return {
    userCount: Number(row?.user_count ?? 0),
    runCount: Number(row?.run_count ?? 0),
    currentMonthCostUsd: Number(row?.current_month_cost ?? 0),
  };
}

/**
 * Delete stale test-fixture users (their engine runs and all other per-user
 * rows cascade-delete). Returns the number of users deleted.
 */
export async function deleteStaleTestFixtures(
  pool: pg.Pool,
  minAgeMinutes: number = TEST_FIXTURE_DEFAULT_MIN_AGE_MINUTES,
): Promise<number> {
  const { rowCount } = await pool.query(
    `
    DELETE FROM users
    WHERE email LIKE '%' || $1
      AND created_at < now() - make_interval(mins => $2)
    `,
    [TEST_FIXTURE_EMAIL_SUFFIX, minAgeMinutes],
  );
  return rowCount ?? 0;
}

export interface SweepStaleTestFixturesResult extends StaleTestFixtureSummary {
  deletedUserCount: number;
}

/** Summarise then delete in one call — the periodic-sweep entry point. */
export async function sweepStaleTestFixtures(
  pool: pg.Pool,
  minAgeMinutes: number = TEST_FIXTURE_DEFAULT_MIN_AGE_MINUTES,
): Promise<SweepStaleTestFixturesResult> {
  const summary = await summariseStaleTestFixtures(pool, minAgeMinutes);
  if (summary.userCount === 0) {
    return { ...summary, deletedUserCount: 0 };
  }
  const deletedUserCount = await deleteStaleTestFixtures(pool, minAgeMinutes);
  return { ...summary, deletedUserCount };
}
