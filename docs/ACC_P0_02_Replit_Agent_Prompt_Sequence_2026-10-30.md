# ACC / ARK — P0-02 Replit Agent Prompt Sequence

**Source:** `docs/ACC_P0_02_Response_Package_2026-10-30.md` (findings F1–F7 and owner decisions D1–D5)
**Prepared:** 30 October 2026
**How to use:** paste one prompt at a time into the Replit agent, in order. Wait for its report and check it against the **Acceptance** list before moving on. Do not start a later prompt until the earlier one is accepted.

Prompts 0–6 are **development-only** code and documentation work. Prompts 7–9 need owner decisions (D1–D3) and are **support and verification only**. The owner or administrator executes the production SQL; the agent never does.

| # | Prompt | Finding | Gate before starting |
|---|---|---|---|
| 0 | Standing guardrails | All | None |
| 1 | SET-option membership check | F1 | 0 acknowledged |
| 2 | Update handoff Query B | F1 | 1 accepted |
| 3 | Pool-login identification | F2 | 1 accepted, D5 = Yes |
| 4 | App readiness capture | F4 | 3 accepted |
| 5 | Request-path acceptance harness (dev) | Section 7 | 4 accepted |
| 6 | Scope tracking and sign-off rows | F7, Appendix B | 5 accepted |
| 7 | Pre-execution evidence pack | F2, F3, F5, F6 | D1, D2, D3 recorded |
| 8 | Post-install verification support | Steps 5–6 | Owner reports Appendix A committed |
| 9 | Request-path acceptance run and close-out | Steps 7–8 | 8 accepted |

---

## Prompt 0 — Standing guardrails (send first)

```text
Context: I have reviewed your P0-02 Administrator Handoff (docs/ACC_P0_02_Administrator_Handoff_2026-10-30.md). My response is in docs/ACC_P0_02_Response_Package_2026-10-30.md. Read both fully before doing anything.

For every P0-02 task I send from now on, these rules apply unless I explicitly replace them in writing:

1. No production changes. Do not run DDL, GRANT, REVOKE, CREATE/ALTER ROLE, policy, trigger or data changes against production, and do not run Appendix A of the response package anywhere. I or my administrator run production SQL.
2. No workarounds. Do not add deploy-time migrations, startup self-healing, repair endpoints, or any fallback to neondb_owner or another BYPASSRLS connection.
3. No weakening. Do not loosen any exact-match predicate, trigger body, privilege list or readiness assertion to get a PASS. If something cannot pass honestly, stop and report it.
4. No sensitive output. Never print, log, commit or return connection strings, passwords, tokens, subscriber rows or publication codes. Role names are fine.
5. Development only. Code and tests run against the development database. Leave publishing to me.
6. Report format for each task: (a) files changed with a short diff summary, (b) exact test commands and their output, (c) anything you could not do and why, (d) open questions.

Reply only with a confirmation that you have read both documents, a one-paragraph summary of P0-02's current status, and any conflict you see between these rules and the response package. Do not change any files yet.
```

**Acceptance:** confirms both documents; status summary says BLOCKED with role absent, policies without predicates, no FORCE RLS and no triggers; no files changed.

---

## Prompt 1 — F1: PG16+ SET-option membership check

```text
Task P0-02 / F1. Development only. Guardrails from Prompt 0 apply.

Problem: in artifacts/api-server/src/lib/artifact-operations/database-protection.ts, the role_membership check uses pg_has_role(current_user, r.oid, 'MEMBER'). On PostgreSQL 16+, a membership granted WITH SET FALSE still counts as MEMBER, but SET LOCAL ROLE atanda_artifact_operations would then fail. Runtime stays fail-closed, because withOperationsActor throws DATABASE_ROLE_UNAVAILABLE, but the readiness check can report a false PASS.

Change:
1. Make role_membership require BOTH pg_has_role(current_user, r.oid, 'MEMBER') AND, when current_setting('server_version_num')::int >= 160000, pg_has_role(current_user, r.oid, 'SET'). Below 16 the MEMBER check alone stays as it is. Write it so PostgreSQL does not evaluate the 'SET' privilege string on versions below 16 (for example with a CASE expression), because older servers reject it.
2. Do not change any other check, expression, privilege list or the trigger body.
3. Tests in database-protection.test.ts and database-protection-readonly.test.ts:
   - assert the generated SQL contains the MEMBER check, the SET check and the server_version_num guard;
   - keep all existing tests passing unchanged.
   If a live development database is available, run the readiness query there and report role_membership and the server_version_num value.
4. Run: pnpm --filter ./artifacts/api-server run test -- src/lib/artifact-operations
   Then run the repo typecheck if one exists.

Report per Prompt 0 format. Commit with message "P0-02 F1: require SET option for operations-role membership on PG16+".
```

**Acceptance:** only `role_membership` changed; tests pass; existing assertions untouched; the development run (if available) still reports 9/9 ready.

---

## Prompt 2 — F1: update handoff Query B to match

```text
Task P0-02 / F1 docs. Development only. Guardrails from Prompt 0 apply.

Update docs/ACC_P0_02_Administrator_Handoff_2026-10-30.md so that Query B's role_membership check matches the code change from Prompt 1:

  WHERE pg_has_role(a.oid,o.oid,'MEMBER')
    AND (current_setting('server_version_num')::int < 160000
         OR pg_has_role(a.oid,o.oid,'SET'))

Use the same version-guarded form as the code (CASE or equivalent) so the 'SET' argument is never evaluated below 16. Change nothing else in Query B or Query C.

Also:
- Add a dated "Revision 2026-10-30b" note under the status block: "Query B role_membership now also requires the SET option on PostgreSQL 16+ (F1)."
- Re-run Query A, the updated Query B and Query C, unchanged except for this edit, on the same supported read-only production-replica connection you used before, ONLY if that connection is read-only (transaction_read_only = on). Expected result: still 1 PASS / 8 FAIL and 22 × "FAIL: role missing". Report the transaction_read_only value and the results. If you cannot confirm read-only, do not run it; say so.
- Regenerate the PDF the same way you produced the original, if you have that tooling, and keep the Markdown as the authoritative copy.

Report per Prompt 0 format. Commit: "P0-02 F1: align handoff Query B membership check".
```

**Acceptance:** single targeted SQL change; `transaction_read_only = on` reported; results unchanged (1/8, 22 FAIL).

---

## Prompt 3 — F2: identify the public-schema pool login (role name only)

```text
Task P0-02 / F2. Guardrails from Prompt 0 apply. D5 is approved for code and docs only.

Goal: establish which PostgreSQL role the DATABASE_URL pool (lib/db/src/index.ts) connects as in production, without exposing any credential. Appendix A must GRANT atanda_artifact_operations to that exact login, not to whoever runs the admin console.

Do:
1. Add an ADMIN-only, read-only endpoint, GET /api/admin/db-identity, in artifacts/api-server/src/routes/admin-ops.ts, using the existing requireAuth + requireAdmin middleware. It runs, on the shared `db` pool:
     SELECT session_user, current_user, current_database(),
            r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcanlogin,
            current_setting('server_version_num') AS server_version_num,
            pg_is_in_recovery() AS is_replica
     FROM pg_roles r WHERE r.rolname = session_user;
   Return only those fields. No host, port, URL, password or environment variable values.
   Also return the same fields for the ARK pool (server/db/withContext.ts appDb) under a separate "ark" key, if that pool is configured. If it is not configured, return "not_configured", not an error.
2. Add tests: non-admin gets 403; the response contains only the allow-listed keys; nothing resembling a URL or secret appears in it.
3. Do not call this endpoint against production yourself. Write the steps I will follow after the next publish: sign in as ADMIN → open /api/admin/db-identity → record session_user and is_replica.
4. Add to the handoff (section 4) a sentence that the pool login must be taken from this endpoint on the serving build, and that is_replica must be false for the primary.

Report per Prompt 0 format, including the result of calling the endpoint in DEVELOPMENT (role names are fine to show). Commit: "P0-02 F2: admin-only database identity endpoint (no credentials)".
```

**Acceptance:** endpoint is admin-gated with an allow-listed response and tests; dev output shows role names only; no production call made.

---

## Prompt 4 — F4: application-connection readiness capture

```text
Task P0-02 / F4. Development only. Guardrails from Prompt 0 apply.

The deployed app already computes databaseProtection() on its own pool (preparations.ts returns it to the verifier UI; routes/artifact-operations.ts:83 gates the full lane on it). That output is the application-connection evidence for role_membership. Make it capturable as acceptance evidence.

Do:
1. Add an ADMIN-only GET /api/admin/database-protection that returns { checked_at, session_user, server_version_num, is_replica, ready, checks: [{ id, ready }] }, where the result comes from databaseProtection() on the shared db pool. Reuse the function; do not duplicate the SQL. No policy expressions, no credentials, no row data.
2. Tests: admin-only; the payload lists exactly the 9 check ids in their existing order; ready is false when any check is false.
3. In the handoff, add section 5a, "Application-connection readiness capture": after installation, an ADMIN opens this endpoint on the serving production build and records the JSON (timestamp, session_user, 9/9). State explicitly that this is separate from, and does not replace, the administrator-run Query B.
4. Add a section 8 sign-off row: "Deployed app readiness payload: 9/9 ready (ADMIN, timestamp, session_user)".

Report per Prompt 0 format, including the dev JSON output. Commit: "P0-02 F4: admin readiness capture for application-connection evidence".
```

**Acceptance:** reuses `databaseProtection()`; dev JSON shows 9 checks; handoff 5a and the sign-off row are added.

---

## Prompt 5 — Request-path acceptance harness (handoff section 7), development only

```text
Task P0-02 / section 7 harness. DEVELOPMENT DATABASE ONLY. Guardrails from Prompt 0 apply.

Build an automated acceptance suite that exercises the real request path (withOperationsActor and the real route handlers), not mocks of the database. Put it in artifacts/api-server/src/lib/artifact-operations/request-path-acceptance.test.ts (or a separate script if the test runner cannot reach a database). It must refuse to run unless an explicit opt-in variable is set (for example P0_02_ACCEPTANCE=dev). It must also refuse to run if databaseProtection() is not ready, or if the database name or host matches production; check this by comparing role and database names, never by printing URLs.

Use synthetic users only: A (normal), B (normal) and C (ADMIN), created with clearly marked test IDs and removed by the existing test-fixture janitor afterwards.

Cover every row of handoff section 7:
 1. Pool connection can assume atanda_artifact_operations.
 2. Inside a handler transaction, current_user = 'atanda_artifact_operations' and all prohibited role flags are false.
 3. app.operations_actor = server-supplied internal UUID; app.operations_admin = 'true' only for C, 'false' for A and B; both are transaction-local.
 4. A can create, read and update A's own imprima_jobs and short_sprint_runs.
 5. A cannot read, update or reference B's rows. Assert zero rows and no leaked fields, including through joins and RETURNING.
 6. Authorities: A and B can read; only C can insert or update; A's insert or update is rejected.
 7. Updating ANY column of a PUBLISHED + FINAL imprima_job is rejected with the immutability error.
 8. Updating ANY column of an imprima_files row is rejected.
 9. Context isolation: run A, then B, on the same pooled client (force pool max=1 for this test) and prove that A's settings and role do not persist.
10. Fail-closed: with guards reported as missing (stub databaseProtection to return not ready) → 503 DATABASE_GUARDS_MISSING; with SET ROLE failing → 503 DATABASE_ROLE_UNAVAILABLE. No query reaches the tables on the owner role.
11. Auditability: successful operations write artifact_operation_events with the correct user_id/actor_id; those events cannot be UPDATEd or DELETEd by the operations role.
12. DELETE and TRUNCATE on all nine tables are rejected for the operations role.

Output a table: test # | description | PASS/FAIL | evidence (error code or row count only). Do not weaken any assertion to make it pass. If a test fails, report it as a finding.

Report per Prompt 0 format. Commit: "P0-02: section 7 request-path acceptance harness (dev-gated)".
```

**Acceptance:** all 12 rows present; the suite is opt-in and refuses to run against production; dev results are reported honestly; any FAIL is raised as a finding, not patched around.

---

## Prompt 6 — F7 tracking and sign-off additions

```text
Task P0-02 / F7 + Appendix B. Docs only. Guardrails from Prompt 0 apply.

1. Create docs/P1_Portal_Tables_Isolation_Review.md as a backlog item, not a fix. Scope: portal_publications and portal_challenges (artifacts/api-server/src/lib/imprima-portal.ts) currently run on the shared owner pool, with ownership enforced by application WHERE user_id clauses and not by RLS. List every query site with file:line, say whether each is owner-filtered, and flag any that are not. Propose options without implementing them. Mark it as separate from P0-02.
2. Add the Appendix B rows from the response package to section 8 of the handoff:
   - Verified pool login (role name only) and how verified
   - Appendix A reviewer and approval timestamp
   - Deployed app readiness payload: 9/9 ready (F4)
   - F1 code change merged (SET-option membership check)
   - F7 portal-table isolation item opened (separate from P0-02)
3. Do not modify the status line: P0-02 stays BLOCKED.

Report per Prompt 0 format. Commit: "P0-02: sign-off additions and P1 portal isolation backlog item".
```

**Acceptance:** P1 document lists query sites without changing code; the sign-off table is extended; status still BLOCKED.

---

## Prompt 7 — Pre-execution evidence pack (send only after D1, D2 and D3 are recorded)

```text
Task P0-02 / pre-execution. Guardrails from Prompt 0 apply. You still must NOT run Appendix A or any production change.

Owner decisions recorded:
- D1 remediation channel: <fill in>
- D2 independent reviewer: <fill in>
- D3 acceptance environment: <fill in>
- Verified pool login from /api/admin/db-identity on the serving build: <role name>; is_replica = false

Prepare docs/ACC_P0_02_Execution_Pack_<date>.md containing:
1. Serving build and source revision (commit SHA) that is currently published.
2. Appendix A, copied byte-for-byte from the response package, with :app_login replaced by the quoted role name above. Do not reformat the function body. Add a diff against the response package to show that :app_login is the only change.
3. A static comparison of Appendix A against migrations 0048/0050/0051 and database-protection-contract.ts. Confirm: the 22 grants exactly; no DELETE/TRUNCATE; no UPDATE on imprima_files or artifact_operation_events; the 7 policies match EXPECTED_OPERATION_POLICIES; the trigger body equals IMMUTABLE_VERSION_FUNCTION_BODY. If you can, apply Appendix A to a throwaway DEVELOPMENT database or branch, then run Query B and C there and include the results.
4. The run order: Query A → Appendix A (one transaction, primary) → Query B (app_login = <role>) → Query C → /api/admin/database-protection on the serving build.
5. A blank sign-off record (handoff section 8 + Appendix B) for the administrator.

Report per Prompt 0 format. Commit the execution pack.
```

**Acceptance:** `:app_login` is the only difference from the response package; the static comparison is clean; the dev trial (if run) gives 9 PASS / 22 PASS.

---

## Prompt 8 — Post-install verification support (send after the owner runs Appendix A)

```text
Task P0-02 / post-install verification. Guardrails from Prompt 0 apply. Read-only only.

The administrator committed Appendix A on the production primary at <timestamp>, run by <name>, and reviewed by <reviewer>.

Do:
1. On the supported read-only connection (confirm transaction_read_only = on, and say whether it is the primary or a replica), run Query A, Query B (app_login = <verified pool login>) and Query C from the handoff, UNCHANGED. Report every row.
   Expected: Query B 9 × PASS; Query C 22 × PASS.
2. If you used a replica, confirm it has caught up before trusting the results: compare pg_last_xact_replay_timestamp() to the commit timestamp. If it has not caught up, wait and re-run; do not report a pass early.
3. Ask me to open /api/admin/database-protection on the serving production build as ADMIN and paste the JSON. Then confirm that session_user equals the verified pool login and that it shows 9/9 ready.
4. If ANY check FAILS: stop. Do not suggest predicate edits or alternative SQL that loosens anything. Report which check failed, and the catalog evidence for it (role flags, policy names and expressions, trigger presence), for the reviewer to decide.

Report per Prompt 0 format. Fill in the Query A/B/C and readiness rows of the sign-off record. Leave release fields blank.
```

**Acceptance:** 9/9 and 22/22 PASS; app payload 9/9 with the matching `session_user`; replica catch-up confirmed.

---

## Prompt 9 — Request-path acceptance run and close-out

```text
Task P0-02 / section 7 acceptance and close-out. Guardrails from Prompt 0 apply.

Approved acceptance environment (D3): <isolated Neon branch of production | designated synthetic production records for test subscriber <id>>.

Do:
1. Run the Prompt 5 harness against ONLY that approved environment, with the opt-in variable set to that environment's name. If D3 is synthetic production records, use only the designated synthetic subscriber IDs. Never touch a real subscriber's publication.
2. Report the 12-row result table with evidence (error codes and row counts only).
3. Confirm the fixture janitor removed every synthetic row, or list what remains for the administrator.
4. Fill in "Request-path acceptance environment and results" in the sign-off record.
5. Summarise: if all of catalog acceptance (Prompt 8) and request-path acceptance (this prompt) passed, write "Ready for security reviewer release decision". Otherwise write "P0-02 remains BLOCKED", with the failing items. Do NOT mark P0-02 closed and do NOT publish. The release decision is the security reviewer's and mine.

Report per Prompt 0 format.
```

**Acceptance:** 12/12 PASS in the approved environment; synthetic data cleaned up; status reported as ready for the reviewer's decision, not self-closed.

---

*These prompts do not grant installation or release approval. P0-02 closes only when the handoff's section 8 record and Appendix B are complete and the security reviewer has made the release decision.*
