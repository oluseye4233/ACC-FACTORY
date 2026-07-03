import app from "./app";
import { logger } from "./lib/logger";
import { assertMigrationsApplied } from "./lib/migration-guard";
import { startTestFixtureSweeper } from "./lib/test-fixture-sweeper";
import { startCostCapAlertSweeper } from "./lib/cost-cap-sweeper";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Fail loud (outside production) if the DB is behind the committed drizzle
// migrations, instead of booting and 500ing when a missing table is touched.
await assertMigrationsApplied(logger);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Dev-only: periodically sweep stale @example.test fixtures out of the
  // shared dev DB so orphaned cost rows from crashed test runs can't inflate
  // the live spend meter between test runs / merges. No-op in production.
  if (process.env.NODE_ENV !== "production") {
    startTestFixtureSweeper();
  }

  // All environments (no-op under vitest): periodically re-check company
  // LLM spend against STAFF_MONTHLY_COST_CAP_USD so the 80/95/100% admin
  // alert emails go out within ~15 minutes even with zero portal traffic —
  // without this, a threshold crossing is only detected on the next engine
  // request. Exactly-once is preserved by the cost_cap_notifications stamp.
  startCostCapAlertSweeper();
});
