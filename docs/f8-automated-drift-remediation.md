# F8 automated drift remediation

## Operator flow

1. Run a PFP drift check on an F8 bundle and its certified MVP PDD.
2. Select **AUTO REMEDIATE + RE-DRIFT CHECK**. This explicitly authorizes one
   automated CODE DJ / BUGMXT correction pass and a separate fresh PFP call.
3. The server resolves the exact report, original bundle and certified PDD.
   Ownership, session, types, certificate and source links must match.
4. CODE DJ produces a complete corrected bundle and a finding-to-correction
   checklist. Platform and existing files must be retained. Firmware class,
   hardware profile and PDD lineage remain attached.
5. Sources are checked again before saving. Originals are never overwritten.
6. The corrected bundle is saved, then a fresh PFP check starts immediately.
   Severity counts and verdict are recomputed using the existing PFP rules.
7. F8 shows the fresh report on the corrected bundle. Boomerang receives a
   RETURNED supporting-work case with original and corrected evidence IDs,
   anchored to the post-remediation source snapshot for human review.

## Outcomes

- **RECHECKED:** the new check completed; inspect its actual verdict. This
  state does not imply PASS. Findings may remain.
- **REVIEW REQUIRED:** changing or interpreting approved requirements requires
  human review. No replacement bundle is generated and no PFP call is made.
  Specification rework uses the existing Boomerang/SPC Player/F1 path followed
  by the applicable approval gates; automation does not rewrite the contract.
- **RECHECK FAILED:** the correction is retained but PFP could not complete,
  including budget/provider failures. Use **RE-DRIFT CHECK** on the new bundle
  immediately or after resolving the failure; there is no fabricated verdict.

Both model calls use the shared reservation and cost ledger. Architect tier,
F8 daily limits and the route cost gate apply. Streaming heartbeats prevent a
long combined request from remaining silent. There is no unbounded retry loop.

## Boundaries

This repairs generated bundle content, not the running platform or a remote
repository. It does not execute generated commands, tests or deployment.
PFP is the existing model-based internal fidelity evaluation, not independent
test evidence. Prior CI/IDE verification and hosting results are not inherited
by the new bundle. No Boomerang case is automatically accepted, and no stage,
badge, certificate or protected release gate is advanced.

## Interruption recovery and review comparison

Repair attempts now have owner-scoped durable progress separate from immutable
artifacts. One database advisory lock excludes concurrent workers. Completed
repair results, saved bundles and saved PFP reports are reused after a retry.
Completed results can be restored via the read-only progress endpoint without
a model call or a daily-run charge. After a known pre-dispatch budget denial,
an explicit resume retries only the denied phase.

If a worker stops after dispatch but before saving the provider's result, the
outcome is unknown. The system refuses another automatic dispatch. Review the
model ledger before explicitly requesting another check. This is conservative
duplicate-charge prevention, not a claim of provider-level exactly-once billing.
There is no automatic retry loop.

Boomerang F8 reviews now compare original and corrected file content, with
added/removed/changed/unchanged labels and plain-text line changes. The view
checks owner-protected artifact responses, session, journal, PDD and report
links before displaying a comparison. Unavailable or mismatched evidence is
reported, not inferred. Large comparisons show complete replacement text with
an explicit notice rather than silently truncating.

The recovery upgrade adds public-schema application migrations for bookkeeping.
Development/replay applies the committed migrations; production must include
the new table in its reviewed Publish schema plan. The separate ARK startup
migrator does not apply this public migration. No ARK security migration,
protected workflow role, policy, approval or certification gate is changed.
