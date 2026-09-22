# ATANDA HARNESS — F0-F10 ROLE MODEL & F10 CONNECTOR CONTRACT

**Document Class**: Authoritative Capability & Interface Contract
**Version**: 1.0.0
**Status**: NORMATIVE (v1 Contract definition)

This document formalizes the canonical F0–F10 operational and contract-defined roles within the ATANDA HARNESS. It explicitly distinguishes the operational F0–F8 capabilities from the contract-defined F9, F9.5, and F10 layers.

## 1. THE F0-F10 ROLE MODEL

### 1.1 Source Authority
The role model separates existing product behavior from definitions supplied or authorized for this work:
- **Existing operational roles:** F0–F8 are grounded in the current Command Centre routes, workspaces, and engine contracts.
- **Attachment-defined roles:** F9 and F9.5 come from the supplied MECHA, ATHENA, and F9 Machine Floor documents.
- **New authorized synthesis:** F10 is a new contract created from scratch at the user's direction. It is normative as a design contract but is not yet an operational service.

### 1.2 Canonical Roles (F0-F10)

| Role | Status | Title / Description |
|---|---|---|
| **F0** | Operational | **Advisory / SOLVA Return Point** — The business-intelligence layer and discovery. Deviations and failures from OSIRIS route back here for calibration. |
| **F1** | Operational | **JCSE Diagnosis** — Diagnoses raw prompts against the 7-pillar JCSE rubric (System, Role, Instruction, Example, Constraint, Format, Data). |
| **F2** | Operational | **Atomic Prompt** — Rewrites the diagnosed idea into an executable instruction format. |
| **F3** | Operational | **CELL Micro Agent** — Orchestrates the birth package for a targeted Molecular Agent (persona, guardrails). |
| **F4** | Operational | **Micro PDD** — Drafts an audit and specification document (Micro PDD). |
| **F5** | Operational | **SPC** — Creates a full Super Prompt Card (SPC) system contract. |
| **F6** | Operational | **ATLAS PDD** — Drafts the comprehensive ATLAS product design and implementation document. |
| **F7** | Operational | **SPARTAN** — SPARTAN compressor providing certification against the Universal Certification Gate (UCG). |
| **F8** | Operational | **CODE DJ** — Architecture and codebase scaffolding from a SPARTAN-certified artifact. |
| **F9** | Contract Defined | **MECHA ULTRA SI Machine Floor** — Accepts a device class and emits a bounded, versioned, signed Machine Artifact (or refusal). See *MECHA_ULTRA_SI_SPC_v1_1_1789876471674.md*. |
| **F9.5** | Contract Defined | **OSIRIS Custody** — Continuous monitoring and telemetry. Wraps F10 and routes downstream deviations through SOLVA back to F0. |
| **F10** | Contract Defined | **Connector & Release Gateway** — The external adapter and dispatch gate (see rigorous contract below). |

*Attachment Reference Guidance:*
- `MECHA_ULTRA_SI_SPC_v1_1_1789876471674.md` — Defines F9 MECHA's non-creative, strict gating function.
- `ATHENA.spc_1789876471675.md` — Details the ATHENA capability used as a strand within the broader engine.
- `F9_MACHINE_FLOOR_ATLAS_PDD_v2_0_1789876488481.md` — Contextualizes the boundary between F9 (emission of an artifact) and F9.5 (running process).

---

## 2. F10 CONNECTOR: VERSION 1 CONTRACT

The **F10 Connector & Release Gateway** is the formal release dispatcher. It exists strictly as a gateway, with zero capability to modify the artifact it dispatches.

### 2.1 Purpose & Non-Goals
**Purpose**: To securely and deterministically hand off a signed F9 Machine Artifact into an authorized target or customer repository while preserving uninterrupted OSIRIS custody and producing an auditable receipt.
**Non-Goals**: F10 CANNOT mutate, build, certify, score, deploy, monitor, repair, or override. It is a dispatcher, not an adjudicator.

### 2.2 Immutable F9 Input Envelope
F10 receives a strictly immutable payload from F9:
- `machine_artifact_id`: String identifier.
- `mecha_run_id`: Identifier for the one complete MECHA run that emitted the artifact.
- `artifact_version` and `media_type`: Versioned representation metadata.
- `ucg_certificate`: UCG Certification object.
- `spk_id`: Verified package identifier.
- `payload_hash`: Cryptographic proof of the artifact.
- `artifact_signature`: Signature over the emitted bytes and required lineage.
- `osiris_custody_attestation`: Active custody and telemetry contract.
- `destination_ref`: Reference to approved connector configuration; never raw credentials.
- `release_policy_version` and `expires_at`: Frozen release-policy inputs.

F10 retrieves the artifact from OSIRIS custody. It never accepts caller-supplied replacement bytes. If the hash, signature, lineage, or expiry check fails, F10 blocks the release.

### 2.3 Prerequisites (UCG / MM / SAVANT / OSIRIS)
F10 verifies signatures and required upstream verdicts:
- **UCG**: Must hold `PASS` or threshold equivalent.
- **MM (MathMon)**: Must hold `MATH_VERIFIED`.
- **SAVANT**: Must hold `FIT` or `CLUSTER`.
- **OSIRIS**: Must have registered `osiris_custody: true` (F9.5 initialization).

If any prerequisite is missing, invalid, expired, or non-passing, F10 records a cited `BLOCKED` release. It does not send the artifact or silently waive a gate.

### 2.4 F10 States
- `REQUESTED`: A release intent has been durably recorded.
- `VERIFYING`: Ownership, custody, signatures, verdicts, policy, destination, and expiry are being checked.
- `AUTHORIZED`: The immutable policy snapshot permits release.
- `QUEUED`: A bounded delivery attempt is ready to claim.
- `DISPATCHING`: One claimed attempt is in flight.
- `ACKNOWLEDGED`: The downstream system accepted receipt and F10 stored a signed receipt.
- Terminal states: `BLOCKED`, `FAILED_PERMANENT`, `DEAD_LETTERED`, or `CANCELLED`.

Every transition is append-only and records actor, timestamp, reason, attempt token, and policy version.

### 2.5 Authorization & Policy Snapshot
F10 authenticates the actor, checks tenant ownership and destination scope, and freezes the authorization policy before network I/O. It rechecks revocation immediately before dispatch. The policy hash and authorization decision are attached to the release record; secrets are not.

### 2.6 Adapter Interface
F10 uses a bounded external adapter interface:
```ts
interface F10ReleaseAdapter {
  validate(configRef: string): Promise<void>;
  deliver(envelope: ReadonlyEnvelope, idempotencyKey: string, deadline: Date): Promise<AdapterResult>;
  classify(error: unknown): "retryable" | "permanent";
  health(): Promise<"available" | "degraded" | "unavailable">;
}
```
The adapter may frame or compress transport, but it cannot alter the signed payload, lineage, or upstream verdicts.

### 2.7 Invariants
1. **Zero Mutation**: F10 modifies no bytes of the SPK package.
2. **Custody Encapsulation**: F10 operates *within* F9.5 OSIRIS custody. OSIRIS monitors the artifact before, during, and after F10.
3. **Receipt = Receipt**: A signed delivery receipt proves *receipt only*, not successful execution or deployment on the target.
4. **No Verdict Override**: F10 cannot promote, waive, downgrade, rescore, or reinterpret an upstream verdict.
5. **No Artifact, No Release**: A refusal, non-emitted artifact, expired artifact, or custody loss can never be delivered.
6. **One Logical Delivery**: `(artifact hash, destination, release intent)` identifies one logical delivery across retries and late acknowledgements.

### 2.8 Idempotency, Retries, and DLQ
- **Idempotency**: F10 derives a deterministic key from artifact hash, destination identity, and release intent. Duplicate calls return the existing in-flight state or receipt.
- **Attempts**: Intent is persisted before I/O; each attempt is claimed with a fencing token so stale workers cannot finalize a newer attempt.
- **Retries**: Exponential backoff with jitter applies only to timeouts, rate limits, and transient 5xx failures, honoring `Retry-After`.
- **Permanent failures**: Authentication, authorization, policy, schema, hash/signature, expiry, and non-retryable 4xx failures never auto-retry.
- **DLQ (Dead Letter Queue)**: If the adapter fails after max retries, the envelope routes to the DLQ for manual inspection.

### 2.9 Signed Delivery Receipts
Upon adapter completion, F10 signs a `DeliveryReceipt`:
```json
{
  "receipt_id": "F10-REC-...",
  "release_id": "...",
  "spk_id": "...",
  "machine_artifact_id": "...",
  "artifact_version": "...",
  "payload_hash": "...",
  "destination_identity": "...",
  "adapter_id": "...",
  "adapter_version": "...",
  "attempt": 1,
  "timestamp": "ISO8601",
  "downstream_status": "accepted",
  "downstream_receipt_id": "...",
  "snapshot_policy_hash": "...",
  "f10_receipt_signature": "..."
}
```

### 2.10 Failure Routing
Failures trigger a cited Deviation Report routed to F9.5 (OSIRIS). OSIRIS retains custody and invokes SOLVA to return systemic calibration work to F0. F10 never silently re-enters F9 and never repairs the artifact itself.

### 2.11 Observability
F10 emits exact state transitions, policy decisions, attempt timing, normalized result class, and receipt identifiers to the central audit log. Logs exclude secrets, raw response bodies, and artifact contents. Operators must be able to trace one release from request through acknowledgement or terminal failure.

### 2.12 Security
- F10 endpoints must enforce strict TLS.
- Adapter secrets (API keys, Git tokens) must be injected strictly at runtime and never logged in the observable output.
- Connector configuration must use references to secret storage, not credentials embedded in requests or artifacts.
- Destination validation must resist SSRF, DNS rebinding, redirect escape, and confused-deputy cross-tenant access.
- Payload size, media type, timeout, redirect, and response-body limits are mandatory per adapter.
- Authorization is least-privilege, revocable, tenant-scoped, and destination-scoped.

### 2.13 Acceptance Criteria
- A valid, passing, in-custody F9 artifact can reach `ACKNOWLEDGED` through a conformant mock adapter.
- Mutated, unsigned, expired, refused, non-passing, or custody-lost artifacts reach `BLOCKED` without network I/O.
- Duplicate release requests and late acknowledgements reconcile to one logical delivery and one final receipt.
- Successful dispatch yields a signed, schema-conformant `DeliveryReceipt`; the UI states that receipt does not prove deployment or execution.
- Retryable and permanent failures follow their distinct policies; retry exhaustion reaches `DEAD_LETTERED`.
- Authorization revocation immediately before dispatch prevents delivery.
- No log, metric, transition, or receipt leaks secrets or artifact contents.
