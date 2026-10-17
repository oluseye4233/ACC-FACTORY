import { describe, expect, it } from "vitest";
import { createTraceEventSchema, traceIdempotencyKey, verificationEventTypes } from "../src/lib/command-deck-trace-contract";

const hash = "a".repeat(64);
const id = "11111111-1111-4111-8111-111111111111";
const schema = createTraceEventSchema(verificationEventTypes);
const valid = () => ({
  trace_id: id, parent_trace_id: null, stage: "F12", stream: "E",
  event_type: "xvl_verdict", artifact_ref: `${id}@${hash}`, exemplar_id: null,
  actor_ref: "opaque_actor_123", occurred_at: "2026-10-15T00:00:00Z",
  payload_hash: hash, eligibility: "PENDING_CONSENT", eligibility_reason: "Consent not granted",
  verification: { run_id: id, track: "E", verdict: "PASS", independence: "I2", evidence_hash: hash },
  idempotency_key: traceIdempotencyKey("E", "event-1", hash), processing_status: "PENDING",
});

describe("Command Deck metadata trace contract", () => {
  it("supports the F12/Stream E amendments without assuming consent", () => {
    expect(schema.parse(valid()).eligibility).toBe("PENDING_CONSENT");
  });
  it.each([
    { body: "private artifact" }, { actor_ref: "person@example.test" },
    { stream: "UNKNOWN" }, { event_type: "invented_event" },
    { eligibility_reason: "" }, { stage: "F13" }, { parent_trace_id: id },
    { artifact_ref: "raw document text" }, { stream: "D" },
  ])("rejects invalid metadata %j", (change) => {
    expect(schema.safeParse({ ...valid(), ...change }).success).toBe(false);
  });
  it("requires a reviewed event map", () => {
    expect(() => createTraceEventSchema([])).toThrow(/capture map/);
  });
  it("requires verdict metadata and binds it to the evidence hash", () => {
    expect(schema.safeParse({ ...valid(), verification: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...valid(), verification: { ...valid().verification, evidence_hash: "b".repeat(64) } }).success).toBe(false);
    expect(schema.safeParse({ ...valid(), verification: { ...valid().verification, body: "private" } }).success).toBe(false);
  });
  it("deduplicates the same source version while separating versions and sources", () => {
    expect(traceIdempotencyKey("E", "event-1", hash)).toBe(traceIdempotencyKey("E", "event-1", hash));
    expect(traceIdempotencyKey("E", "event-2", hash)).not.toBe(traceIdempotencyKey("E", "event-1", hash));
    expect(traceIdempotencyKey("E", "event-1", "b".repeat(64))).not.toBe(traceIdempotencyKey("E", "event-1", hash));
  });
});
