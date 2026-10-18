-- tests/test_forced_rls.sql — run as a superuser that switches to ark_owner.
-- Proves FORCE ROW LEVEL SECURITY: even the table owner is filtered.
\set ON_ERROR_STOP on
SET ROLE ark_owner;
DO $$
DECLARE n int; t record; missing int := 0;
BEGIN
  -- Every table in both schemas has RLS enabled AND forced.
  FOR t IN SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname IN ('imprima','short_sprints') AND c.relkind = 'r'
  LOOP
    IF NOT (t.relrowsecurity AND t.relforcerowsecurity) THEN
      RAISE NOTICE 'FAIL  %.% is not forced', t.nspname, t.relname; missing := missing + 1;
    END IF;
  END LOOP;
  IF missing > 0 THEN RAISE EXCEPTION 'FAIL  % tables without forced RLS', missing; END IF;
  RAISE NOTICE 'PASS  all tables have RLS enabled and forced';

  -- The owner, with no request context, sees no rows (rows exist from the app test).
  SELECT count(*) INTO n FROM imprima.publish_jobs;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL  owner saw % rows without context', n; END IF;
  SELECT count(*) INTO n FROM short_sprints.ss_runs;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL  owner saw % runs without context', n; END IF;
  RAISE NOTICE 'PASS  table owner sees 0 rows: RLS is forced on the owner';

  -- No table grants DELETE or TRUNCATE to the app role.
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE grantee = 'ark_app' AND privilege_type IN ('DELETE','TRUNCATE','TRIGGER','REFERENCES');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL  ark_app holds % forbidden grants', n; END IF;
  RAISE NOTICE 'PASS  ark_app holds no DELETE, TRUNCATE, TRIGGER or REFERENCES grant';
END $$;
RESET ROLE;

-- Superusers bypass RLS: confirm the rows really exist, so the zero above is RLS.
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM imprima.publish_jobs;
  IF n = 0 THEN RAISE EXCEPTION 'FAIL  fixture rows missing; owner test proves nothing'; END IF;
  RAISE NOTICE 'PASS  % job row(s) exist (superuser view), so the owner''s 0 is RLS', n;
END $$;

-- Immutability triggers hold even for a superuser who bypasses grants and RLS.
CREATE FUNCTION pg_temp.must_raise(p_label text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~* 'immutable|cannot change|only (state|status)' THEN
      RAISE NOTICE 'PASS  %', p_label; RETURN; END IF;
    RAISE EXCEPTION 'FAIL  % : %', p_label, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL  % : succeeded', p_label;
END $$;
SELECT pg_temp.must_raise('trigger: UPDATE document_versions refused (superuser)',
  $q$UPDATE imprima.document_versions SET change_note = 'x'$q$);
SELECT pg_temp.must_raise('trigger: DELETE document_files refused (superuser)',
  $q$DELETE FROM imprima.document_files$q$);
SELECT pg_temp.must_raise('trigger: TRUNCATE audit_events refused (superuser)',
  $q$TRUNCATE imprima.audit_events CASCADE$q$);
SELECT pg_temp.must_raise('trigger: published job frozen (superuser)',
  $q$UPDATE imprima.publish_jobs SET state = 'QUEUED'$q$);
SELECT pg_temp.must_raise('trigger: UPDATE gate decision refused (superuser)',
  $q$UPDATE short_sprints.ss_gate_decisions SET decision = 'YES'$q$);
SELECT pg_temp.must_raise('trigger: DELETE SASS version refused (superuser)',
  $q$DELETE FROM short_sprints.ss_sass_versions$q$);
SELECT pg_temp.must_raise('trigger: run identity frozen (superuser)',
  $q$UPDATE short_sprints.ss_runs SET circuit = 'SC_TWO'$q$);
SELECT pg_temp.must_raise('trigger: DELETE run refused (superuser)',
  $q$DELETE FROM short_sprints.ss_runs$q$);

-- v1.1: no ARK role may hold BYPASSRLS or SUPERUSER.
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM pg_roles
   WHERE rolname LIKE 'ark\_%' AND (rolbypassrls OR rolsuper);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL  % ARK role(s) can bypass RLS', n; END IF;
  RAISE NOTICE 'PASS  no ARK role holds BYPASSRLS or SUPERUSER';
END $$;
