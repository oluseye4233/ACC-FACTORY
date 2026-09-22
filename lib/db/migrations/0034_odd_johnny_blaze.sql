CREATE TYPE "public"."f10_colonization_phase" AS ENUM('C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8');--> statement-breakpoint
CREATE TYPE "public"."f10_colonization_state" AS ENUM('RUNNING', 'REFUSED', 'STAGED_ONLY', 'PROMOTED');--> statement-breakpoint
CREATE TABLE "f10_colonization_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"request_class" text NOT NULL,
	"artifact_ref" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"artifact_class" text NOT NULL,
	"ucg_certificate_ref" text NOT NULL,
	"target" text NOT NULL,
	"target_class" text NOT NULL,
	"connector_adapter" text NOT NULL,
	"customization_set" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"f9_attestation_ref" text,
	"consent_channel" text NOT NULL,
	"state" "f10_colonization_state" DEFAULT 'RUNNING' NOT NULL,
	"phase" "f10_colonization_phase" DEFAULT 'C0' NOT NULL,
	"max_reachable_phase" "f10_colonization_phase" DEFAULT 'C8' NOT NULL,
	"gro_mode" text DEFAULT 'SAFE_LIFE' NOT NULL,
	"phase_statuses" jsonb NOT NULL,
	"adapter_readiness" jsonb NOT NULL,
	"refusal" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD CONSTRAINT "f10_colonization_runs_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD CONSTRAINT "f10_colonization_runs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "f10_colonization_run_id_uniq" ON "f10_colonization_runs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "f10_colonization_tenant_idx" ON "f10_colonization_runs" USING btree ("tenant_id");