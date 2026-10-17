import test from "node:test";
import assert from "node:assert/strict";
import { parsePrompts, sequencePrompts } from "./index-ark-upgrades.mjs";

test("extracts source lines and cross-document prerequisites", () => {
  const source = "| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |\n| UPG-RDY-002 | Scan | HIVE | P0 | UPG-RDY-001 | XVL-TRK-002, CD-TRC-001 | W2 |";
  const [prompt] = parsePrompts(source, "fixture.md");
  assert.equal(prompt.sourceLine, 2);
  assert.deepEqual(prompt.dependencies, ["UPG-RDY-001", "XVL-TRK-002", "CD-TRC-001"]);
});

test("orders dependencies without pretending missing prerequisites are implemented", () => {
  const result = sequencePrompts([
    { id: "UPG-RDY-002", dependencies: ["XVL-TRK-002", "CD-TRC-001"] },
    { id: "XVL-TRK-002", dependencies: [] },
  ]);
  assert.deepEqual(result.map((p) => p.id), ["XVL-TRK-002", "UPG-RDY-002"]);
  assert.deepEqual(result[1].unavailablePromptReferences, ["CD-TRC-001"]);
});

test("rejects cycles and duplicate prompts", () => {
  assert.throws(() => sequencePrompts([{ id: "A", dependencies: ["B"] }, { id: "B", dependencies: ["A"] }]), /cycle/);
  assert.throws(() => sequencePrompts([{ id: "A", dependencies: [] }, { id: "A", dependencies: [] }]), /Duplicate/);
});
