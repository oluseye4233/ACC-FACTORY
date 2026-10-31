-- =============================================================================
-- db/production-guard/verify_artifact_operations_guard.sql
--
-- READ-ONLY PASS/FAIL matrix for the nine protected-workflow readiness checks
-- (production audit 2026-10-26, items R2/R3). A single SELECT: safe on the
-- read-only production replica, changes nothing, needs no temp objects.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f db/production-guard/verify_artifact_operations_guard.sql
--
-- Mirrors artifacts/api-server/src/lib/artifact-operations/database-protection.ts
-- and database-protection-contract.ts. If those change, change this too; the
-- comparisons are exact on purpose (an `... OR true` predicate must FAIL).
--
-- role_membership is evaluated for current_user, so run this AS THE PUBLISHED
-- API's login for a runtime verdict. A replica owner connection (neondb_owner)
-- cannot attest the application's identity; treat its membership row as
-- UNVERIFIED, not PASS.
-- =============================================================================
\if :{?guard_into_temp}
CREATE TEMP TABLE guard_verdict ON COMMIT DROP AS
\endif
WITH
subject AS (
  SELECT coalesce(nullif(current_setting('guard.app_login', true), ''), current_user::text) AS login
),
op AS (SELECT oid FROM pg_roles WHERE rolname = 'atanda_artifact_operations'),
protected(t) AS (VALUES ('imprima_jobs'),('imprima_files'),('short_sprint_runs'),
  ('artifact_operation_events'),('sprint_verifier_authorities')),
required(t, priv) AS (VALUES
  ('imprima_jobs','SELECT'),('imprima_jobs','INSERT'),('imprima_jobs','UPDATE'),
  ('imprima_files','SELECT'),('imprima_files','INSERT'),
  ('short_sprint_runs','SELECT'),('short_sprint_runs','INSERT'),('short_sprint_runs','UPDATE'),
  ('artifact_operation_events','SELECT'),('artifact_operation_events','INSERT'),
  ('sprint_verifier_authorities','SELECT'),('sprint_verifier_authorities','INSERT'),('sprint_verifier_authorities','UPDATE'),
  ('harness_artifacts','SELECT'),
  ('harness_feature_state','SELECT'),('harness_feature_state','INSERT'),('harness_feature_state','UPDATE'),
  ('command_deck_traces','SELECT'),('command_deck_traces','INSERT'),
  ('vte_verification_failures','SELECT'),('vte_verification_failures','INSERT'),('vte_verification_failures','UPDATE')),
owner_expr(t, e) AS (
  SELECT t, '((user_id = (NULLIF(current_setting(''app.operations_actor''::text, true), ''''::text))::uuid) OR (current_setting(''app.operations_admin''::text, true) = ''true''::text))'
    FROM (VALUES ('artifact_operation_events'),('imprima_files'),('imprima_jobs'),('short_sprint_runs')) v(t)),
expected(t, name, cmd, using_e, check_e) AS (
  SELECT t, t || '_owner', '*', e, e FROM owner_expr
  UNION ALL VALUES
  ('sprint_verifier_authorities','sprint_verifiers_read','r',
    '((NULLIF(current_setting(''app.operations_actor''::text, true), ''''::text))::uuid IS NOT NULL)', NULL),
  ('sprint_verifier_authorities','sprint_verifiers_admin_insert','a',
    NULL, '(current_setting(''app.operations_admin''::text, true) = ''true''::text)'),
  ('sprint_verifier_authorities','sprint_verifiers_admin_update','w',
    '(current_setting(''app.operations_admin''::text, true) = ''true''::text)',
    '(current_setting(''app.operations_admin''::text, true) = ''true''::text)')),
actual AS (
  SELECT c.relname::text AS t, p.polname::text AS name, p.polcmd::text AS cmd, p.polpermissive AS permissive,
         p.polroles = ARRAY[0]::oid[] AS public_only,
         pg_get_expr(p.polqual, p.polrelid) AS using_e, pg_get_expr(p.polwithcheck, p.polrelid) AS check_e
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace = 'public'::regnamespace AND c.relname::text IN (SELECT t FROM protected)),
policy_match AS (
  SELECT e.name, e.cmd = '*' AS is_owner,
         (SELECT count(*) = 1 AND bool_and(a.cmd = e.cmd AND a.permissive AND a.public_only
            AND a.using_e IS NOT DISTINCT FROM e.using_e AND a.check_e IS NOT DISTINCT FROM e.check_e)
            FROM actual a WHERE a.t = e.t AND a.name = e.name) AS ok
    FROM expected e),
fn_body(b) AS (VALUES (E'\nBEGIN\n  IF TG_TABLE_NAME = ''imprima_files'' THEN\n    IF NEW IS DISTINCT FROM OLD THEN\n      RAISE EXCEPTION ''Publication file metadata is immutable; create a new version'';\n    END IF;\n  ELSIF OLD.state = ''PUBLISHED'' AND OLD.config->>''mode'' = ''FINAL'' THEN\n    IF NEW IS DISTINCT FROM OLD THEN\n      RAISE EXCEPTION ''Published Final documents are immutable; create a new version'';\n    END IF;\n  END IF;\n  RETURN NEW;\nEND;\n')),
checks(ord, check_id, ok, detail) AS (
  SELECT 1, 'restricted_role',
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcanlogin AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication),
    CASE WHEN EXISTS(SELECT 1 FROM op) THEN 'role present' ELSE 'atanda_artifact_operations absent' END
  UNION ALL SELECT 2, 'role_membership',
    EXISTS(SELECT 1 FROM op, subject s WHERE pg_has_role(s.login, op.oid, 'MEMBER')),
    'evaluated for ' || (SELECT login FROM subject)
  UNION ALL SELECT 3, 'required_permissions',
    EXISTS(SELECT 1 FROM op) AND has_schema_privilege((SELECT oid FROM op), 'public', 'USAGE')
      AND (SELECT bool_and(CASE WHEN to_regclass('public.' || quote_ident(r.t)) IS NULL THEN false
            ELSE has_table_privilege((SELECT oid FROM op), to_regclass('public.' || quote_ident(r.t)), r.priv) END) FROM required r),
    coalesce((SELECT 'missing: ' || string_agg(r.t || ':' || r.priv, ', ') FROM required r
      WHERE NOT EXISTS(SELECT 1 FROM op) OR to_regclass('public.' || quote_ident(r.t)) IS NULL
         OR NOT has_table_privilege((SELECT oid FROM op), to_regclass('public.' || quote_ident(r.t)), r.priv)), 'all 22 present')
  UNION ALL SELECT 4, 'forced_rls',
    (SELECT count(*) = 5 FROM pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname::text IN (SELECT t FROM protected) AND relrowsecurity AND relforcerowsecurity),
    coalesce((SELECT 'not forced: ' || string_agg(relname, ', ') FROM pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname::text IN (SELECT t FROM protected) AND NOT (relrowsecurity AND relforcerowsecurity)), 'enabled+forced on 5')
  UNION ALL SELECT 5, 'owner_policies', (SELECT bool_and(coalesce(ok, false)) FROM policy_match WHERE is_owner),
    coalesce((SELECT 'mismatch: ' || string_agg(name, ', ') FROM policy_match WHERE is_owner AND NOT coalesce(ok, false)), 'exact')
  UNION ALL SELECT 6, 'authority_policies', (SELECT bool_and(coalesce(ok, false)) FROM policy_match WHERE NOT is_owner),
    coalesce((SELECT 'mismatch: ' || string_agg(name, ', ') FROM policy_match WHERE NOT is_owner AND NOT coalesce(ok, false)), 'exact')
  UNION ALL SELECT 7, 'policy_scope',
    NOT EXISTS(SELECT 1 FROM actual a WHERE a.permissive AND NOT EXISTS(SELECT 1 FROM expected e WHERE e.t = a.t AND e.name = a.name)),
    coalesce((SELECT 'extra permissive: ' || string_agg(a.t || '.' || a.name, ', ') FROM actual a
      WHERE a.permissive AND NOT EXISTS(SELECT 1 FROM expected e WHERE e.t = a.t AND e.name = a.name)), 'no extra permissive policies')
  UNION ALL SELECT 8, 'immutable_versions',
    (SELECT count(*) = 2 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_proc f ON f.oid = tg.tgfoid
      WHERE c.relnamespace = 'public'::regnamespace AND tg.tgenabled IN ('O','A') AND tg.tgtype = 19
        AND tg.tgqual IS NULL AND tg.tgattr = ''::int2vector
        AND f.pronamespace = 'public'::regnamespace AND f.proname = 'protect_imprima_immutable_version'
        AND f.pronargs = 0 AND f.prorettype = 'pg_catalog.trigger'::regtype
        AND f.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
        AND NOT f.prosecdef AND f.proconfig IS NULL AND f.prosrc = (SELECT b FROM fn_body)
        AND ((tg.tgname = 'imprima_file_immutable' AND c.relname = 'imprima_files')
          OR (tg.tgname = 'imprima_final_immutable' AND c.relname = 'imprima_jobs'))),
    'needs imprima_file_immutable + imprima_final_immutable with the reviewed body'
  UNION ALL SELECT 9, 'restricted_permissions',
    EXISTS(SELECT 1 FROM op) AND NOT has_schema_privilege((SELECT oid FROM op), 'public', 'CREATE')
      AND NOT EXISTS(SELECT 1 FROM pg_class c, op WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname::text IN (SELECT DISTINCT t FROM required)
        AND (c.relowner = op.oid OR has_table_privilege(op.oid, c.oid, 'DELETE') OR has_table_privilege(op.oid, c.oid, 'TRUNCATE')
          OR (c.relname IN ('imprima_files','artifact_operation_events') AND has_table_privilege(op.oid, c.oid, 'UPDATE')))),
    'no ownership, CREATE, DELETE/TRUNCATE, or UPDATE on immutable tables'
)
SELECT ord, check_id,
       CASE WHEN ok IS TRUE THEN 'PASS'
            WHEN check_id = 'role_membership' AND NOT EXISTS(SELECT 1 FROM op) THEN 'FAIL PREREQUISITE'
            WHEN check_id IN ('required_permissions','restricted_permissions') AND NOT EXISTS(SELECT 1 FROM op) THEN 'FAIL PREREQUISITE'
            ELSE 'FAIL' END AS verdict,
       detail
  FROM checks ORDER BY ord;
