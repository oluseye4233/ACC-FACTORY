CREATE TYPE "public"."f10_deployment_attempt_state" AS ENUM('CLAIMED', 'ACKNOWLEDGED', 'RETRYABLE', 'PERMANENT', 'FENCED');--> statement-breakpoint
CREATE TYPE "public"."f10_deployment_state" AS ENUM('REQUESTED', 'QUEUED', 'DISPATCHING', 'ACKNOWLEDGED', 'BLOCKED', 'FAILED_PERMANENT', 'DEAD_LETTERED');--> statement-breakpoint
CREATE TYPE "public"."f10_provider" AS ENUM('AWS', 'AZURE', 'OPENAI_AGENTS', 'GEMINI_AGENTS');--> statement-breakpoint
CREATE TABLE "f10_bundle_deployment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"fence_token" text NOT NULL,
	"state" "f10_deployment_attempt_state" DEFAULT 'CLAIMED' NOT NULL,
	"result_class" text,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_bundle_deployment_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_state" text,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_bundle_deployment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"bundle_hash" text NOT NULL,
	"provider" "f10_provider" NOT NULL,
	"target" text NOT NULL,
	"accepted" boolean NOT NULL,
	"provider_receipt_id" text,
	"receipt_signature" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_bundle_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"provider" "f10_provider" NOT NULL,
	"target" text NOT NULL,
	"connection_ref" uuid NOT NULL,
	"output_kind" text NOT NULL,
	"bundle_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"state" "f10_deployment_state" DEFAULT 'REQUESTED' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "f10_provider" NOT NULL,
	"name" text NOT NULL,
	"authorization_ref" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f10_bundle_deployment_attempts" ADD CONSTRAINT "f10_bundle_deployment_attempts_deployment_id_f10_bundle_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."f10_bundle_deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployment_audit" ADD CONSTRAINT "f10_bundle_deployment_audit_deployment_id_f10_bundle_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."f10_bundle_deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployment_receipts" ADD CONSTRAINT "f10_bundle_deployment_receipts_deployment_id_f10_bundle_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."f10_bundle_deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD CONSTRAINT "f10_bundle_deployments_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD CONSTRAINT "f10_bundle_deployments_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD CONSTRAINT "f10_bundle_deployments_connection_ref_f10_provider_connections_id_fk" FOREIGN KEY ("connection_ref") REFERENCES "public"."f10_provider_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_provider_connections" ADD CONSTRAINT "f10_provider_connections_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "f10_bundle_attempt_fence_uniq" ON "f10_bundle_deployment_attempts" USING btree ("deployment_id","fence_token");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_bundle_attempt_number_uniq" ON "f10_bundle_deployment_attempts" USING btree ("deployment_id","attempt");--> statement-breakpoint
CREATE INDEX "f10_bundle_audit_deployment_idx" ON "f10_bundle_deployment_audit" USING btree ("deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_bundle_receipt_deployment_uniq" ON "f10_bundle_deployment_receipts" USING btree ("deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_bundle_deployment_idem_uniq" ON "f10_bundle_deployments" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "f10_bundle_deployment_tenant_idx" ON "f10_bundle_deployments" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_provider_connection_name_uniq" ON "f10_provider_connections" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "f10_provider_connection_tenant_idx" ON "f10_provider_connections" USING btree ("tenant_id");