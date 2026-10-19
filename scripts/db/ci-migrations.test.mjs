import { test } from "node:test";
import assert from "node:assert/strict";
import { assertDisposableTarget, baselinePayload } from "./ci-migrations.mjs";

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
