import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    // Runs ONCE before any suite: sweeps stale @example.test fixtures from the
    // shared dev DB (log-and-continue — never fails the test run). The
    // janitor's 60-minute age guard protects the run about to begin.
    globalSetup: ["./test/global-setup.ts"],
  },
});
