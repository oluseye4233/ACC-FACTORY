import { defineConfig } from "vitest/config";

// Focus one file with:
// pnpm --filter @workspace/api-server run test -- test/f9-mecha.test.ts
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    // API suites share one dev DB; run files one at a time to avoid database
    // contention and timeout flakes during the full workspace run.
    maxWorkers: 1,
    // Runs ONCE before any suite: sweeps stale @example.test fixtures from the
    // shared dev DB (log-and-continue — never fails the test run). The
    // janitor's 60-minute age guard protects the run about to begin.
    globalSetup: ["./test/global-setup.ts"],
  },
});
