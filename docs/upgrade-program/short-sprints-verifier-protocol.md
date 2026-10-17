# SHORT SPRINTS verifier and release protocol

Status: implemented local control workflows. A signed receipt authenticates an
approved issuer's report; it does not itself run tests, deploy software, route
traffic or prove that an issuer actually performed its claimed checks.

## Trust setup

1. A curator registers an external verifier's Ed25519 **public** key in Short
   Sprints → Verifier authorities. Never upload its private key.
2. Approve the issuer's real operating procedure, independence, evidence ledger
   and allowed scopes. Record the governance reason. Registration is restricted
   to administrators, not ordinary publishers.
3. Choose the actual mechanism: `DETERMINISTIC` (I2), `CROSS_MODEL` (I1) or
   `HUMAN` (I3). Cross-model receipts must identify different, recognized model
   families; aliases of the same family do not establish independence.
4. Give a HUMAN authority its real reviewer's name. F11 receipts must match
   that registered name. A provider/model is not a named human sign-off.
5. Revoke compromised keys. Forward gates revalidate expiry, revocation,
   source version and the entire current pack; old UI status is not permission.

## Payload and signing

The executable specification is
`artifacts/api-server/src/lib/artifact-operations/sprint-evidence.ts`.
Use its exported receipt schema and `signingMessage(payload)`; use the
eligibility schema in `short-sprint-eligibility.ts` for all 13 fact records.

Envelope: `{ "payload": { ... }, "signature": "<base64 Ed25519 signature>" }`.
The payload contains protocol `ATANDA-SS-1`, authorityId, workflowId, sourceHash,
scope, PASS/FAIL/INCONCLUSIVE verdict, issuedAt, expiresAt, evidenceHash, checks,
and scope-specific bindings. Receipts expire within 31 days. Timestamps are UTC.

Sign these UTF-8 bytes with Ed25519:

```
ATANDA-SHORT-SPRINTS-1\n<lowercase SHA-256 of canonical payload JSON>
```

Canonical JSON is the repository's `hashContent`/`artifactOutputHash` convention:
keys sorted recursively; array order retained; JSON scalar encoding; no added
whitespace. Use the supplied JavaScript helper to avoid cross-language number
encoding differences. The private key stays with the verifier.

In JavaScript, import `sign` from `node:crypto`, then produce
`sign(null, signingMessage(payload), privateKey).toString("base64")`.
Do not print or store that private key in the platform.

The external issuer must calculate evidenceHash from its real, retained
evidence—not from a caller-supplied success flag. Test fixtures are not live
verification and must never be used for a customer release.

## Source qualification and test pack

1. Create a persisted SC ONE proposal from F4 or SC TWO proposal from F5.
   Firmware is directed back to the full machine-floor route.
2. Export the selected source/configuration for the verifier. A download is
   explicitly **not** release authorization.
3. A SOURCE_CERTIFICATION receipt must bind this exact source and report
   `FULL_STAGE_BLOCKING_TRACKS`, `SOURCE_VERSION_BOUND`, `NO_OPEN_CRITICAL`.
   Each eligibility fact requires a value and an evidence hash. A legacy
   FORGE flag, a score, an owner assertion or advisory PASS is insufficient.
4. A named operator chooses YES, NO or DEFER. Only YES on eligible, trusted
   evidence reserves the short route and marks its bypassed stages
   `SKIPPED_BY_SC`; those stages are not COMPLETE. Prior state is retained.
5. Import actual E/R/C receipts. SC TWO also requires J/S. Regulated work
   additionally requires HUMAN Track H.
6. Run Pack verifies these receipts:
   - E: UNIT_TRAJECTORY, LYSOSOME_STRESS, CONTRACT_CONFORMANCE, FAIL_CLOSED.
   - R: INJECTION, POISONED_PREMISE.
   - C: MANIFEST_CUSTODY.
   - J: CROSS_MODEL_QUALITY, with different recognized model families.
   - S: SASS_MATCH.
   - H: HUMAN_REVIEW.
7. Track E must identify the real evalset hash and its independent
   preregistration time, before the selected source's creation. SC TWO's SASS
   must name that same evalset hash. Issuers must verify their own preregistered
   ledger, not backdate a caller's claimed time.
8. PASS creates private, immutable package files and a sealedManifestHash
   covering **all** file byte hashes. packHash covers the current proof set.
   FAIL creates an actual VTE failure case; missing proof is INCONCLUSIVE.
   No rejected model output is automatically captured for a training corpus.

### Exact exported bytes

Proposal creation archives the exact UTF-8 strings for every shipped file.
Exports and package assembly verify each name, SHA-256 and byte count against
the original manifest. They do not regenerate those strings from JSONB, which
can reorder object keys and therefore change serialized file hashes.

Historical pre-archive proposals are not silently repaired or given rewritten
manifest hashes. If their original bytes cannot be recovered and matched,
export fails explicitly and the operator must create a new proposal. Published
Final files and their metadata are immutable; revisions create new versions.

## Custody, handoff and full staged-release control

All downstream receipts must bind the current packHash **and**
sealedManifestHash, and be issued after package creation.

1. F95 OSIRIS receipt: CUSTODY_SEALED. Seal the exact package.
2. P: PROVIDER_TERMS_CURRENT.
3. F10: PROVIDER_READY and REGRESSION_BASELINE_PASS.
4. F11 HUMAN: HANDOFF_COMPLETE and NAMED_RELEASE_SIGNOFF, matching the
   registered named reviewer.
5. F12 stage `5`: HEALTH_WINDOW_PASS, ROLLBACK_READY, ERROR_BUDGET_PASS,
   a public HTTPS healthUrl and a real rollbackReference.
6. Repeat with **later** F12 receipts for stages `25`, then `100`. A missing,
   stale, revoked, out-of-order or differently bound receipt cannot advance.

The custody → F10 → F11 → 5 → 25 → 100 timestamps must be strictly ordered.
LIVE means an approved provider **reported** the completed sequence. The
platform does not infer deployment or traffic movement from a button click.
A real external execution/health/rollback service must perform those actions.

A FAIL/INCONCLUSIVE F12 receipt moves the run to ROLLBACK_REQUIRED. It does
not pretend that traffic stopped. A newer, correctly bound F12 receipt with
ROLLBACK_EXECUTED records provider-reported rollback; the operator can then
withdraw and restore the saved full-path state. An unrelated proposal cannot
reset another active route's skipped stages.

## Resolution and promotion

- A HUMAN H receipt with VTE_RESOLUTION_APPROVED must identify the actual
  caseId and the current passing packHash to close its VTE case.
- A separate HUMAN H receipt with SPHINX_PROMOTION_APPROVED binds promotion
  approval to the current passing pack. Promotion resumes the full route at
  F5/F6 while retaining the released version. It does not open the public
  marketplace or grant a new deployment authorization.

## Operational limits and release blocker

- Azure Key Vault remains the user-authorized Class B deferral. Private
  document/package bytes use Replit Object Storage.
- Real approved external verifier and provider execution/health/rollback
  connections have not been supplied or demonstrated. The included automated
  lifecycle tests use synthetic, explicitly labelled receipts and remove them.
- On 2026-10-16 the production database did not yet contain these workspaces.
  The read-only proposed Publish diff was additive, but omitted the restricted
  operations role, FORCE RLS and immutability triggers, and emitted policies
  without their USING/WITH CHECK predicates. Do not treat this plan as safe
  to publish. The runtime refuses private artifact operations when those
  database guards are missing; it does not fall back to a superuser connection.
- No production DDL, build-time migration hook or startup self-healing is
  added to bypass the managed Publish process. Production database guards must
  be carried over correctly and verified before this release is recommended.
