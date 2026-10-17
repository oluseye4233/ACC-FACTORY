CREATE TABLE "artifact_operation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"action" text NOT NULL,
	"revision" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_operation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "imprima_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"format" text NOT NULL,
	"variant" text NOT NULL,
	"filename" text NOT NULL,
	"object_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"file_hash" text NOT NULL,
	"size" integer NOT NULL,
	"validation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imprima_files_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "imprima_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "imprima_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"source_object_key" text NOT NULL,
	"version" integer NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'QUEUED' NOT NULL,
	"config" jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imprima_revision_positive" CHECK ("imprima_jobs"."revision" >= 0 AND "imprima_jobs"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "imprima_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "short_sprint_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"circuit" text NOT NULL,
	"target" text NOT NULL,
	"profile" text NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"source_object_key" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'PROPOSED' NOT NULL,
	"active_route" integer DEFAULT 0 NOT NULL,
	"config" jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_sprint_active_route_boolean" CHECK ("short_sprint_runs"."active_route" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "short_sprint_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_verifier_authorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registered_by" uuid NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"mechanism" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"governance_note" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_verifier_authorities_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
ALTER TABLE "sprint_verifier_authorities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifact_operation_events" ADD CONSTRAINT "artifact_operation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_operation_events" ADD CONSTRAINT "artifact_operation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imprima_files" ADD CONSTRAINT "imprima_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imprima_files" ADD CONSTRAINT "imprima_files_job_id_imprima_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."imprima_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imprima_jobs" ADD CONSTRAINT "imprima_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imprima_jobs" ADD CONSTRAINT "imprima_jobs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_sprint_runs" ADD CONSTRAINT "short_sprint_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_sprint_runs" ADD CONSTRAINT "short_sprint_runs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_verifier_authorities" ADD CONSTRAINT "sprint_verifier_authorities_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_operation_events_workflow_idx" ON "artifact_operation_events" USING btree ("workflow_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "imprima_job_format_variant_unique" ON "imprima_files" USING btree ("job_id","format","variant");--> statement-breakpoint
CREATE UNIQUE INDEX "imprima_source_version_unique" ON "imprima_jobs" USING btree ("user_id","source_kind","source_id","version");--> statement-breakpoint
CREATE INDEX "imprima_owner_created_idx" ON "imprima_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "short_sprint_active_route_unique" ON "short_sprint_runs" USING btree ("session_id") WHERE "short_sprint_runs"."active_route" = 1;--> statement-breakpoint
CREATE INDEX "short_sprint_owner_session_idx" ON "short_sprint_runs" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE POLICY "artifact_operation_events_owner" ON "artifact_operation_events" AS PERMISSIVE FOR ALL TO public USING ("artifact_operation_events"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("artifact_operation_events"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "imprima_files_owner" ON "imprima_files" AS PERMISSIVE FOR ALL TO public USING ("imprima_files"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("imprima_files"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "imprima_jobs_owner" ON "imprima_jobs" AS PERMISSIVE FOR ALL TO public USING ("imprima_jobs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("imprima_jobs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "short_sprint_runs_owner" ON "short_sprint_runs" AS PERMISSIVE FOR ALL TO public USING ("short_sprint_runs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true') WITH CHECK ("short_sprint_runs"."user_id" = nullif(current_setting('app.operations_actor', true), '')::uuid OR current_setting('app.operations_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "sprint_verifiers_read" ON "sprint_verifier_authorities" AS PERMISSIVE FOR SELECT TO public USING (nullif(current_setting('app.operations_actor', true), '')::uuid IS NOT NULL);--> statement-breakpoint
CREATE POLICY "sprint_verifiers_admin_insert" ON "sprint_verifier_authorities" AS PERMISSIVE FOR INSERT TO public WITH CHECK (current_setting('app.operations_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "sprint_verifiers_admin_update" ON "sprint_verifier_authorities" AS PERMISSIVE FOR UPDATE TO public USING (current_setting('app.operations_admin', true) = 'true') WITH CHECK (current_setting('app.operations_admin', true) = 'true');
--> statement-breakpoint
ALTER TABLE "imprima_jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "imprima_files" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "short_sprint_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artifact_operation_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sprint_verifier_authorities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations') THEN
    CREATE ROLE atanda_artifact_operations NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atanda_artifact_operations'
    AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'Operations role must be a non-login, non-superuser, non-bypass role';
  END IF;
END $$;
--> statement-breakpoint
GRANT atanda_artifact_operations TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO atanda_artifact_operations;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON imprima_jobs, imprima_files, short_sprint_runs, artifact_operation_events, sprint_verifier_authorities TO atanda_artifact_operations;
--> statement-breakpoint
GRANT SELECT ON harness_artifacts TO atanda_artifact_operations;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON harness_feature_state TO atanda_artifact_operations;
--> statement-breakpoint
GRANT SELECT, INSERT ON command_deck_traces TO atanda_artifact_operations;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON vte_verification_failures TO atanda_artifact_operations;