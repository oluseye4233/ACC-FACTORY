# Protected workflow readiness hardening

Scope: the existing **public-schema** IMPRIMA and SHORT SPRINTS protected
workflows. This is not installation of the separate ARK schemas, a platform-wide
tenant-RLS rollout, independent verification, or production activation.

## What changed

The read-only readiness check now requires nine checks to pass:

| Check | Required evidence |
|---|---|
| Restricted role | Non-login role without superuser, bypass-RLS, role/database creation or replication capabilities |
| Role membership | The checking connection can assume the restricted workflow role |
| Required permissions | Public-schema usage and every required SELECT/INSERT/UPDATE privilege, including trace, feature-state and VTE tables |
| Forced RLS | Both enabled and forced on all five protected workflow tables |
| Owner policies | Exact reviewed policy command, PUBLIC binding, permissive mode, USING and WITH CHECK expressions |
| Authority policies | Exact reviewed authenticated-read and administrator-write definitions |
| Policy scope | No additional permissive policies that could OR broader access into the reviewed rules |
| Immutable versions | Both unconditional, full-row BEFORE UPDATE triggers, their enabled state, reviewed PL/pgSQL implementation and function configuration |
| Forbidden privileges | No protected-table ownership, public-schema creation, DELETE/TRUNCATE on the nine workflow-accessed tables, or UPDATE on immutable files/events |

The positive privilege matrix is:

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| imprima_jobs | Yes | Yes | Yes |
| imprima_files | Yes | Yes | No |
| short_sprint_runs | Yes | Yes | Yes |
| artifact_operation_events | Yes | Yes | No |
| sprint_verifier_authorities | Yes | Yes | Yes |
| harness_artifacts | Yes | No | No |
| harness_feature_state | Yes | Yes | Yes |
| command_deck_traces | Yes | Yes | No |
| vte_verification_failures | Yes | Yes | Yes |

“No” means the workflow does not require that privilege. The forbidden-privilege
check separately enforces the explicit restrictions above; the matrix is not a
claim that every other privilege has been revoked.

Before invoking a protected workflow callback, the transaction also verifies
that SET LOCAL ROLE actually selected the non-bypass role. Actor UUID and
administrator boolean remain bound values with transaction-local settings.
Failure does not fall back to the database owner.

The UI names failed checks instead of incorrectly describing every failure as
an uninstalled database layer. Private preparations remain a separate lane.

## Deliberate fail-closed behavior

Policy expressions and the immutable-version function body are compared with
the reviewed definitions, not substring searches. A predicate containing the
expected actor setting plus `OR true`, or a same-named no-op trigger function,
must not pass.

A database upgrade or legitimate reviewed guard revision that changes catalog
serialization may therefore require updating the reviewed contract. Investigate
the difference; do not replace the comparison with a broader text search or
silently reinstall a guard. Additional restrictive policies do not create an
OR bypass, but may independently restrict workflow execution.

## Verification and remaining work

- Development catalog checks and real restricted-transaction context probes
  are read-only. No protected fixture rows are created by these new probes.
- Unit tests cover broadened/missing/extra policy definitions, wrong command
  and role bindings, missing positive privileges, role-switch failures and
  transaction-local actor/admin parameters.
- Development evidence is not production parity. A production catalog replica
  is also not the application's actual runtime login.
- No security DDL, role grants, policy changes, migration-ledger edits or
  production installation is part of this change.
- The broader subscriber-isolation rollout, unresolved dependency advisories,
  independent evaluators and externally governed release gates remain separate
  work. A green readiness panel is not their certification.

## Read-only environment evidence — 2026-10-22

Development passed all nine readiness checks. Real restricted-role and
transaction-local context probes also passed without creating protected
workflow records.

The managed production catalog snapshot returned:

- `atanda_artifact_operations` does not exist. Its required privileges cannot
  be established; the replica's checking identity is not an attestation of the
  live application's login.
- RLS is enabled on all five workflow tables, but FORCE RLS is false on each.
- All seven expected policy names exist, but their catalog predicate
  expressions are null. Names alone do not implement the reviewed rules.
- Neither expected immutable-publication trigger exists.

These are configuration blockers, not a reason to relax the readiness check.
No production installation or security change was performed. A reviewed,
approved administration path and subsequent catalog **and actual runtime-role**
verification are still needed before enabling the protected lane. Publishing
ordinary application updates is not evidence that those guards were installed.
