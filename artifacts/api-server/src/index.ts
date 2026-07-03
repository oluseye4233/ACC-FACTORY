import app from "./app";
import { logger } from "./lib/logger";
import { assertMigrationsApplied } from "./lib/migration-guard";

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
});
