# Closed gates: root cause, fixes and opening sequence — 2026-10-26

Responds to *ATANDA Completion and Production Audit, 26 October 2026*
(`docs/Production_Read_Only_Audit_and_Remaining_Fixes_2026-10-26.md`). Nothing
in this change touches production. It adds the tooling an authorized
administrator needs to clear the P0 gate, and a serving-revision stamp for R1.
Opening a gate is still a reviewer's decision, not this document's.

## 1. Root cause of the CLOSED protected IMPRIMA / SHORT SPRINTS gate

The guards exist in source and pass in development: migrations `0048`
(role, grants, FORCE RLS, exact policies), `0050` (immutable-version function
and triggers) and `0051` (DELETE/TRUNCATE/UPDATE revokes).

Production is changed only by managed Publish, which **diffs the dev schema
against prod and applies the table/policy-name differences**. It does not
carry roles, grants, `FORCE ROW LEVEL SECURITY`, policy predicates, functions
or triggers. That matches the production catalog exactly (audit E5–E9):

| Audit finding | Why Publish produced it |
|---|---|
| `atanda_artifact_operations` absent | Roles aren't part of a schema diff |
| RLS enabled, not forced | `.enableRLS()` is in the Drizzle schema; FORCE is custom SQL only |
| 7 policy names, NULL predicates | Policy names were diffed; the expressions were not applied |
| Both immutable triggers absent | Function/trigger are custom SQL only |
| Privilege matrix NULL | Follows from the missing role |

So further Publishes will **never** close this gate. It needs one
reviewed administrator installation, as the audit says.

## 2. What this change adds

| File | Purpose | Audit item |
|---|---|---|
| `db/production-guard/verify_artifact_operations_guard.sql` | Read-only, single-SELECT PASS/FAIL matrix of the nine readiness checks. Safe on the read-only replica. Uses the same exact comparisons as `database-protection-contract.ts` | R2, R3 |
| `db/production-guard/install_artifact_operations_guard.sql` | Administrator-run, single-transaction, idempotent installation copied from 0048/0050/0051. Runs the verifier at the end and **rolls everything back** if any check fails. Refuses to proceed (and changes nothing) if an unreviewed permissive policy exists | R2 |
| `db/production-guard/runtime_probe_artifact_operations.sql` | Actual-runtime-role probe, run with the API's own credentials. Covers the role switch, owner isolation, cross-owner insert refusal, DELETE/TRUNCATE/CREATE refusal, and immutable Final. Always ROLLBACK | R3 |
| `artifacts/api-server/build.mjs`, `src/routes/health.ts` | Stamps the git commit into the bundle; `/api/health`, `/api/readyz` and `/api/launch-readiness` return it as `X-Serving-Revision` (`<sha>`, `<sha>-dirty`, or `unknown`) | R1 |

### Local evidence (development replica of the production state, PostgreSQL 16.15)

A local database was built to match the audited production catalog (RLS on and
not forced, seven predicate-less policies, no role, no triggers, owner
`neondb_owner` with BYPASSRLS):

- **Before:** the verifier returned the same matrix as the audit. That was 4 FAIL, 3 FAIL PREREQUISITE (`role_membership`, `required_permissions`, `restricted_permissions`), 1 FAIL for `restricted_role`, and PASS for `policy_scope`.
- **Install:** all 9 PASS. Re-running converged with no errors (idempotent).
- **Runtime probe:** role_switch, owner_isolation, cross_owner_insert_refused, destructive_and_immutable_privileges_refused and final_immutable all PASS. Row counts were unchanged afterwards.
- **Negative cases all fail closed:**
  - A policy broadened with `OR true` gives `owner_policies` FAIL.
  - An extra `USING (true)` policy makes the install refuse and roll back, and `policy_scope` FAILs.
  - A disabled trigger gives `immutable_versions` FAIL.
  - A login without membership gets `permission denied to set role`.
  - Omitting `app_login` changes nothing and exits non-zero.

This is development evidence on a simulated catalog. It is **not** production
evidence and does not open the gate.

## 3. Runbook to open the protected gate (R1 → R2 → R3)

Owner: administrator + security reviewer + engineering (gate register lane).

1. **R1: pin the serving revision.** Merge this change and Publish. Then
   `curl -sI https://command-center.atanda.ai/api/readyz | grep -i x-serving-revision`
   should give the merged commit SHA. A `-dirty` or `unknown` value means
   the build cannot be matched to a commit. Fix that before going on.
2. **Identify the runtime login.** Find the role the published API actually
   connects as (the user in the deployment's `DATABASE_URL`, not the replica's
   checking user). The audit could not establish it. Record it as dated evidence.
3. **Review.** The security reviewer reads
   `install_artifact_operations_guard.sql` against 0048/0050/0051 and
   `database-protection-contract.ts`. Two points to confirm:
   - With FORCE RLS on, the owner connection only sees protected rows inside
     `withOperationsActor`. This is already how development runs, but confirm
     no other production job reads these five tables directly as the owner.
   - Take a backup or branch snapshot (Neon branch) first, for rollback.
4. **Pre-check (read-only):** run `verify_artifact_operations_guard.sql`
   on the replica and file the output. It should match the audit.
5. **Install (administrator, maintenance window):**
   ```
   psql "$PROD_ADMIN_URL" -v app_login='<runtime login from step 2>' \
        -f db/production-guard/install_artifact_operations_guard.sql
   ```
   It either commits with all nine PASS, or rolls back with the failing
   check named. Never edit the checks to get a PASS.
6. **R3: runtime proof.** Run `runtime_probe_artifact_operations.sql` with
   the **API's** credentials. Then load the verifier panel in the signed-in
   app: `databaseProtection()` must report ready from the real runtime
   identity. File both outputs, dated, with the revision from step 1.
7. **Only then** may a reviewer mark *Protected IMPRIMA and SHORT SPRINTS*
   ready for its pilots (R8). Readiness of the database guard is not
   independent verification, external approval or a release decision.

**Rollback:** the install is a single transaction. If something goes wrong
after commit, restore the snapshot from step 3. Do not hand-drop individual
guards; that would leave a partially protected lane that looks configured.

## 4. Every gate: status, fix and who can move it

| Gate | Blocker | Fix / exit evidence | Engineering (can be done in code) | Needs a human / external party |
|---|---|---|---|---|
| Published core (R1) | No immutable serving revision | `X-Serving-Revision` header (this change) + one signed-in smoke journey | Done in this change | Publish, then run the smoke check |
| Protected IMPRIMA / SHORT SPRINTS (R2, R3) | Role, FORCE RLS, predicates, triggers missing in prod | §3 runbook | Install/verify/probe scripts (this change) | Administrator install, security review |
| Invariant register (R4) | 129 invariants / 243 prompts all UNVERIFIED | Attach revision + dated evidence per entry | Script to fill the register from test runs + the revision header | Assessor sign-off per invariant |
| Regression triage (R5) | #330, #112, #239, #93, #195, #92, #296 unconfirmed | Reproduce each on the published revision; fix or close with evidence | Write reproduction tests and fixes per issue | Prioritization |
| Paid journey (R6) | Checkout and entitlement not attested | Live price/checkout/workspace-entry check (#346, #347) | Fix code-side mismatches | Stripe account and price decisions |
| Independent XVL/VTE (R7) | Incomplete per live readiness | One source-bound case with a real fail/inconclusive path | Harness and receipt plumbing | A genuinely independent verifier |
| IMPRIMA / SHORT SPRINTS pilots (R8) | Blocked by R2–R3 | One real end-to-end case each, with rejection and recovery | Pilot tooling | Named approval/publication authority |
| F10 → F11 (R9) | Provider-specific | Real provider authorization, artifact-bound receipt (#335, #336) | Adapter code | Provider account, scopes, real target |
| F12 (R10) | Incomplete | Failed-health hold, staged promotion and proven rollback on one real target | Health/rollback automation | Operations + release approver |
| SPHINX public (R11) | Closed at source API | Consent, qualification, withdrawal and receiver reconciliation | Sync and withdrawal code | Marketplace, legal, product decision |
| Core QA (R12) | Authenticated journeys unverified (#323–#325, #333, #344) | Real save/reopen and negative-owner tests | Playwright journeys against a dev deployment | Test accounts |
| Azure Key Vault | Intentionally deferred (Class B) | Not a blocker for the core MVP | Vault client/rotation code | Azure subscription |
| `braces` (high), `sprintf-js` (moderate) | No patched upstream release (checked 2026-10-26: braces 3.0.3, sprintf-js 1.1.3 are latest) | Keep open; bounded-reachability tests stay in place | Optionally replace Mammoth's `argparse@1` path via a reviewed override to `argparse@2`, which has no sprintf-js dependency | Security acceptance of residual risk |

## 5. Order (unchanged from the audit, with the new tools)

1. R1 (Publish this change, read the header) and the read-only verifier.
2. Approved install (§3 step 5), then R3 runtime probe. Keep the protected
   lane disabled if anything fails.
3. R5/R6/R12 for honest core quality; then R7, then R8 on one source each.
4. R9, then R10, one target each.
5. R11 only when Exemplar rights and withdrawal work on both systems.
6. Class B: Azure Key Vault.

Never weaken a readiness check, policy comparison or trigger body to get a
green result. A failed check stays failed until the catalog is fixed.
