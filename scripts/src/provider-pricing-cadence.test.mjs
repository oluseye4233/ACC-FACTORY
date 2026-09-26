import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveFreshnessWindow,
  deriveProviderPricingFreshness,
  extractPricingScheduleCrons,
} from "./provider-pricing-cadence.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const pricingWorkflowPath = fileURLToPath(
  new URL("../../.github/workflows/provider-pricing.yml", import.meta.url),
);

test("weekly schedule derives a ten-day stale window", () => {
  const window = deriveFreshnessWindow(["17 9 * * 1"]);

  assert.equal(window.maxScheduleGapMs, 7 * DAY_MS);
  assert.equal(window.staleAfterMs, 10 * DAY_MS);
  assert.equal(window.staleAfterDays, 10);
});

test("a changed weekly cadence changes the stale window with it", () => {
  const window = deriveFreshnessWindow(["17 9 * * 1,4"]);

  assert.equal(window.maxScheduleGapMs, 4 * DAY_MS);
  assert.equal(window.staleAfterMs, 7 * DAY_MS);
  assert.equal(window.staleAfterDays, 7);
});

test("the actual pricing workflow schedule is readable and supported", () => {
  const workflowText = readFileSync(pricingWorkflowPath, "utf8");
  const scheduleCrons = extractPricingScheduleCrons(workflowText);
  const window = deriveProviderPricingFreshness(workflowText);

  assert.ok(scheduleCrons.length > 0);
  assert.equal(window.staleAfterMs, window.maxScheduleGapMs + 3 * DAY_MS);
});

test("unsupported calendar schedules fail explicitly instead of using a stale fallback", () => {
  assert.throws(
    () => deriveFreshnessWindow(["17 9 1 * *"]),
    /Only weekly pricing schedules/,
  );
  assert.throws(
    () => extractPricingScheduleCrons("on:\n  workflow_dispatch:\n"),
    /No scheduled cron/,
  );
});