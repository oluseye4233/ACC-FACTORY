CREATE TYPE "public"."f11_host_source" AS ENUM('F8_BUNDLE', 'F10_HANDOFF', 'CHAT_ONLY');--> statement-breakpoint
CREATE TYPE "public"."f11_host_state" AS ENUM('H4_STAGE_REQUESTED', 'H4_STAGED', 'H5_VERIFIED', 'H6_CERTIFIED', 'H7_PROMOTED', 'H8_HANDED_OFF', 'ROLLED_BACK', 'REFUSED');--> statement-breakpoint
CREATE TABLE "f11_host_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"event_type" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f11_host_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"plan_artifact_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"source" "f11_host_source" NOT NULL,
	"provider" text NOT NULL,
	"adapter_id" text NOT NULL,
	"adapter_version" text NOT NULL,
	"account_ref" text NOT NULL,
	"region" text NOT NULL,
	"exact_content_hash" text NOT NULL,
	"deployment_subject" text NOT NULL,
	"cost_ceiling_cents" integer NOT NULL,
	"stage_consent_id" uuid NOT NULL,
	"stage_write_hash" text NOT NULL,
	"stage_vault_ref" text NOT NULL,
	"rollback_plan" text NOT NULL,
	"human_attestations" jsonb NOT NULL,
	"state" "f11_host_state" DEFAULT 'H4_STAGE_REQUESTED' NOT NULL,
	"provider_operation_ref" text,
	"stage_evidence" jsonb,
	"ucg_host_evidence" jsonb,
	"promotion_consent_id" uuid,
	"promotion_write_hash" text,
	"promotion_vault_ref" text,
	"promotion_subject" text,
	"monitoring_ref" text,
	"host_receipt" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f11_host_events" ADD CONSTRAINT "f11_host_events_host_run_id_f11_host_runs_id_fk" FOREIGN KEY ("host_run_id") REFERENCES "public"."f11_host_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f11_host_events" ADD CONSTRAINT "f11_host_events_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f11_host_events" ADD CONSTRAINT "f11_host_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f11_host_runs" ADD CONSTRAINT "f11_host_runs_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f11_host_runs" ADD CONSTRAINT "f11_host_runs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f11_host_runs" ADD CONSTRAINT "f11_host_runs_plan_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("plan_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f11_host_runs" ADD CONSTRAINT "f11_host_runs_source_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "f11_host_event_run_idx" ON "f11_host_events" USING btree ("host_run_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "f11_host_stage_consent_unique" ON "f11_host_runs" USING btree ("stage_consent_id");--> statement-breakpoint
CREATE INDEX "f11_host_tenant_idx" ON "f11_host_runs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "f11_host_session_idx" ON "f11_host_runs" USING btree ("session_id","created_at");