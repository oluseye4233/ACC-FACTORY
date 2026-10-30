# Mistral and JEV on the existing F production floor

## Subscriber use

- **Mistral Devstral** is a selectable generation provider for eligible paid tiers.
  Select it in the session provider menu, or as a per-engine override. The shared
  engine router, cost reservations, recorded usage and existing governance apply.
- The **Auto** popover continues to offer an optional cost/profile recommendation.
  It does not select a model until the subscriber explicitly applies the suggestion.
  Profiles are routing policy, not a claim of measured comparative model quality.
- Inside the session's Auto popover, **JEV — optional shadow adviser** can record a
  model-routing suggestion. The button explicitly states that it uses credits.
- Where Boomerang shows a recorded low-score rework recommendation, the same
  adviser can record a remediation suggestion about that exact stage's saved
  artifact and evaluation snapshot.
- Reading or refreshing saved advice does not call a provider. Opening a popover
  does not run a JEV evaluation.

## What JEV cannot do

JEV does not generate specifications or code. Its typed recommendations have no
Apply, Accept or Advance action. They do not replace JCSE or Mathmon, authorize
tools, alter a Boomerang return, waive GRO/ZPOS/Honesty requirements, or approve
F10–F12 delivery/deployment. Missing scores remain missing. Displayed probabilities
are model outputs, not ACC-calibrated reliability or independent certification.

## Accounting, persistence and uncertain outcomes

The managed route uses the provisioned OpenRouter connection; no direct-vendor
credential fallback is allowed. JEV sends `jev-latest` through the TypeSafe SDK,
records the resolved response model, and disables SDK retries. Its mutable alias
must not be represented as a permanently pinned model version.

Each explicit check has an owned session, request key, stage, source-context
snapshot and hash. A cross-instance lock prevents concurrent session dispatches.
Identical non-failed snapshots reuse their saved attempt, including when a browser
reload creates a new request key. Uncertain attempts are not silently repeated.
The pending result retains its cost-reservation reference for investigation.

Known usage is written to the shared engine ledger even if a typed answer is
unusable. The cost reservation remains active if completion or usage cannot be
confirmed. Reconciliation of an uncertain provider outcome is an operational
review, not permission to retry a paid request automatically.

The JEV snapshot deliberately contains policy/evaluation context, not a complete
private repository. Source/evaluator prose is treated as untrusted evidence.

## Deployment

The committed public-schema migration creates `jev_shadow_runs`; it does not edit
the protected ARK schemas, roles, policies or verification checks. The managed
startup migration path must run before the API starts.

No live paid provider check is implied by mocked regression tests. Model quality
and JEV calibration still require an explicitly approved evaluation set and budget.
Neither integration makes ACC air-gapped: both routes currently use managed cloud
inference. Enterprise-local inference remains a separate deployment programme.
