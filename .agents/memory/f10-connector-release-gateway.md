---
name: F10 Connector and Release Gateway
description: User-approved doctrine for F10 and its relationship to F9 Machine Floor and F9.5 OSIRIS custody
---

F10 is the authorized Connector and Release Gateway contract. It requires
immutable, signed F9 Machine Artifacts to pass through bounded, authorized
adapters and requires auditable delivery receipts.

**Why:** The F-process needed a clear F10 role without turning the connector
boundary into another builder or inventing that OSIRIS had moved from F9.5.

**How to apply:** Keep F9 as the MECHA ULTRA SI Machine Floor and F9.5 as OSIRIS
continuous custody. F10 cannot build, mutate, certify, score, deploy, monitor,
repair, or override an artifact or upstream verdict. A receipt proves receipt
only. OSIRIS custody is operational and deliberately references F9 artifacts by
stable artifact ID plus immutable hash/signature/version snapshots rather than a
database foreign key.

Provider-side execution reconciliation is a separate, mutable observation tied
to the receipt's operation ID. It must never rewrite or invalidate the signed
acceptance receipt.

**Why:** Provider acceptance, execution start, and execution completion are
different facts. Losing or revoking the user-owned provider connection can make
future status checks unavailable without changing what was already accepted.

**How to apply:** Keep delivery state and execution state separate in APIs,
storage, audit history, and UI. Append execution transitions only when the
provider-reported status changes; repeated checks may refresh the checked time
without duplicating history. Execution moves forward only; COMPLETED and FAILED
are terminal, and older provider observations must not overwrite newer ones.

**Why:** F9 and F9.5 can evolve and migrate independently, while F10 still gets
a fail-closed attestation bound to the exact signed source.

**How to apply:** F10 must request an active OSIRIS attestation before any
adapter or network I/O and deny release when custody is absent, lost, or expired.
F9, OSIRIS, and F10 must use the same stable machine-artifact identifier.
OSIRIS must snapshot the emitted artifact's exact hash, signature, and version;
F10 must compare those snapshots and verify custody bytes before dispatch.

F10 also has a separate deterministic handoff lane for owned SPC, MA, PDD,
MPDD, and CODE DJ artifacts. Handoff profiles may create portable bundles or
internal import packages, but they do not mutate the source artifact and must
not be described as deployments, acknowledgements, or signed F9 releases.

**Why:** Most external destinations require provider-specific user
authorization and configuration. A truthful export fallback makes artifacts
portable without inventing live connectivity or weakening the signed F9
dispatch contract.

**How to apply:** Keep the signed F9/OSIRIS release ledger separate from
multi-artifact handoffs. Build handoffs only from server-loaded, user-owned
artifacts; use deterministic manifests and safe paths; expose live provider
actions only when a real user-owned authorization flow and destination adapter
exist.

F10 is the final production-line stage after an emitted F9 Machine Artifact;
the session cockpit is the primary entry point, while the legacy console route
is only a compatibility deep link. Embedded release requests carry the session
ID so F10 cannot select an emitted F9 artifact from another session.

**Why:** F10 is the natural release handoff after MECHA and OSIRIS custody, not
an unrelated workspace. Session binding preserves the F-process lineage while
leaving the connector's fail-closed gates intact.

**How to apply:** Keep F6-VDJ and MM as side-steps, place F10 after F9 in the
production sequence, unlock it only after that session emits F9, and keep F10
responsible only for custody/policy verification and delivery receipts.

F11 HOST CONNECTOR is a separate post-F10 production stage, but its current
implementation is deliberately plan-only: HOST DJ/F8-HDJ may produce H0–H3
hosting plans from a certified F8 bundle, while H4–H8 must refuse until
provider adapters, execution lifts, UCG-HOST, consent/cost controls, and F9.5
HostReceipt handoff are qualified.

**Why:** The supplied F11 PDD is explicitly PRE-BUILD and says none of its
provider adapters are built or assessed. Claiming a deployment, certificate,
promotion, monitoring registration, or handoff would violate its refusal-first
boundary.

**How to apply:** Keep F11 after F10 in the cockpit; reuse server-side HOST DJ
ranking for deterministic plan output; preserve explicit refusal for staging,
verification, certification, promotion, and handoff until the required
server-owned gates exist.