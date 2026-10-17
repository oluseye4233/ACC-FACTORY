import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
const document = (name) => JSON.parse(readFileSync(new URL(`../../docs/upgrade-program/${name}`, import.meta.url), "utf8"));
test("successor policy fills four definitions without inventing original wording or live enforcement", () => {
  const resolution = document("governance-gap-resolution.json");
  assert.deepEqual(resolution.successorInvariants.map((r) => r.id), ["SP-17", "SP-18", "SP-19", "SP-20"]);
  assert.match(resolution.historicalStatus, /remain unavailable/);
  for (const invariant of resolution.successorInvariants) {
    assert.equal(invariant.enforcement, "SPECIFIED_DERIVED");
    assert.equal(invariant.liveActivity, "UNVERIFIED");
    assert.ok(invariant.rule.length > 100);
    assert.ok(invariant.derivedFrom.length >= 3);
  }
});
test("sprint ruling preserves unknown evidence and never grants release clearance", () => {
  const rule = document("governance-gap-resolution.json").sprintEligibilityRuling;
  assert.match(rule.missingMeasurement, /INCONCLUSIVE/);
  assert.match(rule.overLimit, /continue to F5/);
  assert.equal(rule.releaseClearance, false);
  assert.match(rule.measurement, /without clock resets/);
});
test("live ledger keeps historical gaps separate from effective replacement policy", () => {
  const progress = document("progress.json");
  for (const id of ["SP-17", "SP-18", "SP-19", "SP-20"]) {
    const row = progress.invariants.find((r) => r.id === id);
    assert.equal(row.liveActivity, "UNVERIFIED");
    assert.equal(row.effectivePolicy.provenance, "DERIVED_SUCCESSOR");
    assert.equal(row.effectivePolicy.definition, "SPECIFIED");
  }
});
