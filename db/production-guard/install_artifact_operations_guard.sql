-- =============================================================================
-- db/production-guard/install_artifact_operations_guard.sql
--
-- Reviewed, ADMINISTRATOR-RUN installation of the public-schema IMPRIMA /
-- SHORT SPRINTS workflow guards (production audit 2026-10-26, item R2).
--
-- Why this exists: migrations 0048, 0050 and 0051 install these guards in
-- development, but managed Publish only diffs table/policy *schema*. It does
-- not carry roles, grants, FORCE RLS, policy predicates, functions or triggers,
-- which is exactly what the 2026-10-26 production catalog was missing.
--
-- This file is NOT run by Publish, startup, CI or any agent. An authorized
-- administrator runs it once, after security review, against production:
--
--   psql "$PROD_ADMIN_URL" -v ON_ERROR_STOP=1 \
--        -v app_login='<role the published API actually connects as>' \
--        -f db/production-guard/install_artifact_operations_guard.sql
--
-- Properties
--   * One transaction. Any failure, including the final self-check, rolls
--     everything back; nothing is half-installed.
--   * Idempotent: re-running converges on the same reviewed definitions.
--   * Statements are copied from migrations 0048/0050/0051 so the catalog
--     serializes exactly as database-protection-contract.ts expects.
--   * No data rows are read, written or deleted.
--   * It never weakens a check: if the result does not match the reviewed
--     contract, it raises and rolls back.
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?app_login}
\else
  \echo 'ERROR: pass -v app_login=<runtime login role of the published API>'
  DO $$ BEGIN RAISE EXCEPTION 'app_login not supplied; nothing was changed'; END $$;
\endif

BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT set_config('guard.app_login', :'app_login', true);

-- 0. Preconditions: the nine workflow tables exist and the app login is real.
DO $$
DECLARE
  missing text;
  login text := current_setting('guard.app_login');
BEGIN
  SELECT string_agg(t, ', ') INTO missing
    FROM unnest(ARRAY['imprima_jobs','imprima_files','short_sprint_runs',
      'artifact_operation_events','sprint_verifier_authorities','harness_artifacts',
      'harness_feature_state','command_deck_traces','vte_verification_failures']) t
   WHERE to_regclass('public.' || quote_ident(t)) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Workflow tables missing (publish the schema first): %', missing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = login) THEN
    RAISE EXCEPTION 'app_login role "%" does not exist', login;
  END IF;
  IF login = 'atanda_artifact_operations' THEN
    RAISE EXCEPTION 'app_login must be the runtime login, not the restricted role';
  END IF;
END $$;

-- 1. Restricted, non-login operations role (0048).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations') THEN
    CREATE ROLE atanda_artifact_operations NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations'
    AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'Operations role must be a non-login, non-superuser, non-bypass role';
  END IF;
END $$;

-- 2. Membership for the actual runtime login, so SET LOCAL ROLE succeeds.
--    (0048 granted to CURRENT_USER; in production the administrator and the
--    API login may differ, so the login is named explicitly.)
DO $$
BEGIN
  EXECUTE format('GRANT atanda_artifact_operations TO %I', current_setting('guard.app_login'));
END $$;

-- 3. Positive privilege matrix (0048), then the explicit restrictions (0051).
GRANT USAGE ON SCHEMA public TO atanda_artifact_operations;
REVOKE CREATE ON SCHEMA public FROM atanda_artifact_operations;
GRANT SELECT, INSERT, UPDATE ON imprima_jobs, short_sprint_runs, sprint_verifier_authorities TO atanda_artifact_operations;
GRANT SELECT, INSERT ON imprima_files, artifact_operation_events TO atanda_artifact_operations;
GRANT SELECT ON harness_artifacts TO atanda_artifact_operations;
GRANT SELECT, INSERT, UPDATE ON harness_feature_state TO atanda_artifact_operations;
GRANT SELECT, INSERT ON command_deck_traces TO atanda_artifact_operations;
GRANT SELECT, INSERT, UPDATE ON vte_verification_failures TO atanda_artifact_operations;
REVOKE DELETE, TRUNCATE ON imprima_jobs, imprima_files, short_sprint_runs,
  artifact_operation_events, sprint_verifier_authorities, harness_artifacts,
  harness_feature_state, command_deck_traces, vte_verification_failures
  FROM atanda_artifact_operations;
REVOKE UPDATE ON imprima_files, artifact_operation_events FROM atanda_artifact_operations;

-- 4. RLS enabled AND forced on the five protected tables (0048).
ALTER TABLE imprima_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE imprima_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_sprint_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_operation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_verifier_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE imprima_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE imprima_files FORCE ROW LEVEL SECURITY;
ALTER TABLE short_sprint_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE artifact_operation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE sprint_verifier_authorities FORCE ROW LEVEL SECURITY;

-- 5. Replace the seven predicate-less policies with the reviewed definitions
--    (0048). Any other PERMISSIVE policy on these tables would OR a bypass into
--    the rules, so it stops the install for human review instead of being dropped.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(c.relname || '.' || p.polname, ', ') INTO extra
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace = 'public'::regnamespace AND p.polpermissive
     AND c.relname IN ('imprima_jobs','imprima_files','short_sprint_runs','artifact_operation_events','sprint_verifier_authorities')
     AND p.polname NOT IN ('imprima_jobs_owner','imprima_files_owner','short_sprint_runs_owner','artifact_operation_events_owner',
       'sprint_verifiers_read','sprint_verifiers_admin_insert','sprint_verifiers_admin_update');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'Unreviewed permissive policies present; review before installing: %', extra;
  END IF;
END $$;
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

-- 6. Immutable-version function and both triggers (0050). The body must match
--    IMMUTABLE_VERSION_FUNCTION_BODY byte for byte.
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
DROP TRIGGER IF EXISTS imprima_final_immutable ON imprima_jobs;
CREATE TRIGGER imprima_file_immutable BEFORE UPDATE ON imprima_files
FOR EACH ROW EXECUTE FUNCTION protect_imprima_immutable_version();
CREATE TRIGGER imprima_final_immutable BEFORE UPDATE ON imprima_jobs
FOR EACH ROW EXECUTE FUNCTION protect_imprima_immutable_version();

-- 7. Self-check with the same read-only matrix the auditor runs. Any FAIL
--    raises, which rolls the whole installation back.
\set guard_into_temp 1
\ir verify_artifact_operations_guard.sql
SELECT check_id, verdict, detail FROM pg_temp.guard_verdict ORDER BY ord;
DO $$
DECLARE failed text;
BEGIN
  SELECT string_agg(check_id, ', ') INTO failed FROM pg_temp.guard_verdict WHERE verdict <> 'PASS';
  IF failed IS NOT NULL THEN
    RAISE EXCEPTION 'Guard self-check failed, rolling back: %', failed;
  END IF;
END $$;

COMMIT;
\echo 'Installed. Now run the actual-runtime-role probe as the API login: runtime_probe_artifact_operations.sql'
