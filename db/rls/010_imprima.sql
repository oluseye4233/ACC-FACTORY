-- =============================================================================
-- 010_imprima.sql
-- IMPRIMA (JNGL-PDD-IMPRIMA-2026-001) · data model from PDD Part 4.8, secured
--
-- Owner isolation: every row carries org_id + owner_id. A user sees and writes
-- only rows they own, inside their own organisation. Two documented exceptions:
--   * Approvers (role 'approver') may READ jobs AWAITING_APPROVAL in their org,
--     and the review material for those jobs, so they can approve (INV-08).
--   * Approvals are written by the approver, not the job owner.
--
-- Immutability (INV-07 "Published means immutable"): snapshots, reports,
-- review notes, overrides, approvals, library entries, versions, files and
-- audit events are append-only. A re-publish is a new document_versions row
-- that supersedes the previous one; a fork or a gap is refused.
--
-- Invariants enforced in the database:
--   INV-01  filename matches the five-token pattern (CHECK)
--   INV-06  scores stored as separate columns; no composite column exists
--   INV-07  append-only tables + linear version chain (triggers)
--   INV-08  a FINAL version requires a recorded approval for its job (trigger)
--   G-Honesty  a FINAL version over a HOLD verdict requires a written override
--   G-Parity   every file's content hash equals its version's content hash
-- =============================================================================


SET ROLE ark_owner;

CREATE SCHEMA IF NOT EXISTS imprima;
REVOKE ALL ON SCHEMA imprima FROM PUBLIC;
GRANT USAGE ON SCHEMA imprima TO ark_app;

-- --------------------------------------------------------------- tables -----

CREATE TABLE imprima.publish_jobs (
  job_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  owner_id            text NOT NULL,                       -- publisher (human)
  project_id          uuid NOT NULL,
  source_id           text NOT NULL,
  source_version_hash text NOT NULL CHECK (source_version_hash ~ '^[0-9a-f]{64}$'),
  artifact_type       text NOT NULL CHECK (artifact_type IN
                        ('MA','MICRO_PDD','SPC','PDD','MVP_PDD','LIVING_PDD',
                         'F0_SERVICE_OUTPUT','SPC_PLAYER_OUTPUT')),
  origin_stage        text NOT NULL CHECK (origin_stage IN
                        ('F0','F0.5','F3','F4','F5','F6','F7','F9.5','F10','SPC_PLAYER')),
  formats             text[] NOT NULL CHECK (formats <@ ARRAY['DOCX','PDF','HTML']
                                             AND cardinality(formats) BETWEEN 1 AND 3),
  audience            text NOT NULL CHECK (audience IN ('EXECUTIVE','TECHNICAL','CLIENT','PUBLIC')),
  mode                text NOT NULL CHECK (mode IN ('DRAFT','FINAL')),
  state               text NOT NULL DEFAULT 'QUEUED' CHECK (state IN
                        ('QUEUED','NORMALISING','CLARIFYING','INTERROGATING','RENDERING',
                         'VALIDATING','AWAITING_APPROVAL','PUBLISHED','HELD','FAILED')),
  gro_state           text NOT NULL DEFAULT 'LIFE' CHECK (gro_state IN ('LIFE','SAFE_LIFE','CONTAINMENT')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON imprima.publish_jobs (org_id, owner_id);
CREATE INDEX ON imprima.publish_jobs (org_id, state);

CREATE TABLE imprima.cdm_snapshots (
  snapshot_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES imprima.publish_jobs ON DELETE RESTRICT,
  org_id        uuid NOT NULL,
  owner_id      text NOT NULL,
  content_hash  text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  cdm           jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imprima.clarity_reports (
  report_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES imprima.publish_jobs ON DELETE RESTRICT,
  org_id         uuid NOT NULL,
  owner_id       text NOT NULL,
  change_report  jsonb NOT NULL,
  glossary_added jsonb,
  summary_added  boolean NOT NULL DEFAULT false,
  -- INV-06: three separate figures; NULL means "not run", never zero.
  clarity        numeric,
  truthfulness   numeric,
  detectability  numeric,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imprima.review_notes (
  note_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES imprima.publish_jobs ON DELETE RESTRICT,
  org_id      uuid NOT NULL,
  owner_id    text NOT NULL,
  claims      jsonb NOT NULL,
  flags       jsonb NOT NULL DEFAULT '[]',
  questions   jsonb NOT NULL DEFAULT '[]',
  verdict     text NOT NULL CHECK (verdict IN ('CLEAR','CLEAR_WITH_NOTES','HOLD')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A HOLD is resolved by a named human with a written reason; never edited away.
CREATE TABLE imprima.review_overrides (
  override_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL REFERENCES imprima.review_notes ON DELETE RESTRICT,
  org_id      uuid NOT NULL,
  owner_id    text NOT NULL,                      -- the human who overrode
  reason      text NOT NULL CHECK (length(btrim(reason)) >= 20),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imprima.approvals (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES imprima.publish_jobs ON DELETE RESTRICT,
  org_id      uuid NOT NULL,
  owner_id    text NOT NULL,                      -- the approver
  note        text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id)
);

CREATE TABLE imprima.document_library (
  doc_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  owner_id       text NOT NULL,
  project_id     uuid NOT NULL,
  production_id  text NOT NULL,
  source_id      text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, production_id)
);

CREATE TABLE imprima.document_versions (
  version_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          uuid NOT NULL REFERENCES imprima.document_library ON DELETE RESTRICT,
  org_id          uuid NOT NULL,
  owner_id        text NOT NULL,
  version_no      integer NOT NULL CHECK (version_no >= 1),
  supersedes_id   uuid REFERENCES imprima.document_versions ON DELETE RESTRICT,
  job_id          uuid NOT NULL REFERENCES imprima.publish_jobs ON DELETE RESTRICT,
  mode            text NOT NULL CHECK (mode IN ('DRAFT','FINAL')),
  content_hash    text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  title_token     text NOT NULL CHECK (title_token   ~ '^[A-Za-z0-9-]{1,60}(-[0-9]{2})?$'),
  datetime_token  text NOT NULL CHECK (datetime_token ~ '^[0-9]{8}-[0-9]{4}[A-Z]{2,5}$'),
  project_token   text NOT NULL CHECK (project_token ~ '^[A-Za-z0-9-]{1,60}$'),
  author_token    text NOT NULL CHECK (author_token  ~ '^[A-Za-z0-9-]{1,60}$'),
  design_score    integer CHECK (design_score BETWEEN 0 AND 50),   -- SKRIBE, shown alone
  verdict         text NOT NULL CHECK (verdict IN ('CLEAR','CLEAR_WITH_NOTES','HOLD')),
  approval_id     uuid REFERENCES imprima.approvals ON DELETE RESTRICT,
  override_id     uuid REFERENCES imprima.review_overrides ON DELETE RESTRICT,
  change_note     text,
  published_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, version_no),
  UNIQUE (supersedes_id),                                 -- no forks in the chain
  CHECK ((version_no = 1) = (supersedes_id IS NULL))
);

CREATE TABLE imprima.document_files (
  file_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    uuid NOT NULL REFERENCES imprima.document_versions ON DELETE RESTRICT,
  org_id        uuid NOT NULL,
  owner_id      text NOT NULL,
  format        text NOT NULL CHECK (format IN ('DOCX','PDF','HTML')),
  -- INV-01: Title__Date-Time__Project__Author__FORMAT.ext, max 180 characters.
  filename      text NOT NULL CHECK (
                  length(filename) <= 180 AND
                  filename ~ '^[A-Za-z0-9-]{1,60}(-[0-9]{2})?__[0-9]{8}-[0-9]{4}[A-Z]{2,5}__[A-Za-z0-9-]{1,60}__[A-Za-z0-9-]{1,60}__(DOCX\.docx|PDF\.pdf|HTML\.html)$'),
  storage_key   text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  content_hash  text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  validation    jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, format),
  CHECK (filename LIKE '%\_\_' || format || '.%')
);

CREATE TABLE imprima.audit_events (
  event_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL,
  owner_id      text NOT NULL,                    -- the actor
  job_id        uuid REFERENCES imprima.publish_jobs ON DELETE RESTRICT,
  action        text NOT NULL,
  version_hash  text,
  content_hash  text,
  gro_state     text CHECK (gro_state IN ('LIFE','SAFE_LIFE','CONTAINMENT')),
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------ owner stamping -----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['publish_jobs','cdm_snapshots','clarity_reports','review_notes',
                           'review_overrides','approvals','document_library',
                           'document_versions','document_files','audit_events']
  LOOP
    EXECUTE format('CREATE TRIGGER stamp_owner BEFORE INSERT ON imprima.%I
                    FOR EACH ROW EXECUTE FUNCTION app.stamp_owner()', t);
  END LOOP;
END $$;

-- --------------------------------------------------- immutability triggers --
-- Append-only tables: no UPDATE, DELETE or TRUNCATE, for any role that fires
-- triggers (everyone except a superuser who disables them).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cdm_snapshots','clarity_reports','review_notes',
                           'review_overrides','approvals','document_library',
                           'document_versions','document_files','audit_events']
  LOOP
    EXECUTE format('CREATE TRIGGER immutable_row BEFORE UPDATE OR DELETE ON imprima.%I
                    FOR EACH ROW EXECUTE FUNCTION app.reject_mutation()', t);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON imprima.%I
                    FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation()', t);
  END LOOP;
END $$;

-- publish_jobs is a state machine: identity columns are frozen at request time
-- (FR-02 snapshot), terminal jobs are frozen entirely, and rows are never deleted.
CREATE FUNCTION imprima.guard_job_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('PUBLISHED','FAILED') THEN
    RAISE EXCEPTION 'publish job % is % and cannot change', OLD.job_id, OLD.state
          USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.job_id, NEW.org_id, NEW.owner_id, NEW.project_id, NEW.source_id,
      NEW.source_version_hash, NEW.artifact_type, NEW.origin_stage, NEW.formats,
      NEW.audience, NEW.mode, NEW.created_at)
     IS DISTINCT FROM
     (OLD.job_id, OLD.org_id, OLD.owner_id, OLD.project_id, OLD.source_id,
      OLD.source_version_hash, OLD.artifact_type, OLD.origin_stage, OLD.formats,
      OLD.audience, OLD.mode, OLD.created_at) THEN
    RAISE EXCEPTION 'publish job % : only state and gro_state may change', OLD.job_id
          USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER guard_update BEFORE UPDATE ON imprima.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION imprima.guard_job_update();
CREATE TRIGGER no_delete BEFORE DELETE ON imprima.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON imprima.publish_jobs
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();

-- Version chain (INV-07), approval (INV-08) and honesty override (G-Honesty).
CREATE FUNCTION imprima.check_new_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_latest   imprima.document_versions%ROWTYPE;
  v_job      imprima.publish_jobs%ROWTYPE;
BEGIN
  -- Serialise version numbering per document.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.doc_id::text, 0));

  SELECT * INTO v_latest FROM imprima.document_versions
   WHERE doc_id = NEW.doc_id ORDER BY version_no DESC LIMIT 1;

  IF v_latest.version_id IS NULL THEN
    IF NEW.version_no <> 1 OR NEW.supersedes_id IS NOT NULL THEN
      RAISE EXCEPTION 'first version of document % must be version 1 with no predecessor', NEW.doc_id;
    END IF;
  ELSIF NEW.version_no <> v_latest.version_no + 1
        OR NEW.supersedes_id IS DISTINCT FROM v_latest.version_id THEN
    RAISE EXCEPTION 'document %: new version must be % and supersede %',
          NEW.doc_id, v_latest.version_no + 1, v_latest.version_id;
  END IF;

  SELECT * INTO v_job FROM imprima.publish_jobs WHERE job_id = NEW.job_id;
  IF v_job.job_id IS NULL OR v_job.mode <> NEW.mode THEN
    RAISE EXCEPTION 'version mode must match its publish job';
  END IF;

  IF NEW.mode = 'FINAL' THEN
    IF NEW.approval_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM imprima.approvals a
          WHERE a.approval_id = NEW.approval_id AND a.job_id = NEW.job_id) THEN
      RAISE EXCEPTION 'INV-08: a FINAL version needs a named approval for job %', NEW.job_id;
    END IF;
    IF NEW.verdict = 'HOLD' AND (NEW.override_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM imprima.review_overrides o
           JOIN imprima.review_notes n ON n.note_id = o.note_id
          WHERE o.override_id = NEW.override_id AND n.job_id = NEW.job_id)) THEN
      RAISE EXCEPTION 'G-Honesty: a FINAL version over a HOLD verdict needs a written override';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER check_version BEFORE INSERT ON imprima.document_versions
  FOR EACH ROW EXECUTE FUNCTION imprima.check_new_version();

-- Format parity: every file carries its version's content hash.
CREATE FUNCTION imprima.check_file_parity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM imprima.document_versions v
                  WHERE v.version_id = NEW.version_id
                    AND v.content_hash = NEW.content_hash) THEN
    RAISE EXCEPTION 'G-Parity: file content hash differs from its version';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER check_parity BEFORE INSERT ON imprima.document_files
  FOR EACH ROW EXECUTE FUNCTION imprima.check_file_parity();

-- ------------------------------------------- policy helper (no recursion) ---
-- Approvers may read a job's review material while that job awaits approval.
CREATE FUNCTION imprima.approver_can_read_job(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT app.has_role('approver') AND EXISTS (
    SELECT 1 FROM imprima.publish_jobs j
     WHERE j.job_id = p_job
       AND j.org_id = app.org_id()
       AND j.state  = 'AWAITING_APPROVAL')
$$;
-- Runs as ark_owner; reads publish_jobs through the org-scoped owner_lookup
-- policy below, so no BYPASSRLS is needed and no policy recursion occurs.
REVOKE EXECUTE ON FUNCTION imprima.approver_can_read_job(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION imprima.approver_can_read_job(uuid) TO ark_app;

-- ------------------------------------------------ forced row-level security -
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['publish_jobs','cdm_snapshots','clarity_reports','review_notes',
                           'review_overrides','approvals','document_library',
                           'document_versions','document_files','audit_events']
  LOOP
    EXECUTE format('ALTER TABLE imprima.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE imprima.%I FORCE  ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ------------------------------------------------- owner-isolation policies -
-- Pattern: same org AND (owner = actor). No DELETE policy exists anywhere.

-- Lookup policy for the SECURITY DEFINER helper (runs as ark_owner): current
-- org only, read only. With no request context the owner still sees nothing.
CREATE POLICY owner_lookup ON imprima.publish_jobs FOR SELECT TO ark_owner
  USING (org_id = app.org_id());

-- publish_jobs: owner reads/writes; approvers read jobs awaiting approval.
CREATE POLICY owner_select ON imprima.publish_jobs FOR SELECT TO ark_app
  USING (org_id = app.org_id() AND
         (owner_id = app.actor_id()
          OR (app.has_role('approver') AND state = 'AWAITING_APPROVAL')));
CREATE POLICY owner_insert ON imprima.publish_jobs FOR INSERT TO ark_app
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
              AND app.has_role('publisher'));
CREATE POLICY owner_update ON imprima.publish_jobs FOR UPDATE TO ark_app
  USING      (org_id = app.org_id() AND owner_id = app.actor_id())
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id());

-- Review material: owner reads/inserts; approver reads while awaiting approval.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cdm_snapshots','clarity_reports','review_notes']
  LOOP
    EXECUTE format($p$
      CREATE POLICY owner_select ON imprima.%1$I FOR SELECT TO ark_app
        USING (org_id = app.org_id() AND
               (owner_id = app.actor_id() OR imprima.approver_can_read_job(job_id)))$p$, t);
    EXECUTE format($p$
      CREATE POLICY owner_insert ON imprima.%1$I FOR INSERT TO ark_app
        WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
                    AND EXISTS (SELECT 1 FROM imprima.publish_jobs j
                                 WHERE j.job_id = %1$I.job_id
                                   AND j.owner_id = app.actor_id()))$p$, t);
  END LOOP;
END $$;

-- Overrides: written by an approver, about a note on a job they can see.
CREATE POLICY owner_select ON imprima.review_overrides FOR SELECT TO ark_app
  USING (org_id = app.org_id() AND
         (owner_id = app.actor_id()
          OR EXISTS (SELECT 1 FROM imprima.review_notes n
                      WHERE n.note_id = review_overrides.note_id)));
CREATE POLICY approver_insert ON imprima.review_overrides FOR INSERT TO ark_app
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
              AND app.has_role('approver')
              AND EXISTS (SELECT 1 FROM imprima.review_notes n
                           WHERE n.note_id = review_overrides.note_id));

-- Approvals: written by an approver for a job awaiting approval; readable by
-- the approver and by the job's owner.
CREATE POLICY owner_select ON imprima.approvals FOR SELECT TO ark_app
  USING (org_id = app.org_id() AND
         (owner_id = app.actor_id()
          OR EXISTS (SELECT 1 FROM imprima.publish_jobs j
                      WHERE j.job_id = approvals.job_id
                        AND j.owner_id = app.actor_id())));
CREATE POLICY approver_insert ON imprima.approvals FOR INSERT TO ark_app
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
              AND app.has_role('approver')
              AND imprima.approver_can_read_job(job_id));

-- Library, versions, files: strictly owner-isolated.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_library','document_versions','document_files']
  LOOP
    EXECUTE format($p$
      CREATE POLICY owner_select ON imprima.%1$I FOR SELECT TO ark_app
        USING (org_id = app.org_id() AND owner_id = app.actor_id())$p$, t);
    EXECUTE format($p$
      CREATE POLICY owner_insert ON imprima.%1$I FOR INSERT TO ark_app
        WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id())$p$, t);
  END LOOP;
END $$;

-- Audit: anyone in the org writes their own events; reads only their own.
CREATE POLICY owner_select ON imprima.audit_events FOR SELECT TO ark_app
  USING (org_id = app.org_id() AND owner_id = app.actor_id());
CREATE POLICY owner_insert ON imprima.audit_events FOR INSERT TO ark_app
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id());

-- ----------------------------------------------------- restricted grants ----
REVOKE ALL ON ALL TABLES IN SCHEMA imprima FROM PUBLIC;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA imprima TO ark_app;
GRANT UPDATE (state, gro_state) ON imprima.publish_jobs TO ark_app;
-- No DELETE, TRUNCATE, REFERENCES or TRIGGER privilege is granted on any table.

RESET ROLE;
