# ACC / ARK — P0-02 Response Package to the Replit Agent

**In response to:** `ACC_P0_02_Administrator_Handoff_2026-10-30` (PDF and `docs/ACC_P0_02_Administrator_Handoff_2026-10-30.md`)
**Prepared:** 30 October 2026
**From:** Owner (ATANDA), with an independent review prepared against the repository at commit `6062451`
**Status after this response:** P0-02 remains **BLOCKED**. This package does **not** authorize production installation, release, credential changes or agent-side production DDL.

---

## 1. Acknowledgement

The handoff is received and accepted as the basis for P0-02. Specifically, the owner accepts:

- The finding set in section 1 (role absent, FORCE RLS missing, seven policy names present without predicates, immutability triggers absent, forbidden-privilege checks not evaluable).
- The query validation result: Query B = 1 PASS (`policy_scope`) / 8 FAIL; Query C = 22 × `FAIL: role missing`.
- The action boundary in section 2, especially: **no owner/BYPASSRLS fallback**, **no replay of table-creating migrations**, and **republishing is not a repair**.
- The closure rule in section 8: P0-02 closes only with catalog acceptance **and** approved request-path acceptance.

Good work on keeping the fail-closed behaviour intact and on not touching production to produce the evidence.

---

## 2. Independent review — handoff verified against source

Every claim in the handoff that can be checked against the repository was checked.

| Item | Source checked | Result |
|---|---|---|
| 22 required table/privilege pairs | `database-protection-contract.ts` `REQUIRED_OPERATION_PRIVILEGES`; net effect of `0048` grants minus `0051` revokes | **Matches** |
| Owner / authority policy expressions in Query B | `EXPECTED_OPERATION_POLICIES` in the contract; `CREATE POLICY` lines 103–109 of `0048` | **Matches** |
| Trigger function body (`prosrc`) | `IMMUTABLE_VERSION_FUNCTION_BODY` vs `0050` and the handoff Markdown | **Byte-identical** (leading newline, 2-space indent, trailing newline) |
| `tgtype = 19` | BEFORE (2) + ROW (1) + UPDATE (16) | **Correct** |
| Forbidden-privilege set | `0051` revokes (DELETE/TRUNCATE on 5 tables; UPDATE on files/events) + contract | **Matches** |
| Runtime fail-closed path | `context.ts` `withOperationsActor`: readiness check → `SET LOCAL ROLE` → verifies `current_user` and flags → transaction-local `set_config` | **Confirmed**; no owner fallback exists |
| Two connection systems | `lib/db/src/index.ts` (`DATABASE_URL`) vs `server/db/withContext.ts` (`APP_DATABASE_URL`, `ark_app_login`) | **Confirmed** separate |

**Conclusion:** the handoff is accurate and the queries test what they say they test. Section 3 lists the corrections and additions.

---

## 3. Review findings — corrections and additions

### F1. Membership check can pass when `SET ROLE` would fail on PostgreSQL 16+ (low; fail-closed at runtime)
`pg_has_role(..., 'MEMBER')` is true for any membership grant. On PG16+ a grant made `WITH SET FALSE` still counts as membership, but `SET LOCAL ROLE` then fails. Runtime stays safe, because `withOperationsActor` throws `DATABASE_ROLE_UNAVAILABLE`, but Query B and the in-app readiness check could report a **false PASS** on `role_membership`.

**Requested change (additive, no weakening):**
- In Query B and `database-protection.ts`, require `pg_has_role(<login>, <role>, 'MEMBER') AND pg_has_role(<login>, <role>, 'SET')` when `current_setting('server_version_num')::int >= 160000`.
- Add a unit test for the new condition. Do not loosen anything else.

### F2. Migration `0048` grants membership to `CURRENT_USER`, which may not be the production pool login (process risk)
`GRANT atanda_artifact_operations TO CURRENT_USER` grants to whoever runs the statement. In production, membership must go to the **actual `DATABASE_URL` login** that serves the public-schema pool. That might be `neondb_owner`, or it might not. An administrator running a console session as a different role would grant to the wrong identity, and Query B run as the administrator would still PASS.

**Required:** the remediation must name the verified pool login explicitly (see Appendix A, `:app_login`). `role_membership` must be accepted **only** from the deployed application's own readiness output (F4) or from Query B run through that login.

### F3. Net end state only; do not replay `0048` then `0051`
Replaying `0048` would briefly grant DELETE and would re-run table and policy DDL against populated tables. The remediation must install the **net** state directly: the 22 grants, no DELETE/TRUNCATE, and no UPDATE on `imprima_files` or `artifact_operation_events`. Appendix A does this.

### F4. Use the deployed app's own readiness output as application-connection evidence (addition)
`databaseProtection()` is already returned to the verifier UI through `preparations.ts` and gates the full lane in `routes/artifact-operations.ts:83`. It runs on the **application's own pool**, so its `role_membership` result is the application-connection membership evidence that section 5 asks for. It does this without anyone handling credentials.

**Requested:** document how an ADMIN captures that readiness payload (screenshot or JSON) from the production build after installation, and add it to the sign-off record as a separate line from the administrator-run Query B.

### F5. Existing predicate-less policies need replacing, not adding (clarification)
Production already has the seven policy **names**. `CREATE POLICY` alone would fail on the name collision, and an added policy under a new name would fail `policy_scope`. The remediation must `DROP POLICY IF EXISTS` and recreate the policies with exact predicates in the same transaction. Appendix A does this.

### F6. Primary versus replica
All evidence so far came from a replica. Remediation runs on the **primary**. Acceptance queries should run on the primary, or on the replica only after confirming replay has caught up. Record which one was used in the sign-off line "Primary/replica timing reconciled".

### F7. Scope boundary, noted and not added to P0-02
`imprima-portal.ts` uses `portal_publications` and `portal_challenges` on the shared owner pool, with ownership enforced by application `WHERE user_id = …` clauses rather than RLS. These tables are **not** among the nine P0-02 tables. Open a separate backlog item (proposed **P1-xx: portal tables isolation review**) rather than widening P0-02.

---

## 4. Owner decisions

| # | Decision | Owner answer |
|---|---|---|
| D1 | Remediation channel: Neon console SQL editor on the **production primary**, run by the owner as administrator, using the reviewed Appendix A | ☐ Approved ☐ Other: ________ |
| D2 | Independent reviewer of Appendix A before execution | ________________ |
| D3 | Request-path acceptance environment (section 7): ☐ isolated Neon branch of production ☐ synthetic production records under a designated test subscriber | ☐ ________ |
| D4 | Maintenance window (protected workflows are already unavailable, so there is no additional user impact) | ________________ |
| D5 | Proceed with agent-side changes F1 and F4 (code and docs only, development only) | ☐ Yes ☐ No |

Until D1–D3 are recorded, the agent must not treat any part of this package as installation approval.

---

## 5. Instructions to the Replit agent

### Do
1. **F1:** add the PG16+ `SET`-option check to `database-protection.ts` and to Query B in the handoff Markdown, with a unit test. Development only.
2. **F4:** add a short "Application-connection readiness capture" subsection to the handoff, and add a sign-off row: *"Deployed app readiness payload: 9/9 ready (captured by ADMIN, timestamp)"*.
3. **Identify the pool login without disclosing credentials.** From the production deployment's own runtime, report only `session_user` for the `DATABASE_URL` pool, for example through an ADMIN-only diagnostic that returns the role name and nothing else. If no such path exists, say so and the owner will read it from the Neon console. Do not print or log connection strings.
4. **Prepare the request-path acceptance harness (section 7) against development only:** a scripted test with two synthetic users A and B, plus one ADMIN, covering every row of the section 7 table, including pooled-connection context-leak and missing-guard fail-closed cases. Do not run it against production.
5. Add a sign-off row for F7 so it is tracked separately from P0-02.

### Do not
- Execute Appendix A or any DDL, GRANT, REVOKE or role change against production.
- Add deploy-time migrations, startup self-healing or a "repair" endpoint.
- Loosen any exact-match predicate, trigger body or privilege assertion to get a PASS.
- Substitute `neondb_owner` or any BYPASSRLS connection for the operations role.
- Read subscriber rows, publication codes or credentials for evidence.

### Report back with
- The diff for F1 and F4, with test output.
- The verified pool login name (role name only).
- The development run of the acceptance harness, as per-test PASS/FAIL.

---

## 6. Execution and acceptance sequence (owner-run, after D1–D3)

1. Confirm the serving build and source revision, and the production database (primary) by name only.
2. Run **Query A** and record the identity.
3. Have the D2 reviewer sign off on Appendix A with `:app_login` filled in.
4. Run **Appendix A** on the primary as one transaction. Its built-in post-checks must raise no exception; any exception rolls back everything.
5. Run **Query B** (with `app_login` = the verified pool login) and expect 9 PASS. Run **Query C** and expect 22 PASS.
6. Capture the **deployed app readiness payload** (F4) and expect 9/9 ready.
7. Run the **section 7 request-path acceptance** in the D3 environment.
8. Complete the section 8 sign-off record. Only then may the release decision be made.

---

## Appendix A — DRAFT remediation SQL, for independent review only

> **DRAFT — NOT APPROVED — NOT EXECUTED.** Derived from migrations `0048`, `0050` and `0051` as the **net end state**. It contains no credentials. Replace `:app_login` with the verified public-schema pool login (a role name, as a quoted identifier). Run only on the production **primary**, as the owner of the nine tables, after D1–D3. Copy from this Markdown file and **do not reformat the function body**: its text must match `prosrc` byte for byte.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. Restricted operations role (NOLOGIN, no elevated capabilities)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations') THEN
    CREATE ROLE atanda_artifact_operations NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations'
    AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'Operations role must be NOLOGIN with no elevated capabilities';
  END IF;
END $$;

-- 2. Membership for the VERIFIED pool login (not CURRENT_USER)
GRANT atanda_artifact_operations TO :app_login;   -- PG16+: SET option defaults to TRUE

-- 3. Net privileges (22 pairs + schema USAGE), nothing more
GRANT USAGE ON SCHEMA public TO atanda_artifact_operations;
REVOKE CREATE ON SCHEMA public FROM atanda_artifact_operations;
REVOKE ALL ON imprima_jobs, imprima_files, short_sprint_runs, artifact_operation_events,
  sprint_verifier_authorities, harness_artifacts, harness_feature_state,
  command_deck_traces, vte_verification_failures FROM atanda_artifact_operations;
GRANT SELECT, INSERT, UPDATE ON imprima_jobs, short_sprint_runs, sprint_verifier_authorities,
  harness_feature_state, vte_verification_failures TO atanda_artifact_operations;
GRANT SELECT, INSERT ON imprima_files, artifact_operation_events, command_deck_traces TO atanda_artifact_operations;
GRANT SELECT ON harness_artifacts TO atanda_artifact_operations;

-- 4. Replace predicate-less policies with the exact reviewed definitions
DROP POLICY IF EXISTS "artifact_operation_events_owner" ON "artifact_operation_events";
DROP POLICY IF EXISTS "imprima_files_owner" ON "imprima_files";
DROP POLICY IF EXISTS "imprima_jobs_owner" ON "imprima_jobs";
DROP POLICY IF EXISTS "short_sprint_runs_owner" ON "short_sprint_runs";
DROP POLICY IF EXISTS "sprint_verifiers_read" ON "sprint_verifier_authorities";
DROP POLICY IF EXISTS "sprint_verifiers_admin_insert" ON "sprint_verifier_authorities";
DROP POLICY IF EXISTS "sprint_verifiers_admin_update" ON "sprint_verifier_authorities";
CREATE POLICY "artifact_operation_events_owner" ON "artifact_operation_events" AS PERMISSIVE FOR ALL TO public USING ("artifact_operation_events"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("artifact_operation_events"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');
CREATE POLICY "imprima_files_owner" ON "imprima_files" AS PERMISSIVE FOR ALL TO public USING ("imprima_files"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("imprima_files"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');
CREATE POLICY "imprima_jobs_owner" ON "imprima_jobs" AS PERMISSIVE FOR ALL TO public USING ("imprima_jobs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("imprima_jobs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');
CREATE POLICY "short_sprint_runs_owner" ON "short_sprint_runs" AS PERMISSIVE FOR ALL TO public USING ("short_sprint_runs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("short_sprint_runs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');
CREATE POLICY "sprint_verifiers_read" ON "sprint_verifier_authorities" AS PERMISSIVE FOR SELECT TO public USING (nullif(current_setting('app.operations_actor', true), '')::uuid IS NOT NULL);
CREATE POLICY "sprint_verifiers_admin_insert" ON "sprint_verifier_authorities" AS PERMISSIVE FOR INSERT TO public WITH CHECK (current_setting('app.operations_admin', true) = 'true');
CREATE POLICY "sprint_verifiers_admin_update" ON "sprint_verifier_authorities" AS PERMISSIVE FOR UPDATE TO public USING (current_setting('app.operations_admin', true) = 'true') WITH CHECK (current_setting('app.operations_admin', true) = 'true');

-- 5. Enable + FORCE RLS on the five protected tables
ALTER TABLE imprima_jobs ENABLE ROW LEVEL SECURITY;               ALTER TABLE imprima_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE imprima_files ENABLE ROW LEVEL SECURITY;              ALTER TABLE imprima_files FORCE ROW LEVEL SECURITY;
ALTER TABLE short_sprint_runs ENABLE ROW LEVEL SECURITY;          ALTER TABLE short_sprint_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE artifact_operation_events ENABLE ROW LEVEL SECURITY;  ALTER TABLE artifact_operation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE sprint_verifier_authorities ENABLE ROW LEVEL SECURITY; ALTER TABLE sprint_verifier_authorities FORCE ROW LEVEL SECURITY;

-- 6. Immutability guard (body must stay byte-identical to the contract)
CREATE OR REPLACE FUNCTION protect_imprima_immutable_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'imprima_files' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Publication file metadata is immutable; create a new version';
    END IF;
  ELSIF OLD.state = 'PUBLISHED' AND OLD.config->>'mode' = 'FINAL' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Published Final documents are immutable; create a new version';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS imprima_file_immutable ON imprima_files;
CREATE TRIGGER imprima_file_immutable BEFORE UPDATE ON imprima_files
FOR EACH ROW EXECUTE FUNCTION protect_imprima_immutable_version();
DROP TRIGGER IF EXISTS imprima_final_immutable ON imprima_jobs;
CREATE TRIGGER imprima_final_immutable BEFORE UPDATE ON imprima_jobs
FOR EACH ROW EXECUTE FUNCTION protect_imprima_immutable_version();

-- 7. In-transaction guard: abort everything if any unexpected permissive policy remains
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relnamespace = 'public'::regnamespace AND p.polpermissive
      AND c.relname IN ('imprima_jobs','imprima_files','short_sprint_runs','artifact_operation_events','sprint_verifier_authorities')
      AND p.polname NOT IN ('artifact_operation_events_owner','imprima_files_owner','imprima_jobs_owner',
        'short_sprint_runs_owner','sprint_verifiers_read','sprint_verifiers_admin_insert','sprint_verifiers_admin_update')
  ) THEN
    RAISE EXCEPTION 'Unexpected permissive policy present; review before installation';
  END IF;
END $$;

COMMIT;
-- Then run Query A, Query B (app_login = verified pool login) and Query C from the handoff, unchanged.
```

**Reviewer checklist for Appendix A**
- [ ] `:app_login` is the independently verified `DATABASE_URL` pool login, not the console session user.
- [ ] Running as the owner of all nine tables (this is required for `FORCE ROW LEVEL SECURITY`).
- [ ] Target is the production **primary**.
- [ ] No table-creating DDL and no data changes are present.
- [ ] The function body was not reformatted (the Query B `immutable_versions` check will FAIL if it was).
- [ ] The rollback plan is understood: this runs as one transaction, so any error leaves production unchanged.

---

## Appendix B — Sign-off record additions

| Field | Administrator records |
|---|---|
| Verified pool login (role name only) and how verified | ________________ |
| Appendix A reviewer and approval timestamp | ________________ |
| Deployed app readiness payload: 9/9 ready (F4) | ________________ |
| F1 code change merged (SET-option membership check) | ________________ |
| F7 portal-table isolation item opened (separate from P0-02) | ________________ |

*This response does not grant installation or release approval. P0-02 closes only when the section 8 record of the handoff and Appendix B above are complete.*
