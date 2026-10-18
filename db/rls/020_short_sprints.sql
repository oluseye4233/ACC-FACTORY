-- =============================================================================
-- 020_short_sprints.sql
-- SHORT SPRINTS (JNGL-ARKH-PDD-SS-2026-001 v1.1) · records from Part 4, secured
--
-- Tables
--   ss_runs              one short-circuit run per project trace (mutable status)
--   ss_run_delegates     who besides the owner may answer the run's gates (SS-GOV-001)
--   ss_eligibility       rule-by-rule eligibility results (immutable)
--   ss_gate_decisions    sc_gate_decision events (append-only, SS-INV-02)
--   ss_stage_skips       SKIPPED_BY_SC records (append-only, SS-INV-05)
--   ss_sass_versions     Standalone Agent Spec Sheet versions (immutable chain)
--   ss_pack_results      sc_pack_result verdicts (immutable)
--   ss_mecha_results     F9 results for firmware targets (immutable)
--   ss_custody_records   F9.5 OSIRIS custody records (immutable)
--   ss_certificates      issued certificates (immutable, SS-INV-06)
--   ss_promotions        sc_promotion records (append-only)
--   ss_audit_events      audit trail (append-only)
--
-- Owner isolation: same org AND (run owner OR an active delegate of the run).
-- Invariants enforced in the database:
--   SS-INV-02  gate decisions are by a named human who owns or is delegated the run;
--              YES is refused unless every eligibility rule for that gate passed
--   SS-INV-01  a PASS pack needs minimum independence I1 (CHECK)
--   SS-INV-03  firmware MECHA results carry external evidence (CHECK)
--   SS-INV-05  stage skips are append-only
--   SS-INV-06  a certificate never lists a skipped stage as passed (CHECK)
--   immutable versions: SASS chain is linear; append-only tables refuse UPDATE,
--   DELETE and TRUNCATE
-- Not enforced here (application layer): the route state machine (F9 -> F9.5 ->
-- F10), see the note at the end of this file.
-- =============================================================================


SET ROLE ark_owner;

CREATE SCHEMA IF NOT EXISTS short_sprints;
REVOKE ALL ON SCHEMA short_sprints FROM PUBLIC;
GRANT USAGE ON SCHEMA short_sprints TO ark_app;

CREATE TABLE short_sprints.ss_runs (
  run_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  owner_id     text NOT NULL,
  project_id   uuid NOT NULL,
  trace_id     uuid NOT NULL UNIQUE,
  circuit      text NOT NULL CHECK (circuit IN ('SC_ONE','SC_TWO')),
  target_type  text NOT NULL CHECK (target_type IN ('VIBE_APP','NO_CODE_HOST','HOST_PLATFORM','FIRMWARE')),
  xvl_profile  text NOT NULL CHECK (xvl_profile IN ('PROTOTYPE_LIGHT','STANDARD','REGULATED','CUSTOM')),
  status       text NOT NULL DEFAULT 'AT_GATE' CHECK (status IN
                 ('AT_GATE','PACK_RUNNING','PACK_PASSED','PACK_FAILED','IN_F9','IN_F9_5',
                  'IN_F10','RELEASED','WITHDRAWN','PROMOTED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON short_sprints.ss_runs (org_id, owner_id);

CREATE TABLE short_sprints.ss_run_delegates (
  run_id       uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  delegate_id  text NOT NULL,
  org_id       uuid NOT NULL,
  owner_id     text NOT NULL,                       -- who granted (the run owner)
  granted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, delegate_id),
  CHECK (delegate_id <> owner_id)
);

CREATE TABLE short_sprints.ss_eligibility (
  result_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id       uuid NOT NULL,
  owner_id     text NOT NULL,
  gate         text NOT NULL CHECK (gate IN ('SC_ONE','SC_TWO')),
  rule_id      text NOT NULL,                       -- e.g. CELL-04, CELL-07
  passed       boolean NOT NULL,
  reason       text NOT NULL,                       -- plain language (SS-ELG-005)
  rule_hash    text NOT NULL CHECK (rule_hash ~ '^[0-9a-f]{64}$'),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, gate, rule_id)
);

CREATE TABLE short_sprints.ss_gate_decisions (
  decision_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id           uuid NOT NULL,
  owner_id         text NOT NULL,                   -- the human who answered
  gate             text NOT NULL CHECK (gate IN ('SC_ONE','SC_TWO')),
  decision         text NOT NULL CHECK (decision IN ('YES','NO','DEFERRED','WITHDRAWN')),
  reason           text NOT NULL CHECK (length(btrim(reason)) > 0),
  eligibility_hash text NOT NULL CHECK (eligibility_hash ~ '^[0-9a-f]{64}$'),
  decided_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE short_sprints.ss_stage_skips (
  skip_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id       uuid NOT NULL,
  owner_id     text NOT NULL,
  stage        text NOT NULL CHECK (stage IN ('F5','F6','F7','F8','F9')),  -- F9.5–F12 never skippable
  circuit      text NOT NULL CHECK (circuit IN ('SC_ONE','SC_TWO')),
  status       text NOT NULL DEFAULT 'SKIPPED_BY_SC' CHECK (status = 'SKIPPED_BY_SC'),
  reason       text NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, stage)
);

CREATE TABLE short_sprints.ss_sass_versions (
  sass_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id           uuid NOT NULL,
  owner_id         text NOT NULL,
  version_no       integer NOT NULL CHECK (version_no >= 1),
  supersedes_id    uuid REFERENCES short_sprints.ss_sass_versions ON DELETE RESTRICT,
  spc_version_hash text NOT NULL CHECK (spc_version_hash ~ '^[0-9a-f]{64}$'),
  content_hash     text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  body             jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object'),   -- the 15 fields
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, version_no),
  UNIQUE (supersedes_id),
  CHECK ((version_no = 1) = (supersedes_id IS NULL))
);

CREATE TABLE short_sprints.ss_pack_results (
  pack_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id            uuid NOT NULL,
  owner_id          text NOT NULL,
  circuit           text NOT NULL CHECK (circuit IN ('SC_ONE','SC_TWO')),
  verdict           text NOT NULL CHECK (verdict IN ('PASS','FAIL','INCONCLUSIVE')),
  min_independence  text NOT NULL CHECK (min_independence IN ('I0','I1','I2','I3')),
  checks            jsonb NOT NULL,
  evidence_hash     text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  sass_id           uuid REFERENCES short_sprints.ss_sass_versions ON DELETE RESTRICT,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  -- XVL-01 / SS-INV-01: self-checks alone (I0) can never produce a PASS.
  CHECK (verdict <> 'PASS' OR min_independence IN ('I1','I2','I3')),
  -- SC TWO packs are tied to the SASS they checked.
  CHECK (circuit <> 'SC_TWO' OR sass_id IS NOT NULL)
);

CREATE TABLE short_sprints.ss_mecha_results (
  mecha_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                 uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id                 uuid NOT NULL,
  owner_id               text NOT NULL,
  verdict                text NOT NULL CHECK (verdict IN ('PASS','FAIL','REFUSED')),
  external_evidence_hash text CHECK (external_evidence_hash ~ '^[0-9a-f]{64}$'),
  recorded_at            timestamptz NOT NULL DEFAULT now(),
  -- SS-INV-03 / MECHA-01: no F9 pass without external evidence.
  CHECK (verdict <> 'PASS' OR external_evidence_hash IS NOT NULL)
);

CREATE TABLE short_sprints.ss_custody_records (
  custody_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id        uuid NOT NULL,
  owner_id      text NOT NULL,
  pack_id       uuid NOT NULL REFERENCES short_sprints.ss_pack_results ON DELETE RESTRICT,
  file_hashes   jsonb NOT NULL CHECK (jsonb_typeof(file_hashes) = 'object'),
  chain_hash    text NOT NULL CHECK (chain_hash ~ '^[0-9a-f]{64}$'),
  signed_by     text NOT NULL,
  sealed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id)
);

CREATE TABLE short_sprints.ss_certificates (
  cert_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id            uuid NOT NULL,
  owner_id          text NOT NULL,
  circuit           text NOT NULL CHECK (circuit IN ('SC_ONE','SC_TWO')),
  conformity_state  text NOT NULL CHECK (conformity_state IN
                      ('SELF_ATTESTED','EVIDENCE_BACKED','INDEPENDENTLY_AUDITED')),
  stages_passed     text[] NOT NULL,
  stages_skipped    text[] NOT NULL,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  -- SS-INV-06: never show a skipped stage as passed.
  CHECK (NOT (stages_passed && stages_skipped)),
  -- SS-INV-04: F9.5 and F10 are always among the stages passed.
  CHECK (stages_passed @> ARRAY['F9.5','F10'])
);

CREATE TABLE short_sprints.ss_promotions (
  promotion_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  org_id          uuid NOT NULL,
  owner_id        text NOT NULL,                  -- SPHINX approver (human)
  reentry_stage   text NOT NULL CHECK (reentry_stage IN ('F5','F6')),
  parent_trace_id uuid NOT NULL,
  new_trace_id    uuid NOT NULL,
  approved_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (new_trace_id <> parent_trace_id)
);

CREATE TABLE short_sprints.ss_audit_events (
  event_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL,
  owner_id    text NOT NULL,
  run_id      uuid REFERENCES short_sprints.ss_runs ON DELETE RESTRICT,
  action      text NOT NULL,
  detail_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------ owner stamping -----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ss_runs','ss_run_delegates','ss_eligibility','ss_gate_decisions',
                           'ss_stage_skips','ss_sass_versions','ss_pack_results',
                           'ss_mecha_results','ss_custody_records','ss_certificates',
                           'ss_promotions','ss_audit_events']
  LOOP
    EXECUTE format('CREATE TRIGGER stamp_owner BEFORE INSERT ON short_sprints.%I
                    FOR EACH ROW EXECUTE FUNCTION app.stamp_owner()', t);
  END LOOP;
END $$;

-- --------------------------------------------------- immutability triggers --
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ss_run_delegates','ss_eligibility','ss_gate_decisions',
                           'ss_stage_skips','ss_sass_versions','ss_pack_results',
                           'ss_mecha_results','ss_custody_records','ss_certificates',
                           'ss_promotions','ss_audit_events']
  LOOP
    EXECUTE format('CREATE TRIGGER immutable_row BEFORE UPDATE OR DELETE ON short_sprints.%I
                    FOR EACH ROW EXECUTE FUNCTION app.reject_mutation()', t);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON short_sprints.%I
                    FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation()', t);
  END LOOP;
END $$;

-- ss_runs: identity frozen; terminal runs frozen; never deleted.
CREATE FUNCTION short_sprints.guard_run_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('RELEASED','WITHDRAWN','PROMOTED') THEN
    RAISE EXCEPTION 'run % is % and cannot change', OLD.run_id, OLD.status
          USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.run_id, NEW.org_id, NEW.owner_id, NEW.project_id, NEW.trace_id,
      NEW.circuit, NEW.target_type, NEW.xvl_profile, NEW.created_at)
     IS DISTINCT FROM
     (OLD.run_id, OLD.org_id, OLD.owner_id, OLD.project_id, OLD.trace_id,
      OLD.circuit, OLD.target_type, OLD.xvl_profile, OLD.created_at) THEN
    RAISE EXCEPTION 'run % : only status may change', OLD.run_id USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER guard_update BEFORE UPDATE ON short_sprints.ss_runs
  FOR EACH ROW EXECUTE FUNCTION short_sprints.guard_run_update();
CREATE TRIGGER no_delete BEFORE DELETE ON short_sprints.ss_runs
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON short_sprints.ss_runs
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();

-- SASS chain: linear, gap-free, no forks.
CREATE FUNCTION short_sprints.check_new_sass() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_latest short_sprints.ss_sass_versions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.run_id::text, 1));
  SELECT * INTO v_latest FROM short_sprints.ss_sass_versions
   WHERE run_id = NEW.run_id ORDER BY version_no DESC LIMIT 1;
  IF v_latest.sass_id IS NULL THEN
    IF NEW.version_no <> 1 OR NEW.supersedes_id IS NOT NULL THEN
      RAISE EXCEPTION 'first SASS for run % must be version 1', NEW.run_id;
    END IF;
  ELSIF NEW.version_no <> v_latest.version_no + 1
        OR NEW.supersedes_id IS DISTINCT FROM v_latest.sass_id THEN
    RAISE EXCEPTION 'run %: new SASS must be version % superseding %',
          NEW.run_id, v_latest.version_no + 1, v_latest.sass_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER check_sass BEFORE INSERT ON short_sprints.ss_sass_versions
  FOR EACH ROW EXECUTE FUNCTION short_sprints.check_new_sass();

-- SS-INV-02 / SS-FR-03: YES only when every eligibility rule for the gate passed,
-- and the gate must match the run's circuit.
CREATE FUNCTION short_sprints.check_gate_decision() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_circuit text;
BEGIN
  SELECT circuit INTO v_circuit FROM short_sprints.ss_runs WHERE run_id = NEW.run_id;
  IF v_circuit IS NULL THEN        -- missing, or hidden from this actor by RLS
    RAISE EXCEPTION 'run % not found or not accessible', NEW.run_id USING ERRCODE = '42501';
  END IF;
  IF v_circuit <> NEW.gate THEN
    RAISE EXCEPTION 'gate % does not match the run''s circuit', NEW.gate;
  END IF;
  IF NEW.decision = 'YES' THEN
    IF NOT EXISTS (SELECT 1 FROM short_sprints.ss_eligibility e
                    WHERE e.run_id = NEW.run_id AND e.gate = NEW.gate) THEN
      RAISE EXCEPTION 'SS-FR-03: no eligibility results recorded for gate %', NEW.gate;
    END IF;
    IF EXISTS (SELECT 1 FROM short_sprints.ss_eligibility e
                WHERE e.run_id = NEW.run_id AND e.gate = NEW.gate AND NOT e.passed) THEN
      RAISE EXCEPTION 'SS-FR-03: YES refused, an eligibility rule failed for gate %', NEW.gate;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER check_decision BEFORE INSERT ON short_sprints.ss_gate_decisions
  FOR EACH ROW EXECUTE FUNCTION short_sprints.check_gate_decision();

-- Promotion re-entry: SC ONE -> F5, SC TWO -> F6 (SS-FR-09).
CREATE FUNCTION short_sprints.check_promotion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_run short_sprints.ss_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM short_sprints.ss_runs WHERE run_id = NEW.run_id;
  IF v_run.run_id IS NULL THEN     -- missing, or hidden from this actor by RLS
    RAISE EXCEPTION 'run % not found or not accessible', NEW.run_id USING ERRCODE = '42501';
  END IF;
  IF (v_run.circuit = 'SC_ONE' AND NEW.reentry_stage <> 'F5')
     OR (v_run.circuit = 'SC_TWO' AND NEW.reentry_stage <> 'F6') THEN
    RAISE EXCEPTION 'promotion re-entry must be F5 from SC_ONE or F6 from SC_TWO';
  END IF;
  IF NEW.parent_trace_id <> v_run.trace_id THEN
    RAISE EXCEPTION 'parent_trace_id must be the run''s trace_id';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER check_promotion BEFORE INSERT ON short_sprints.ss_promotions
  FOR EACH ROW EXECUTE FUNCTION short_sprints.check_promotion();

-- ------------------------------------------- policy helper (no recursion) ---
-- True when the current actor owns the run or is an active delegate of it.
CREATE FUNCTION short_sprints.actor_can_act_on_run(p_run uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM short_sprints.ss_runs r
     WHERE r.run_id = p_run
       AND r.org_id = app.org_id()
       AND (r.owner_id = app.actor_id()
            OR EXISTS (SELECT 1 FROM short_sprints.ss_run_delegates d
                        WHERE d.run_id = r.run_id
                          AND d.delegate_id = app.actor_id())))
$$;
-- Runs as ark_owner through the org-scoped owner_lookup policies below.
REVOKE EXECUTE ON FUNCTION short_sprints.actor_can_act_on_run(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION short_sprints.actor_can_act_on_run(uuid) TO ark_app;

-- ------------------------------------------------ forced row-level security -
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ss_runs','ss_run_delegates','ss_eligibility','ss_gate_decisions',
                           'ss_stage_skips','ss_sass_versions','ss_pack_results',
                           'ss_mecha_results','ss_custody_records','ss_certificates',
                           'ss_promotions','ss_audit_events']
  LOOP
    EXECUTE format('ALTER TABLE short_sprints.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE short_sprints.%I FORCE  ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ------------------------------------------------- owner-isolation policies -
-- Lookup policies for the SECURITY DEFINER helper (runs as ark_owner).
CREATE POLICY owner_lookup ON short_sprints.ss_runs FOR SELECT TO ark_owner
  USING (org_id = app.org_id());
CREATE POLICY owner_lookup ON short_sprints.ss_run_delegates FOR SELECT TO ark_owner
  USING (org_id = app.org_id());

-- Runs: owner or delegate reads; only the owner creates or updates.
-- (owner checked inline so INSERT ... RETURNING sees the new row)
CREATE POLICY owner_select ON short_sprints.ss_runs FOR SELECT TO ark_app
  USING (org_id = app.org_id()
         AND (owner_id = app.actor_id() OR short_sprints.actor_can_act_on_run(run_id)));
CREATE POLICY owner_insert ON short_sprints.ss_runs FOR INSERT TO ark_app
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id());
CREATE POLICY owner_update ON short_sprints.ss_runs FOR UPDATE TO ark_app
  USING      (org_id = app.org_id() AND owner_id = app.actor_id())
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id());

-- Delegates: only the run owner grants; owner and delegate can see the grant.
CREATE POLICY owner_select ON short_sprints.ss_run_delegates FOR SELECT TO ark_app
  USING (org_id = app.org_id()
         AND (owner_id = app.actor_id() OR delegate_id = app.actor_id()));
CREATE POLICY owner_insert ON short_sprints.ss_run_delegates FOR INSERT TO ark_app
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
              AND EXISTS (SELECT 1 FROM short_sprints.ss_runs r
                           WHERE r.run_id = ss_run_delegates.run_id
                             AND r.owner_id = app.actor_id()));

-- Every child record: visible to anyone who can act on the run; written only
-- by that person, stamped with their own id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ss_eligibility','ss_gate_decisions','ss_stage_skips',
                           'ss_sass_versions','ss_pack_results','ss_mecha_results',
                           'ss_custody_records','ss_certificates','ss_promotions',
                           'ss_audit_events']
  LOOP
    EXECUTE format($p$
      CREATE POLICY owner_select ON short_sprints.%1$I FOR SELECT TO ark_app
        USING (org_id = app.org_id()
               AND (owner_id = app.actor_id()
                    OR (run_id IS NOT NULL AND short_sprints.actor_can_act_on_run(run_id))))$p$, t);
    EXECUTE format($p$
      CREATE POLICY owner_insert ON short_sprints.%1$I FOR INSERT TO ark_app
        WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
                    AND (run_id IS NULL OR short_sprints.actor_can_act_on_run(run_id)))$p$, t);
  END LOOP;
END $$;

-- Promotions additionally need the SPHINX approver role (SS-PRM-001).
ALTER POLICY owner_insert ON short_sprints.ss_promotions
  WITH CHECK (org_id = app.org_id() AND owner_id = app.actor_id()
              AND app.has_role('sphinx_approver')
              AND short_sprints.actor_can_act_on_run(run_id));

-- ----------------------------------------------------- restricted grants ----
REVOKE ALL ON ALL TABLES IN SCHEMA short_sprints FROM PUBLIC;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA short_sprints TO ark_app;
GRANT UPDATE (status) ON short_sprints.ss_runs TO ark_app;
-- No DELETE, TRUNCATE, REFERENCES or TRIGGER privilege on any table.

RESET ROLE;

-- -----------------------------------------------------------------------------
-- NOT ENFORCED HERE (by design; application layer, SS-RTE-001..005):
--   the route order AT_GATE -> PACK_PASSED -> [IN_F9 if FIRMWARE] -> IN_F9_5
--   -> IN_F10 -> RELEASED. A status trigger that checks ss_pack_results,
--   ss_mecha_results and ss_custody_records before each move is the natural
--   next step; it is left out so the route graph has one owner (MATHMON).
-- -----------------------------------------------------------------------------
