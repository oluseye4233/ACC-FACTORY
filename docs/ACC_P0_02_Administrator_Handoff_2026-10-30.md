# ACC / ARK — P0-02 Administrator Security Handoff

**Prepared:** 30 October 2026  
**Purpose:** administrator review and read-only post-install acceptance.  
**Status:** protected public-schema workflow acceptance is BLOCKED.  
**Scope:** no installer, repair script, password change, production migration or permission change is included or authorized by this document.

## 1. Evidence and limits

The preceding audit used production-replica catalog SELECTs in a read-only transaction. Its identity was `neondb_owner`, with BYPASSRLS. That was the audit identity, not proof of the application's effective request identity.

Observed findings:

| Control | Production observation | Required end state |
|---|---|---|
| Restricted operations role | `atanda_artifact_operations` absent | Present; NOLOGIN; no superuser, BYPASSRLS, CREATEDB, CREATEROLE or replication capabilities |
| Membership | Cannot establish membership in an absent role | Verified actual application pool login can assume the operations role |
| Positive permissions | All nine required tables exist; operations-role privileges cannot be established | Public-schema USAGE and every privilege in section 3 |
| Forced RLS | Enabled but not forced on all five protected public tables | Both enabled and forced on all five |
| Owner policies | Four expected policy names exist without predicates | Exact reviewed owner predicates for USING and WITH CHECK |
| Authority policies | Three expected policy names exist without predicates | Exact reviewed authenticated-read and administrator-write expressions |
| Policy scope | Only seven expected names observed | No additional permissive policies that broaden access |
| Immutability | Required non-internal triggers absent | Both exact reviewed full-row update guards present and enabled |
| Forbidden privileges | Operations role absent; cannot validate | No protected ownership, public-schema CREATE, DELETE/TRUNCATE on the nine tables, or UPDATE on immutable files/events |

Separate observations: `ark_app_login` exists without elevated role flags; the separate `imprima` schema has forced RLS on 10/10 tables and `short_sprints` on 12/12. These do not establish protection for the public-schema workflows.

No subscriber rows were read, no mutation attempts were made, and no application-login password was tested. Replica results may lag the primary.

These observations are historical evidence from this audit, not an automatically refreshed status report.

### Query validation performed for this handoff

All three SQL blocks in section 5 were executed unchanged using the supported read-only production-replica connection on 30 October 2026. They completed without SQL errors; the connection reported `transaction_read_only = on`.

- Query A confirmed the audit identity and role flags described above.
- Query B returned **1 PASS** (`policy_scope`) and **8 FAIL** results. Dependency failures caused by the missing operations role remain failures, not exemptions.
- Query C returned exactly **22 rows**, all marked `FAIL: role missing`. This means the required privileges cannot be established for that role, not that privileges were independently tested on an existing operations role.

These results validate the queries on the current failing installation. A repaired-installation success result and application-connection/request-path acceptance have not been obtained. No controls were changed to obtain these results.

## 2. Administrator action boundary

1. Confirm the intended serving build, actual production database and applicable managed-Publish administration process.
2. Review the existing migration specifications listed below as design evidence. **Do not replay historical table-creation migrations against populated production tables.**
3. Prepare an authorized, independently reviewed remediation through the supported administrator process. This handoff does not supply or execute it.
4. Preserve existing fail-closed behaviour. Do not substitute an owner/BYPASSRLS connection for the missing operations role.
5. Execute the SELECT-only checks below after the administrator's installation.
6. Complete the controlled request-path acceptance in section 7 before marking P0-02 closed.

A no-change Publish diff or a passing verifier for the separate ARK schemas is not evidence that these public-schema controls exist. Do not assume republishing alone installs the missing controls.

### Reviewed source references

- `lib/db/migrations/0048_awesome_marvel_zombies.sql`
- `lib/db/migrations/0050_artifact_operations_integrity.sql`
- `lib/db/migrations/0051_artifact_operations_least_privilege.sql`
- `artifacts/api-server/src/lib/artifact-operations/database-protection-contract.ts`
- `artifacts/api-server/src/lib/artifact-operations/database-protection.ts`
- `artifacts/api-server/src/lib/artifact-operations/context.ts`
- `lib/db/src/index.ts`
- `server/db/withContext.ts`

Reconcile these expectations against the exact release being installed. An unfamiliar allegedly equivalent predicate or trigger requires review, not a looser test.

## 3. Required positive privileges

| Public table | SELECT | INSERT | UPDATE |
|---|:---:|:---:|:---:|
| `imprima_jobs` | Yes | Yes | Yes |
| `imprima_files` | Yes | Yes | No |
| `short_sprint_runs` | Yes | Yes | Yes |
| `artifact_operation_events` | Yes | Yes | No |
| `sprint_verifier_authorities` | Yes | Yes | Yes |
| `harness_artifacts` | Yes | No | No |
| `harness_feature_state` | Yes | Yes | Yes |
| `command_deck_traces` | Yes | Yes | No |
| `vte_verification_failures` | Yes | Yes | Yes |

There are **22 required table/privilege pairs**. “No” means not required; the forbidden-privilege checks separately enforce explicit restrictions. The operations role also requires USAGE on `public`, but must not have CREATE there.

## 4. Two distinct connection/context systems

### Public-schema protected workflows

The shared pool in `lib/db/src/index.ts` uses `DATABASE_URL`. `withOperationsActor()` checks guards, switches transaction-locally to `atanda_artifact_operations`, confirms its restricted flags and sets:

| Setting | Expected value | Scope |
|---|---|---|
| `app.operations_actor` | Internal authenticated user UUID, supplied by the server | Transaction-local |
| `app.operations_admin` | Lowercase text `true` only for server-confirmed ADMIN; otherwise `false` | Transaction-local |

The UUID is the internal application's user identity, not an arbitrary Clerk identifier. Never accept actor/admin values directly from client input.

### Separate ARK schemas

`server/db/withContext.ts` uses `APP_DATABASE_URL` and sets transaction-local `app.org_id` (organization UUID), `app.user_id` (verified Clerk user identity) and `app.user_roles` (comma-separated approved role names).

**Do not assume `ark_app_login` is the public-schema pool login.** Verify the deployed connection paths without disclosing credentials. The prior ARK password-authentication incident and the missing public operations guards are separate findings.

## 5. Read-only catalog acceptance queries

Run against the intended production database with an approved read-only connection. These statements neither install controls nor prove that request handlers use them.

### Query A — identity and relevant role flags

```sql
SELECT current_user, session_user, current_database() AS database_name,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT rolname, rolsuper, rolbypassrls, rolcreatedb,
       rolcreaterole, rolreplication, rolcanlogin
FROM pg_roles
WHERE rolname IN (current_user, session_user,
                  'ark_app_login', 'atanda_artifact_operations')
ORDER BY rolname;
```

Record the identity. A privileged audit connection can inspect catalogs but cannot serve as evidence of tenant isolation.

### Query B — all nine catalog controls

By default `app_login` is the connection's `current_user`. For an actual application-connection check, run it through that approved connection. If an administrator runs it instead, replace only `current_user::text` in the `parameters` CTE with the independently verified application login as a quoted SQL literal. A membership PASS for an administrator is not a membership PASS for the application.

Every control must return PASS. Missing dependencies fail closed. Policy comparisons deliberately match the application's exact catalog expectations.

```sql
WITH
parameters(app_login) AS (VALUES (current_user::text)),
operation_role AS (
  SELECT * FROM pg_roles WHERE rolname = 'atanda_artifact_operations'
),
required_permissions(table_name, privilege) AS (
  VALUES
  ('imprima_jobs','SELECT'), ('imprima_jobs','INSERT'), ('imprima_jobs','UPDATE'),
  ('imprima_files','SELECT'), ('imprima_files','INSERT'),
  ('short_sprint_runs','SELECT'), ('short_sprint_runs','INSERT'), ('short_sprint_runs','UPDATE'),
  ('artifact_operation_events','SELECT'), ('artifact_operation_events','INSERT'),
  ('sprint_verifier_authorities','SELECT'), ('sprint_verifier_authorities','INSERT'), ('sprint_verifier_authorities','UPDATE'),
  ('harness_artifacts','SELECT'),
  ('harness_feature_state','SELECT'), ('harness_feature_state','INSERT'), ('harness_feature_state','UPDATE'),
  ('command_deck_traces','SELECT'), ('command_deck_traces','INSERT'),
  ('vte_verification_failures','SELECT'), ('vte_verification_failures','INSERT'), ('vte_verification_failures','UPDATE')
),
protected_tables(table_name) AS (
  VALUES ('imprima_jobs'), ('imprima_files'), ('short_sprint_runs'),
         ('artifact_operation_events'), ('sprint_verifier_authorities')
),
expressions(owner_expr, admin_expr, authenticated_expr) AS (
  VALUES (
    $owner$((user_id = (NULLIF(current_setting('app.operations_actor'::text, true), ''::text))::uuid) OR (current_setting('app.operations_admin'::text, true) = 'true'::text))$owner$,
    $admin$(current_setting('app.operations_admin'::text, true) = 'true'::text)$admin$,
    $auth$((NULLIF(current_setting('app.operations_actor'::text, true), ''::text))::uuid IS NOT NULL)$auth$
  )
),
expected_policies(table_name, policy_name, command, using_expr, check_expr) AS (
  SELECT t, t || '_owner', '*', e.owner_expr, e.owner_expr
  FROM expressions e CROSS JOIN
    (VALUES ('artifact_operation_events'), ('imprima_files'),
            ('imprima_jobs'), ('short_sprint_runs')) AS tables(t)
  UNION ALL
  SELECT 'sprint_verifier_authorities', 'sprint_verifiers_read', 'r',
         authenticated_expr, NULL::text FROM expressions
  UNION ALL
  SELECT 'sprint_verifier_authorities', 'sprint_verifiers_admin_insert', 'a',
         NULL::text, admin_expr FROM expressions
  UNION ALL
  SELECT 'sprint_verifier_authorities', 'sprint_verifiers_admin_update', 'w',
         admin_expr, admin_expr FROM expressions
),
actual_policies AS (
  SELECT c.relname::text AS table_name, p.polname::text AS policy_name,
         p.polcmd::text AS command, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual,p.polrelid) AS using_expr,
         pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::regnamespace
    AND c.relname::text IN (SELECT table_name FROM protected_tables)
),
policy_matches AS (
  SELECT e.*,
    EXISTS (
      SELECT 1 FROM actual_policies a
      WHERE a.table_name=e.table_name AND a.policy_name=e.policy_name
        AND a.command=e.command AND a.polpermissive
        AND a.polroles=ARRAY[0]::oid[]
        AND a.using_expr IS NOT DISTINCT FROM e.using_expr
        AND a.check_expr IS NOT DISTINCT FROM e.check_expr
    ) AS matched
  FROM expected_policies e
),
checks(check_name, passed) AS (
  SELECT 'restricted_role',
    EXISTS (SELECT 1 FROM operation_role
      WHERE NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin
        AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
  UNION ALL
  SELECT 'role_membership',
    EXISTS (SELECT 1 FROM operation_role o
      JOIN pg_roles a ON a.rolname=(SELECT app_login FROM parameters)
      WHERE pg_has_role(a.oid,o.oid,'MEMBER'))
  UNION ALL
  SELECT 'required_permissions',
    EXISTS (SELECT 1 FROM operation_role o
      WHERE has_schema_privilege(o.oid,'public','USAGE')
        AND NOT EXISTS (
          SELECT 1 FROM required_permissions p
          LEFT JOIN pg_class c ON c.relnamespace='public'::regnamespace
            AND c.relname::text=p.table_name AND c.relkind IN ('r','p')
          WHERE c.oid IS NULL
             OR NOT has_table_privilege(o.oid,c.oid,p.privilege)))
  UNION ALL
  SELECT 'forced_rls',
    (SELECT count(*)=5 FROM pg_class c
      WHERE c.relnamespace='public'::regnamespace
        AND c.relname::text IN (SELECT table_name FROM protected_tables)
        AND c.relrowsecurity AND c.relforcerowsecurity)
  UNION ALL
  SELECT 'owner_policies',
    (SELECT bool_and(matched) FROM policy_matches WHERE command='*')
  UNION ALL
  SELECT 'authority_policies',
    (SELECT bool_and(matched) FROM policy_matches WHERE command<>'*')
  UNION ALL
  SELECT 'policy_scope',
    EXISTS (SELECT 1 FROM actual_policies)
    AND NOT EXISTS (
      SELECT 1 FROM actual_policies a WHERE a.polpermissive
        AND NOT EXISTS (
          SELECT 1 FROM expected_policies e
          WHERE e.table_name=a.table_name AND e.policy_name=a.policy_name))
  UNION ALL
  SELECT 'immutable_versions',
    (SELECT count(*)=2
     FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     JOIN pg_proc f ON f.oid=t.tgfoid
     WHERE c.relnamespace='public'::regnamespace
       AND t.tgenabled IN ('O','A') AND t.tgtype=19
       AND t.tgqual IS NULL AND t.tgattr=''::int2vector
       AND f.pronamespace='public'::regnamespace
       AND f.proname='protect_imprima_immutable_version'
       AND f.pronargs=0 AND f.prorettype='pg_catalog.trigger'::regtype
       AND f.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
       AND NOT f.prosecdef AND f.proconfig IS NULL
       AND f.prosrc=$immutable$
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
$immutable$
       AND ((t.tgname='imprima_file_immutable' AND c.relname='imprima_files')
         OR (t.tgname='imprima_final_immutable' AND c.relname='imprima_jobs')))
  UNION ALL
  SELECT 'restricted_permissions',
    EXISTS (SELECT 1 FROM operation_role o
      WHERE NOT has_schema_privilege(o.oid,'public','CREATE')
        AND NOT EXISTS (
          SELECT 1 FROM pg_class c
          WHERE c.relnamespace='public'::regnamespace
            AND c.relname::text IN (SELECT table_name FROM required_permissions)
            AND (c.relowner=o.oid
              OR has_table_privilege(o.oid,c.oid,'DELETE')
              OR has_table_privilege(o.oid,c.oid,'TRUNCATE')
              OR (c.relname IN ('imprima_files','artifact_operation_events')
                  AND has_table_privilege(o.oid,c.oid,'UPDATE')))))
)
SELECT (SELECT app_login FROM parameters) AS checked_login, check_name,
       CASE WHEN passed IS TRUE THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks ORDER BY check_name;
```

### Query C — every required privilege individually

This prevents a false pass from checking only prohibited operations, or from using a comma-separated privilege argument that can mean “any” rather than “all.”

```sql
WITH required(table_name, privilege) AS (
  VALUES
  ('imprima_jobs','SELECT'), ('imprima_jobs','INSERT'), ('imprima_jobs','UPDATE'),
  ('imprima_files','SELECT'), ('imprima_files','INSERT'),
  ('short_sprint_runs','SELECT'), ('short_sprint_runs','INSERT'), ('short_sprint_runs','UPDATE'),
  ('artifact_operation_events','SELECT'), ('artifact_operation_events','INSERT'),
  ('sprint_verifier_authorities','SELECT'), ('sprint_verifier_authorities','INSERT'), ('sprint_verifier_authorities','UPDATE'),
  ('harness_artifacts','SELECT'),
  ('harness_feature_state','SELECT'), ('harness_feature_state','INSERT'), ('harness_feature_state','UPDATE'),
  ('command_deck_traces','SELECT'), ('command_deck_traces','INSERT'),
  ('vte_verification_failures','SELECT'), ('vte_verification_failures','INSERT'), ('vte_verification_failures','UPDATE')
),
operation_role AS (
  SELECT oid FROM pg_roles WHERE rolname='atanda_artifact_operations'
)
SELECT r.table_name, r.privilege,
  CASE WHEN NOT EXISTS (SELECT 1 FROM operation_role) THEN 'FAIL: role missing'
       WHEN c.oid IS NULL THEN 'FAIL: table missing'
       WHEN has_table_privilege((SELECT oid FROM operation_role),c.oid,r.privilege)
         THEN 'PASS'
       ELSE 'FAIL: privilege missing' END AS result
FROM required r LEFT JOIN pg_class c
  ON c.relnamespace='public'::regnamespace
 AND c.relname::text=r.table_name AND c.relkind IN ('r','p')
ORDER BY r.table_name,r.privilege;
```

Expect exactly 22 PASS rows, plus public-schema USAGE and all other controls in Query B. Do not interpret a missing role as “no dangerous privileges, therefore safe.”

## 6. Interpretation and stop conditions

- Any FAIL or query error blocks protected-workflow acceptance. Do not weaken predicates or assertions to make the result green.
- Query B checks catalog membership; actual successful transaction-local role switching must still be demonstrated.
- Owner/BYPASSRLS connections cannot prove tenant isolation even when FORCE RLS is set.
- Nine PASS rows do not prove complete request-handler coverage, correct subscriber identity, email delivery, independent evaluation, certification, deployment or copyright ownership.
- Do not release credentials, connection strings, subscriber records or publication codes in the evidence pack.

## 7. Controlled request-path acceptance — separate authorization required

This section is a test plan, **not SELECT-only SQL and not executed by this handoff**. Some tests create or attempt to change designated test records. Obtain separate approval for an isolated acceptance environment, or specifically authorized synthetic production records.

| Test | Required result |
|---|---|
| Actual public-workflow pool connection | Uses the independently verified connection identity; can assume the restricted operations role |
| Effective role inside handler transaction | `current_user` is exactly `atanda_artifact_operations`, with all prohibited role flags false |
| Actor/admin context | Server-verified internal user UUID and lowercase admin boolean, transaction-local |
| Own-record access | Permitted owner operation succeeds |
| Cross-owner access | A cannot read, modify or reference B's protected records; no leaked data |
| Authority access | Authenticated reads and ADMIN-only authority writes conform to reviewed policies |
| Final publication immutability | Modifying any field of a published FINAL job is rejected |
| File immutability | Modifying any field of an existing publication file is rejected |
| Context isolation | A's actor/admin context does not persist into later transactions, including pooled/reused connections |
| Missing context or unavailable guards | Protected operation fails closed; no owner-connection fallback |
| Auditability | Authorized successful operations retain the expected immutable events and correct subscriber attribution |

Do not test immutability against a real subscriber's publication. Rollback-only tests can still invoke application side effects; use the approved test setup.

## 8. Required sign-off record

| Field | Administrator records |
|---|---|
| Serving build/source revision | |
| Production database verified without credentials | |
| Approved remediation reference and reviewer | |
| Execution date/time and administrator | |
| Query A identity and restricted-role flags | |
| Query B: nine PASS controls | |
| Query C: 22 PASS privileges | |
| Primary/replica timing reconciled | |
| Request-path acceptance environment and results | |
| Remaining exceptions and operations kept closed | |
| Security reviewer and release decision | |

**P0-02 closure requires both catalog acceptance and approved request-path acceptance. This document does not grant installation or release approval.**
