# BUGMXT-guided SHORT SPRINTS debugging checkpoint

**Date:** 2026-10-16. **Scope:** eligibility policy and owner-only diagnostic UI.

Source: `attached_assets/BUGMXT_SI_1792173453087.md`, especially the five-layer
engine, PDD Fidelity Protocol and execution assurance sections. Applied as a
review method, not a claim that an independent BUGMXT engine ran, that its
supplied certification transfers to this repository, or that the full upgrade
program is complete.

## Findings and remedies

| ID | Priority / exposure | Finding | Remedy |
|---|---|---|---|
| PFP-SS-001 | HIGH; latent internal-policy risk, not an observed live release bypass | Structurally positive facts could yield ELIGIBLE without explicit source-stage certification | Both circuits require a separately evidenced F4/F5 certification fact. Preflight never infers it from legacy VERIFIED/forgeVerified flags, model scores or advisory contract PASS |
| PFP-SS-002 | HIGH; latent profile-gate omission | Regulated candidates displayed H/C as required but their inclusion was not an eligibility condition | Add a governed H/C inclusion rule. Selecting a diagnostic profile does not satisfy it |
| PFP-SS-003 | HIGH; spec drift | SC TWO did not check declared tool permissions | Add a permission-declaration eligibility rule |
| LOGIC-SS-004 | MEDIUM; version-binding gap | Positive synthetic facts could qualify while selected source hash was absent | Require a usable selected source version; bind policy input and diagnostic hashes to it |
| PFP-SS-005 | MEDIUM; missing user-visible inspection | Eligibility existed only as an internal module | Add an authenticated owner-only preflight endpoint and panel on the session verification page |
| SYNTAX-SS-006 | HIGH; development preview rendering | Explicit generic JSX passed TypeScript but failed preview metadata instrumentation; removing the types then widened enum callbacks | Bind the typed selectors outside JSX, preserving type safety and valid preview transformation |

## Five-layer application

1. **Syntax:** contract-first endpoint, regenerated shared clients and schemas,
   full workspace typechecking. The generator's query-type/Zod-value export
   collision is handled reproducibly in its existing postprocessor.
2. **Logic/outcomes:** negative owner tests; unknown-versus-fail semantics;
   exact time boundary tests; hash changes when source content changes;
   refusal to treat a missing measurement as zero or a missing finding as a
   clean critical review.
3. **HARP:** focused policy, preflight resolver, route and UI modules; descriptive
   rule IDs and plain-language remedies. No automated readability score claimed.
4. **PDD fidelity:** maps to SS-ELG-001/002/003/004/005 and the eligibility
   matrix. All remain distinct from SS-GATE/SS-RTE release actions.
5. **Execution assurance:** targeted real-database/API regressions, UI
   verification and build checks are recorded in `verification-checkpoint.md`.
   No estimated exploit probability, fabricated timing or composite score.

## Working behavior and evidence limits

- `GET /api/harness/sessions/:sessionId/short-sprints/preflight` accepts only
  circuit, target and profile. Authentication is mandatory; foreign and absent
  sessions produce the same 404. Owner-supplied fact/certification assertions
  and artifact selection are rejected.
- Chooses the latest owner-held F4 MICRO_PDD or F5 SPC deterministically.
  Source content is bounded inside the database query before transfer and is
  never returned to the browser. Recomputes content hashes; does not rely on a
  potentially stale stored hash.
- F4 JSON Interface Contract presence is observable, including a single JSON
  code fence. Presence is **not** proof of semantic conformity or certification.
- Current legacy records do not establish complete source lineage, MA build
  start/end boundaries, absence of CRITICAL findings, governed profile
  inclusion or full F4/F5 certification. Those facts remain UNKNOWN. Whole
  session prompt totals and model-call durations are not valid substitutes.
- Firmware still lists F9; all candidates retain F9.5/F10/F11/F12 and required
  verification packs. Regulated lists H/C without pretending they were added.
- The panel supports both circuits, target/profile options, refresh and a
  clearly labelled JSON diagnostic snapshot. Choices are temporary and
  snapshots are reports, not immutable certified platform artifacts.
- No gate decision is persisted; no routes, stages, artifact flags, corpus
  permissions or release state are changed. SS-ELG-003 remains partial until
  trusted adapters and durable assessment records exist.

## Unchanged fundamental limits

Full independent XVL/VTE, SHORT SPRINTS gate/route operations, F12 provider
health/recovery and IMPRIMA publishing remain incomplete. Security remediation
and database-isolation work are tracked separately; this checkpoint does not
silently implement or satisfy those queued goals. Azure remains a deferred
Class B requirement. No production activity or publication is inferred.
