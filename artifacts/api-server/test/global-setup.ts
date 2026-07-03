/**
 * Vitest globalSetup: run the shared-dev-DB test-data janitor once, before
 * any suite starts.
 *
 * Why here: test suites seed real rows into the shared dev database and clean
 * up after themselves, but a killed/crashed run leaves `@example.test` users
 * (and their cascaded `harness_engine_runs` cost rows) behind, inflating the
 * live dev app's company-wide spend SUM. Running the janitor at test bootstrap
 * keeps the meter honest without anyone remembering to invoke it.
 *
 * Safety:
 *  - The janitor's own age guard (only fixtures older than 60 minutes) stays
 *    intact, so the run about to begin — and any concurrently running suite —
 *    is never raced.
 *  - Failures are log-and-continue: a broken janitor (or unreachable DB from
 *    the script's side) must never fail the test run itself. The suites will
 *    surface real DB problems on their own.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export default function globalSetup(): void {
  // eslint-disable-next-line no-console -- test bootstrap, not server code
  console.log("[global-setup] running test-data janitor (cleanup-test-cost-data)…");
  try {
    const result = spawnSync(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", "cleanup-test-cost-data"],
      {
        cwd: REPO_ROOT,
        stdio: "inherit",
        timeout: 60_000,
      },
    );
    if (result.error) {
      // eslint-disable-next-line no-console
      console.warn(
        `[global-setup] janitor could not be spawned (continuing): ${result.error.message}`,
      );
    } else if (result.status !== 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[global-setup] janitor exited with status ${result.status} (continuing; tests are unaffected)`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[global-setup] janitor threw (continuing): ${String(err)}`);
  }
}
