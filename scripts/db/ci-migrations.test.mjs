import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertDisposableTarget } from "./ci-migrations.mjs";
import { baselinePayload, freshInstallBaseline } from "./fresh-install-baseline.mjs";

test("CI replay refuses non-local and non-disposable targets", () => {
  for (const url of ["postgres://u@production.example/workspace_test", "postgres://u@localhost/customer_data", "postgres://u@localhost/workspace_test_extra"]) {
    assert.throws(() => assertDisposableTarget(url), /localhost database named workspace_test/);
  }
  assert.doesNotThrow(() => assertDisposableTarget("postgres://u@127.0.0.1:55439/workspace_test"));
});
test("only the explicitly wrapped baseline SQL is executed", () => {
  assert.deepEqual(baselinePayload("-- baseline\n/* SELECT 1;--> statement-breakpoint\nSELECT 2; */"), ["SELECT 1;", "SELECT 2;"]);
  assert.throws(() => baselinePayload("SELECT 1;"), /review required/);
  assert.throws(() => baselinePayload("/* SELECT 1; */ SELECT 2;"), /review required/);
});
test("fresh baseline changes only the five declared UUID operator classes", async () => {
  const source = await readFile(new URL("../../lib/db/migrations/0000_harsh_miss_america.sql", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../../lib/db/fresh-install/baseline.json", import.meta.url), "utf8"));
  const historical = baselinePayload(source);
  const fresh = freshInstallBaseline(source, manifest);
  assert.equal(fresh.statements.length, historical.length);
  assert.equal(fresh.statements.filter((statement, i) => statement !== historical[i]).length, 5);
  for (const replacement of manifest.replacements) assert.ok(fresh.statements.includes(replacement.after));
  assert.notEqual(fresh.hash, manifest.sourceSha256);
  assert.throws(() => freshInstallBaseline(source + "\n", manifest), /checksum/);
  assert.throws(() => freshInstallBaseline(source, { ...manifest, replacements: [{ before: "missing", after: "SELECT 1" }] }), /replacement mismatch/);
});
