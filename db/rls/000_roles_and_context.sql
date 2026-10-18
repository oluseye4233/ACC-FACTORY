-- =============================================================================
-- 000_roles_and_context.sql
-- ARK Harness · IMPRIMA + SHORT SPRINTS · shared security foundation
--
-- Creates:
--   ark_owner      NOLOGIN  owns schemas, tables, triggers (migrations run as this)
--   ark_app        NOLOGIN  the RESTRICTED application role (no BYPASSRLS, no DDL,
--                           no DELETE, no TRUNCATE anywhere)
--   ark_app_login  LOGIN    what the API connects as; inherits ark_app, cannot SET ROLE
--
-- No role in this design holds BYPASSRLS or SUPERUSER. The two SECURITY DEFINER
-- lookup functions that policies call are owned by ark_owner and read through
-- org-scoped lookup policies (v1.1, for Replit: no BYPASSRLS role is needed).
--
-- Runs as a superuser OR as a non-superuser with CREATEROLE (for example the
-- Replit DATABASE_URL owner): the migrator grants itself SET on ark_owner.
--
-- Request context (set by the API at the start of EVERY transaction):
--   SELECT set_config('app.org_id',     '<org uuid>',       true);
--   SELECT set_config('app.user_id',    '<Clerk user id>',  true);
--   SELECT set_config('app.user_roles', 'publisher,approver', true);
-- `true` = transaction-local, so a pooled connection never leaks identity.
-- If any value is missing the helpers return NULL and every policy fails closed.
--
-- Status: Tier 0 design artifact. Tested on PostgreSQL 16 in a scratch cluster
-- only; not deployed, not independently reviewed.
-- =============================================================================


-- ---------------------------------------------------------------- roles -----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ark_owner') THEN
    CREATE ROLE ark_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ark_app') THEN
    CREATE ROLE ark_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
                        NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ark_app_login') THEN
    -- Password is set out of band from Key Vault:
    --   ALTER ROLE ark_app_login PASSWORD '<from Key Vault>';
    CREATE ROLE ark_app_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
                              NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 50;
  END IF;
END $$;

-- The migrator must be able to SET ROLE ark_owner (PG16 gives a CREATEROLE
-- creator ADMIN only). Harmless when the migrator is a superuser.
GRANT ark_owner TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
DO $$ BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO ark_owner', current_database());
END $$;

-- Login role inherits ark_app's privileges but may not SET ROLE to it (PG16+).
GRANT ark_app TO ark_app_login WITH INHERIT TRUE, SET FALSE;

-- Session guard rails for the login role.
ALTER ROLE ark_app_login SET statement_timeout = '30s';
ALTER ROLE ark_app_login SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE ark_app_login SET search_path = pg_catalog;   -- always schema-qualify

-- Nobody but the owner creates objects in public (already the PG15+ default;
-- a WARNING, not an error, if the migrator does not own public).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ------------------------------------------------------- context schema -----
SET ROLE ark_owner;

CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO ark_app;

-- Current organisation (tenant). NULL when unset -> policies fail closed.
CREATE OR REPLACE FUNCTION app.org_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid
$$;

-- Current human actor (Clerk user id). NULL when unset.
CREATE OR REPLACE FUNCTION app.actor_id() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

-- Role claim check, e.g. app.has_role('approver').
CREATE OR REPLACE FUNCTION app.has_role(p_role text) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT p_role = ANY (string_to_array(
           COALESCE(NULLIF(current_setting('app.user_roles', true), ''), ''), ','))
$$;

-- Generic immutability guard: any UPDATE, DELETE or TRUNCATE is refused.
CREATE OR REPLACE FUNCTION app.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%.% is immutable: % refused (append-only record)',
        TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'P0001', HINT = 'Insert a new version instead.';
END $$;

-- Stamp org/actor from context if the caller left them NULL; refuse mismatch.
CREATE OR REPLACE FUNCTION app.stamp_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF app.org_id() IS NULL OR app.actor_id() IS NULL THEN
    RAISE EXCEPTION 'request context missing (app.org_id / app.user_id)'
          USING ERRCODE = '42501';
  END IF;
  NEW.org_id   := COALESCE(NEW.org_id,   app.org_id());
  NEW.owner_id := COALESCE(NEW.owner_id, app.actor_id());
  RETURN NEW;
END $$;

GRANT EXECUTE ON FUNCTION app.org_id(), app.actor_id(), app.has_role(text) TO ark_app;
REVOKE EXECUTE ON FUNCTION app.reject_mutation(), app.stamp_owner() FROM PUBLIC;

RESET ROLE;
