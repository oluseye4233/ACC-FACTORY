-- =============================================================================
-- db/production-guard/runtime_probe_artifact_operations.sql
--
-- ACTUAL-RUNTIME-ROLE probe (production audit 2026-10-26, item R3). Run it
-- with the SAME credentials the published API uses (not a replica owner):
--
--   psql "$API_DATABASE_URL" -f db/production-guard/runtime_probe_artifact_operations.sql
--
-- It reproduces what withOperationsActor() does (context.ts): SET LOCAL ROLE,
-- verify the role really switched, bind actor/admin as transaction-local
-- settings, then asserts that forbidden operations are refused. Every
-- statement runs inside one transaction that ends in ROLLBACK, and the
-- negative probes are expected to fail, so no row is created, changed or
-- deleted. Any unexpected success raises "PROBE FAIL".
-- =============================================================================
\set ON_ERROR_STOP on
BEGIN;
SELECT current_user AS api_login, session_user;

-- 1. Enter the restricted role exactly as the application does.
SET LOCAL ROLE atanda_artifact_operations;
DO $$
BEGIN
  IF NOT (SELECT current_user = 'atanda_artifact_operations' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcanlogin AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
      FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'PROBE FAIL: transaction did not enter the restricted role';
  END IF;
  RAISE NOTICE 'PASS role_switch';
END $$;

-- 2. A synthetic actor that owns nothing: must see zero protected rows.
SELECT set_config('app.operations_actor', '00000000-0000-4000-8000-00000000a0d1', true),
       set_config('app.operations_admin', 'false', true);
DO $$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM imprima_jobs) + (SELECT count(*) FROM imprima_files)
       + (SELECT count(*) FROM short_sprint_runs) + (SELECT count(*) FROM artifact_operation_events) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'PROBE FAIL: unrelated actor can see % protected rows', n; END IF;
  RAISE NOTICE 'PASS owner_isolation (0 foreign rows visible)';
END $$;

-- 3. Writing a row owned by someone else must be rejected by WITH CHECK.
DO $$
BEGIN
  BEGIN
    INSERT INTO artifact_operation_events (user_id) VALUES ('00000000-0000-4000-8000-0000000b0b02');
    RAISE EXCEPTION 'PROBE FAIL: cross-owner insert was accepted';
  EXCEPTION WHEN insufficient_privilege OR not_null_violation OR check_violation THEN
    -- RLS raises insufficient_privilege (42501); a NOT NULL/CHECK error would
    -- mean RLS did not get the chance, so report it rather than pass silently.
    IF SQLSTATE <> '42501' THEN RAISE EXCEPTION 'PROBE INCONCLUSIVE cross_owner_insert: % %', SQLSTATE, SQLERRM; END IF;
  END;
  RAISE NOTICE 'PASS cross_owner_insert_refused';
END $$;

-- 4. Destructive and immutable-table privileges must be absent.
DO $$
DECLARE stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    'DELETE FROM imprima_jobs WHERE false',
    'DELETE FROM artifact_operation_events WHERE false',
    'UPDATE imprima_files SET user_id = user_id WHERE false',
    'UPDATE artifact_operation_events SET user_id = user_id WHERE false',
    'TRUNCATE short_sprint_runs',
    'CREATE TABLE public.guard_probe_should_not_exist (id int)']
  LOOP
    BEGIN
      EXECUTE stmt;
      RAISE EXCEPTION 'PROBE FAIL: allowed: %', stmt;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  RAISE NOTICE 'PASS destructive_and_immutable_privileges_refused';
END $$;

-- 5. Administrator context: a Published Final document must stay immutable.
SELECT set_config('app.operations_admin', 'true', true);
DO $$
DECLARE target uuid;
BEGIN
  SELECT id INTO target FROM imprima_jobs WHERE state = 'PUBLISHED' AND config->>'mode' = 'FINAL' LIMIT 1;
  IF target IS NULL THEN RAISE NOTICE 'SKIPPED final_immutable (no Published Final row exists yet)'; RETURN; END IF;
  BEGIN
    UPDATE imprima_jobs SET state = 'DRAFT' WHERE id = target;
    RAISE EXCEPTION 'PROBE FAIL: Published Final document was edited in place';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Published Final documents are immutable%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS final_immutable';
END $$;

ROLLBACK;
\echo 'Runtime probe finished; transaction rolled back. Record the NOTICE lines as dated evidence.'
