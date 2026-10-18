-- =============================================================================
-- tests/test_security.sql — run as ark_app_login (the restricted role).
-- Every check prints PASS or raises. Any raise stops the run (ON_ERROR_STOP).
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages = notice;

-- expect_fail(sql, pattern): the statement must raise an error matching pattern.
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~* p_pattern THEN
      RAISE NOTICE 'PASS  %', p_label; RETURN;
    END IF;
    RAISE EXCEPTION 'FAIL  % : wrong error: %', p_label, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL  % : statement succeeded but should have failed', p_label;
END $$;

-- expect_count(sql, n): the query must return n rows.
CREATE FUNCTION pg_temp.expect_count(p_label text, p_sql text, p_n int)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE c int;
BEGIN
  EXECUTE format('SELECT count(*) FROM (%s) q', p_sql) INTO c;
  IF c <> p_n THEN RAISE EXCEPTION 'FAIL  % : expected % rows, got %', p_label, p_n, c; END IF;
  RAISE NOTICE 'PASS  %', p_label;
END $$;

CREATE FUNCTION pg_temp.ctx(p_org text, p_user text, p_roles text) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('app.org_id', p_org, false),
         set_config('app.user_id', p_user, false),
         set_config('app.user_roles', p_roles, false);
$$;

-- Fixtures -------------------------------------------------------------------
\set ORG_A '11111111-1111-1111-1111-111111111111'
\set ORG_B '22222222-2222-2222-2222-222222222222'
\set PROJ  '33333333-3333-3333-3333-333333333333'
\set H64   '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''
\set H64B  '''bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'''

\echo '--- 1. Restricted role ---'
DO $$ BEGIN
  IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'FAIL  login role can bypass RLS'; END IF;
  RAISE NOTICE 'PASS  login role is not superuser and has no BYPASSRLS';
END $$;
SELECT pg_temp.expect_fail('no context -> insert refused',
  $q$INSERT INTO imprima.audit_events(action) VALUES ('x')$q$, 'context missing|row-level security');
SELECT pg_temp.expect_fail('cannot create tables in public',
  'CREATE TABLE public.evil(x int)', 'permission denied');
SELECT pg_temp.expect_fail('cannot SET ROLE to ark_app',
  'SET ROLE ark_app', 'permission denied');
SELECT pg_temp.expect_fail('cannot disable RLS',
  'ALTER TABLE imprima.publish_jobs DISABLE ROW LEVEL SECURITY', 'must be owner');
SELECT pg_temp.expect_fail('cannot drop an immutability trigger',
  'DROP TRIGGER immutable_row ON imprima.document_versions', 'must be owner');
SELECT pg_temp.expect_count('no context -> sees nothing',
  'SELECT 1 FROM imprima.publish_jobs', 0);

\echo '--- 2. IMPRIMA: owner isolation ---'
SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
INSERT INTO imprima.publish_jobs (job_id, project_id, source_id, source_version_hash,
  artifact_type, origin_stage, formats, audience, mode)
VALUES ('a0000000-0000-0000-0000-000000000001', :'PROJ', 'SPC-001', :H64,
        'SPC', 'F5', ARRAY['DOCX','PDF'], 'TECHNICAL', 'FINAL');
SELECT pg_temp.expect_fail('cannot insert a row owned by someone else',
  $q$INSERT INTO imprima.publish_jobs (owner_id, project_id, source_id, source_version_hash,
     artifact_type, origin_stage, formats, audience, mode)
     VALUES ('user_mallory','33333333-3333-3333-3333-333333333333','S',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','SPC','F5',
     ARRAY['PDF'],'TECHNICAL','DRAFT')$q$, 'row-level security');
SELECT pg_temp.expect_fail('cannot insert into another org',
  $q$INSERT INTO imprima.publish_jobs (org_id, project_id, source_id, source_version_hash,
     artifact_type, origin_stage, formats, audience, mode)
     VALUES ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','S',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','SPC','F5',
     ARRAY['PDF'],'TECHNICAL','DRAFT')$q$, 'row-level security');
INSERT INTO imprima.cdm_snapshots (job_id, content_hash, cdm)
VALUES ('a0000000-0000-0000-0000-000000000001', :H64, '{"blocks":[]}');
INSERT INTO imprima.review_notes (note_id, job_id, claims, verdict)
VALUES ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','[]','HOLD');

SELECT pg_temp.ctx(:'ORG_A', 'user_bob', 'publisher');
SELECT pg_temp.expect_count('other user in same org sees none of alice''s jobs',
  'SELECT 1 FROM imprima.publish_jobs', 0);
SELECT pg_temp.expect_count('other user sees none of alice''s snapshots',
  'SELECT 1 FROM imprima.cdm_snapshots', 0);
SELECT pg_temp.expect_fail('other user cannot attach a snapshot to alice''s job',
  $q$INSERT INTO imprima.cdm_snapshots (job_id, content_hash, cdm) VALUES
    ('a0000000-0000-0000-0000-000000000001',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}')$q$,
  'row-level security');
DO $$ DECLARE n int; BEGIN
  UPDATE imprima.publish_jobs SET state = 'FAILED'
   WHERE job_id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL  bob updated alice''s job'; END IF;
  RAISE NOTICE 'PASS  other user''s UPDATE touches 0 rows';
END $$;

SELECT pg_temp.ctx(:'ORG_B', 'user_alice', 'publisher,approver');
SELECT pg_temp.expect_count('same user id in another org sees nothing',
  'SELECT 1 FROM imprima.publish_jobs', 0);

\echo '--- 3. IMPRIMA: approver path ---'
SELECT pg_temp.ctx(:'ORG_A', 'user_carol', 'approver');
SELECT pg_temp.expect_count('approver cannot see a job before it awaits approval',
  'SELECT 1 FROM imprima.publish_jobs', 0);
SELECT pg_temp.expect_fail('approver cannot approve a job not awaiting approval',
  $q$INSERT INTO imprima.approvals (job_id) VALUES ('a0000000-0000-0000-0000-000000000001')$q$,
  'row-level security');

SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
UPDATE imprima.publish_jobs SET state = 'AWAITING_APPROVAL'
 WHERE job_id = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_fail('publisher (not approver) cannot approve own job',
  $q$INSERT INTO imprima.approvals (job_id) VALUES ('a0000000-0000-0000-0000-000000000001')$q$,
  'row-level security');
SELECT pg_temp.expect_fail('identity columns of a job are frozen',
  $q$UPDATE imprima.publish_jobs SET source_version_hash =
     'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
     WHERE job_id = 'a0000000-0000-0000-0000-000000000001'$q$, 'permission denied|only state');

SELECT pg_temp.ctx(:'ORG_A', 'user_carol', 'approver');
SELECT pg_temp.expect_count('approver sees the job awaiting approval',
  'SELECT 1 FROM imprima.publish_jobs', 1);
SELECT pg_temp.expect_count('approver sees its review notes',
  'SELECT 1 FROM imprima.review_notes', 1);
INSERT INTO imprima.approvals (approval_id, job_id)
VALUES ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001');

\echo '--- 4. IMPRIMA: immutable versions ---'
SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
INSERT INTO imprima.document_library (doc_id, project_id, production_id, source_id)
VALUES ('e0000000-0000-0000-0000-000000000001', :'PROJ', 'JNGL-DOC-SPC-2026-001', 'SPC-001');

SELECT pg_temp.expect_fail('INV-08: FINAL without approval refused',
  $q$INSERT INTO imprima.document_versions (doc_id, version_no, job_id, mode, content_hash,
     title_token, datetime_token, project_token, author_token, verdict)
     VALUES ('e0000000-0000-0000-0000-000000000001',1,'a0000000-0000-0000-0000-000000000001',
     'FINAL','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
     'SPC-Card','20261017-0200CDT','ADAeM-2-0','OLUSEYE-AMUSA','CLEAR')$q$, 'INV-08');
SELECT pg_temp.expect_fail('G-Honesty: FINAL over HOLD without override refused',
  $q$INSERT INTO imprima.document_versions (doc_id, version_no, job_id, mode, content_hash,
     title_token, datetime_token, project_token, author_token, verdict, approval_id)
     VALUES ('e0000000-0000-0000-0000-000000000001',1,'a0000000-0000-0000-0000-000000000001',
     'FINAL','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
     'SPC-Card','20261017-0200CDT','ADAeM-2-0','OLUSEYE-AMUSA','HOLD',
     'd0000000-0000-0000-0000-000000000001')$q$, 'G-Honesty');

SELECT pg_temp.ctx(:'ORG_A', 'user_carol', 'approver');
SELECT pg_temp.expect_fail('override reason must be substantive',
  $q$INSERT INTO imprima.review_overrides (note_id, reason)
     VALUES ('c0000000-0000-0000-0000-000000000001','ok')$q$, 'check constraint');
INSERT INTO imprima.review_overrides (override_id, note_id, reason)
VALUES ('f0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',
        'Claim is supported by the XVL evidence pack attached to the job.');

SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
INSERT INTO imprima.document_versions (version_id, doc_id, version_no, job_id, mode, content_hash,
  title_token, datetime_token, project_token, author_token, verdict, approval_id, override_id)
VALUES ('10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',1,
  'a0000000-0000-0000-0000-000000000001','FINAL', :H64,
  'SPC-Card','20261017-0200CDT','ADAeM-2-0','OLUSEYE-AMUSA','HOLD',
  'd0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001');
\echo 'PASS  FINAL v1 inserted with approval and override'

SELECT pg_temp.expect_fail('INV-07: published version cannot be updated',
  $q$UPDATE imprima.document_versions SET change_note = 'edit'
     WHERE version_id = '10000000-0000-0000-0000-000000000001'$q$, 'permission denied|immutable');
SELECT pg_temp.expect_fail('INV-07: published version cannot be deleted',
  $q$DELETE FROM imprima.document_versions
     WHERE version_id = '10000000-0000-0000-0000-000000000001'$q$, 'permission denied|immutable');
SELECT pg_temp.expect_fail('version chain: a gap is refused',
  $q$INSERT INTO imprima.document_versions (doc_id, version_no, supersedes_id, job_id, mode,
     content_hash, title_token, datetime_token, project_token, author_token, verdict)
     VALUES ('e0000000-0000-0000-0000-000000000001',3,'10000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001','FINAL',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
     'SPC-Card','20261017-0300CDT','ADAeM-2-0','OLUSEYE-AMUSA','CLEAR')$q$, 'must be 2');
SELECT pg_temp.expect_fail('INV-01: bad filename refused',
  $q$INSERT INTO imprima.document_files (version_id, format, filename, storage_key, size_bytes,
     content_hash, validation) VALUES ('10000000-0000-0000-0000-000000000001','PDF',
     'my document final v2.pdf','k',10,
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}')$q$, 'check constraint');
SELECT pg_temp.expect_fail('G-Parity: file hash must match version',
  $q$INSERT INTO imprima.document_files (version_id, format, filename, storage_key, size_bytes,
     content_hash, validation) VALUES ('10000000-0000-0000-0000-000000000001','PDF',
     'SPC-Card__20261017-0200CDT__ADAeM-2-0__OLUSEYE-AMUSA__PDF.pdf','k',10,
     'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','{}')$q$, 'G-Parity');
INSERT INTO imprima.document_files (version_id, format, filename, storage_key, size_bytes,
  content_hash, validation) VALUES ('10000000-0000-0000-0000-000000000001','PDF',
  'SPC-Card__20261017-0200CDT__ADAeM-2-0__OLUSEYE-AMUSA__PDF.pdf','blob/k1',1024, :H64, '{"ok":true}');
\echo 'PASS  conforming file inserted'
UPDATE imprima.publish_jobs SET state = 'PUBLISHED'
 WHERE job_id = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_fail('terminal job is frozen',
  $q$UPDATE imprima.publish_jobs SET state = 'HELD'
     WHERE job_id = 'a0000000-0000-0000-0000-000000000001'$q$, 'cannot change');
SELECT pg_temp.expect_fail('TRUNCATE refused',
  'TRUNCATE imprima.audit_events', 'permission denied|immutable');

\echo '--- 5. SHORT SPRINTS: owner isolation and delegates ---'
SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
INSERT INTO short_sprints.ss_runs (run_id, project_id, trace_id, circuit, target_type, xvl_profile)
VALUES ('50000000-0000-0000-0000-000000000001', :'PROJ',
        '60000000-0000-0000-0000-000000000001', 'SC_ONE', 'VIBE_APP', 'STANDARD')
RETURNING run_id \gset
\echo 'PASS  INSERT ... RETURNING works for the owner'
INSERT INTO short_sprints.ss_eligibility (run_id, gate, rule_id, passed, reason, rule_hash) VALUES
 ('50000000-0000-0000-0000-000000000001','SC_ONE','CELL-04',true,'2 prompts (limit 3)', :H64),
 ('50000000-0000-0000-0000-000000000001','SC_ONE','CELL-07',false,'Uses 2 tools; a Molecular Agent can use 1', :H64);

SELECT pg_temp.ctx(:'ORG_A', 'user_bob', 'publisher');
SELECT pg_temp.expect_count('non-delegate sees no run', 'SELECT 1 FROM short_sprints.ss_runs', 0);
SELECT pg_temp.expect_fail('non-delegate cannot answer the gate',
  $q$INSERT INTO short_sprints.ss_gate_decisions (run_id, gate, decision, reason, eligibility_hash)
     VALUES ('50000000-0000-0000-0000-000000000001','SC_ONE','NO','x',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'not accessible|row-level security');
SELECT pg_temp.expect_fail('non-owner cannot grant themselves delegation',
  $q$INSERT INTO short_sprints.ss_run_delegates (run_id, delegate_id)
     VALUES ('50000000-0000-0000-0000-000000000001','user_bob')$q$, 'row-level security|check constraint');

SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
INSERT INTO short_sprints.ss_run_delegates (run_id, delegate_id)
VALUES ('50000000-0000-0000-0000-000000000001','user_dan');

SELECT pg_temp.ctx(:'ORG_A', 'user_dan', 'publisher');
SELECT pg_temp.expect_count('delegate sees the run', 'SELECT 1 FROM short_sprints.ss_runs', 1);
SELECT pg_temp.expect_count('delegate sees its eligibility', 'SELECT 1 FROM short_sprints.ss_eligibility', 2);
SELECT pg_temp.expect_fail('SS-FR-03: YES refused when a rule failed',
  $q$INSERT INTO short_sprints.ss_gate_decisions (run_id, gate, decision, reason, eligibility_hash)
     VALUES ('50000000-0000-0000-0000-000000000001','SC_ONE','YES','ship it',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'YES refused');
SELECT pg_temp.expect_fail('gate must match circuit',
  $q$INSERT INTO short_sprints.ss_gate_decisions (run_id, gate, decision, reason, eligibility_hash)
     VALUES ('50000000-0000-0000-0000-000000000001','SC_TWO','NO','x',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'does not match');
INSERT INTO short_sprints.ss_gate_decisions (run_id, gate, decision, reason, eligibility_hash)
VALUES ('50000000-0000-0000-0000-000000000001','SC_ONE','NO','Continue to F5: two tools', :H64);
\echo 'PASS  delegate records a NO decision'
SELECT pg_temp.expect_fail('delegate cannot change run status (owner only)',
  $q$DO $d$ DECLARE n int; BEGIN
     UPDATE short_sprints.ss_runs SET status = 'WITHDRAWN'
      WHERE run_id = '50000000-0000-0000-0000-000000000001';
     GET DIAGNOSTICS n = ROW_COUNT;
     IF n = 0 THEN RAISE EXCEPTION 'blocked: 0 rows'; END IF; END $d$$q$, 'blocked: 0 rows');

\echo '--- 6. SHORT SPRINTS: immutable records ---'
SELECT pg_temp.expect_fail('gate decision cannot be edited',
  $q$UPDATE short_sprints.ss_gate_decisions SET decision = 'YES'$q$, 'permission denied|immutable');
SELECT pg_temp.expect_fail('eligibility cannot be deleted',
  $q$DELETE FROM short_sprints.ss_eligibility$q$, 'permission denied|immutable');

SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher');
SELECT pg_temp.expect_fail('XVL-01: PASS at I0 refused',
  $q$INSERT INTO short_sprints.ss_pack_results (run_id, circuit, verdict, min_independence,
     checks, evidence_hash) VALUES ('50000000-0000-0000-0000-000000000001','SC_ONE','PASS','I0',
     '{}','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'check constraint');
SELECT pg_temp.expect_fail('SC_TWO pack needs a SASS',
  $q$INSERT INTO short_sprints.ss_pack_results (run_id, circuit, verdict, min_independence,
     checks, evidence_hash) VALUES ('50000000-0000-0000-0000-000000000001','SC_TWO','FAIL','I1',
     '{}','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'check constraint');
SELECT pg_temp.expect_fail('SS-INV-03: F9 PASS without external evidence refused',
  $q$INSERT INTO short_sprints.ss_mecha_results (run_id, verdict)
     VALUES ('50000000-0000-0000-0000-000000000001','PASS')$q$, 'check constraint');
SELECT pg_temp.expect_fail('SS-INV-04: F9.5 cannot be recorded as skipped',
  $q$INSERT INTO short_sprints.ss_stage_skips (run_id, stage, circuit, reason)
     VALUES ('50000000-0000-0000-0000-000000000001','F9.5','SC_ONE','x')$q$, 'check constraint');
SELECT pg_temp.expect_fail('SS-INV-06: skipped stage listed as passed refused',
  $q$INSERT INTO short_sprints.ss_certificates (run_id, circuit, conformity_state,
     stages_passed, stages_skipped) VALUES ('50000000-0000-0000-0000-000000000001','SC_ONE',
     'EVIDENCE_BACKED', ARRAY['F0','F4','F6','F9.5','F10'], ARRAY['F5','F6'])$q$, 'check constraint');
SELECT pg_temp.expect_fail('SS-INV-04: certificate without F9.5 refused',
  $q$INSERT INTO short_sprints.ss_certificates (run_id, circuit, conformity_state,
     stages_passed, stages_skipped) VALUES ('50000000-0000-0000-0000-000000000001','SC_ONE',
     'EVIDENCE_BACKED', ARRAY['F0','F4','F10'], ARRAY['F5'])$q$, 'check constraint');

INSERT INTO short_sprints.ss_sass_versions (sass_id, run_id, version_no, spc_version_hash, content_hash, body)
VALUES ('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',1, :H64, :H64, '{"identity":"x"}');
SELECT pg_temp.expect_fail('SASS chain: fork from v1 at v1 refused',
  $q$INSERT INTO short_sprints.ss_sass_versions (run_id, version_no, spc_version_hash, content_hash, body)
     VALUES ('50000000-0000-0000-0000-000000000001',1,
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}')$q$, 'version 2|must be version');
INSERT INTO short_sprints.ss_sass_versions (run_id, version_no, supersedes_id, spc_version_hash, content_hash, body)
VALUES ('50000000-0000-0000-0000-000000000001',2,'70000000-0000-0000-0000-000000000001', :H64, :H64B, '{"identity":"y"}');
\echo 'PASS  SASS v2 supersedes v1'
SELECT pg_temp.expect_fail('SASS version cannot be edited',
  $q$UPDATE short_sprints.ss_sass_versions SET body = '{}'$q$, 'permission denied|immutable');

SELECT pg_temp.expect_fail('promotion needs the SPHINX approver role',
  $q$INSERT INTO short_sprints.ss_promotions (run_id, reentry_stage, parent_trace_id, new_trace_id)
     VALUES ('50000000-0000-0000-0000-000000000001','F5','60000000-0000-0000-0000-000000000001',
     '60000000-0000-0000-0000-000000000002')$q$, 'row-level security');
SELECT pg_temp.ctx(:'ORG_A', 'user_alice', 'publisher,sphinx_approver');
SELECT pg_temp.expect_fail('SC_ONE must re-enter at F5',
  $q$INSERT INTO short_sprints.ss_promotions (run_id, reentry_stage, parent_trace_id, new_trace_id)
     VALUES ('50000000-0000-0000-0000-000000000001','F6','60000000-0000-0000-0000-000000000001',
     '60000000-0000-0000-0000-000000000002')$q$, 're-entry');

SELECT pg_temp.ctx(:'ORG_B', 'user_alice', 'publisher');
SELECT pg_temp.expect_count('other org sees no short-sprint rows',
  'SELECT 1 FROM short_sprints.ss_runs UNION ALL SELECT 1 FROM short_sprints.ss_gate_decisions', 0);

\echo 'ALL TESTS PASSED'
