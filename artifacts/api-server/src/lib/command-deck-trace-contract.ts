import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Command Deck MAX §4.5, plus VTE §4.1 and UPG-STG-001.
 * Contract only: registering F12/Stream E here does not activate those stages,
 * grant corpus consent, persist an event, or prove independent enforcement.
 */
export const traceStages = [
  "F0", "F0.5", "F1", "F2", "F3", "F4", "F5", "F6", "F7",
  "F8", "F9", "F9.5", "F10", "F11", "F12",
] as const;
export const traceStreams = ["A", "B", "C", "D", "E", "NONE"] as const;
export const verificationEventTypes = [
  "xvl_verdict", "xvl_waiver", "failure_case_opened", "failure_case_repaired",
] as const;

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const opaqueToken = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

/**
 * Event names come from a reviewed capture map, never from request data.
 * A strict metadata envelope prevents accidental storage of bodies/PII.
 * Producers must additionally enforce ownership, consent, signatures and
 * atomic persistence at their boundary; validation alone grants no authority.
 */
export function createTraceEventSchema(eventTypes: readonly string[]) {
  if (!eventTypes.length || eventTypes.some((v) => !/^[a-z][a-z0-9_]{0,79}$/.test(v))) {
    throw new Error("A nonempty reviewed capture map is required");
  }
  const allowed = new Set(eventTypes);
  return z.object({
    trace_id: z.string().uuid(),
    parent_trace_id: z.string().uuid().nullable(),
    stage: z.enum(traceStages),
    stream: z.enum(traceStreams),
    event_type: z.string().refine((v) => allowed.has(v), "Event is not in the capture map"),
    // Canonical artifact id + immutable version digest; never raw text or URLs.
    artifact_ref: z.string().regex(/^[0-9a-f-]{36}@[a-f0-9]{64}$/).nullable(),
    exemplar_id: z.string().regex(/^EX-[A-Z0-9-]+-[A-Z0-9]{4}-[0-9]{6}$/).nullable(),
    actor_ref: opaqueToken,
    occurred_at: z.string().datetime({ offset: true }),
    payload_hash: sha256,
    verification: z.object({
      run_id: z.string().uuid(),
      track: z.enum(["S", "E", "J", "R", "H", "C", "P", "B"]),
      verdict: z.enum(["PASS", "FAIL", "INCONCLUSIVE", "NOT_RUN", "WAIVED"]),
      independence: z.enum(["I0", "I1", "I2", "I3"]),
      evidence_hash: sha256,
    }).strict().optional(),
    eligibility: z.enum(["ELIGIBLE", "NOT_ELIGIBLE", "PENDING_CONSENT"]),
    eligibility_reason: z.string().trim().min(1).max(500),
    idempotency_key: sha256,
    processing_status: z.enum(["PENDING", "DONE", "FAILED", "DEAD"]),
  }).strict().superRefine((value, ctx) => {
    if (value.parent_trace_id === value.trace_id) {
      ctx.addIssue({ code: "custom", path: ["parent_trace_id"], message: "A trace cannot fork from itself" });
    }
    if (verificationEventTypes.includes(value.event_type as typeof verificationEventTypes[number]) && value.stream !== "E") {
      ctx.addIssue({ code: "custom", path: ["stream"], message: "Verification events belong to Stream E" });
    }
    if (value.event_type === "xvl_verdict" && !value.verification) {
      ctx.addIssue({ code: "custom", path: ["verification"], message: "Verdict metadata and evidence reference are required" });
    }
    if (value.verification && (!verificationEventTypes.includes(value.event_type as typeof verificationEventTypes[number]) ||
      value.verification.evidence_hash !== value.payload_hash)) {
      ctx.addIssue({ code: "custom", path: ["verification"], message: "Verification metadata must match its reviewed event and evidence hash" });
    }
  });
}

export function traceIdempotencyKey(stream: typeof traceStreams[number], sourceId: string, versionHash: string) {
  z.enum(traceStreams).parse(stream);
  z.string().min(1).max(256).parse(sourceId);
  sha256.parse(versionHash);
  // Tuple encoding avoids separator collisions. Source id identifies the
  // individual source event, not a whole session with many transitions.
  return createHash("sha256").update(JSON.stringify([stream, sourceId, versionHash])).digest("hex");
}
