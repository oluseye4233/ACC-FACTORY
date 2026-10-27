import { defineConfig } from "vitest/config";

// Credential-free unit tests: intentionally no shared-DB janitor/global setup.
export default defineConfig({
  test: { include: ["test/launch-readiness.test.ts"], maxWorkers: 1 },
});
