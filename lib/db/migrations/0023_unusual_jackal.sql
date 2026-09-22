CREATE TYPE "public"."f10_attempt_state" AS ENUM('CLAIMED', 'SUCCEEDED', 'RETRYABLE', 'PERMANENT', 'FENCED');--> statement-breakpoint
CREATE TYPE "public"."f10_release_state" AS ENUM('REQUESTED', 'VERIFYING', 'AUTHORIZED', 'QUEUED', 'DISPATCHING', 'ACKNOWLEDGED', 'BLOCKED', 'FAILED_PERMANENT', 'DEAD_LETTERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."f10_verdict" AS ENUM('PASS', 'THRESHOLD_PASS', 'MATH_VERIFIED', 'FIT', 'CLUSTER', 'FAIL');--> statement-breakpoint
CREATE TABLE "f10_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"fence_token" text NOT NULL,
	"state" "f10_attempt_state" DEFAULT 'CLAIMED' NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"result_class" text,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"adapter_id" text NOT NULL,
	"adapter_version" text NOT NULL,
	"endpoint" text NOT NULL,
	"secret_ref" text NOT NULL,
	"authorization_scopes" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_dlq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"attempts" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"destination_identity" text NOT NULL,
	"adapter_id" text NOT NULL,
	"adapter_version" text NOT NULL,
	"attempt" integer NOT NULL,
	"downstream_receipt_id" text,
	"policy_hash" text NOT NULL,
	"receipt_signature" text NOT NULL,
	"receipt_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_release_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"machine_artifact_id" text NOT NULL,
	"mecha_run_id" text NOT NULL,
	"spk_id" text NOT NULL,
	"artifact_version" text NOT NULL,
	"media_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"artifact_signature" text NOT NULL,
	"custody_attestation" jsonb NOT NULL,
	"destination_ref" text NOT NULL,
	"destination_identity" text NOT NULL,
	"policy_version" text NOT NULL,
	"policy_hash" text NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"state" "f10_release_state" DEFAULT 'REQUESTED' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f10_release_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"actor_id" uuid,
	"attempt_token" text,
	"reason" text NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f10_attempts" ADD CONSTRAINT "f10_attempts_release_id_f10_release_requests_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."f10_release_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_dlq" ADD CONSTRAINT "f10_dlq_release_id_f10_release_requests_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."f10_release_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_receipts" ADD CONSTRAINT "f10_receipts_release_id_f10_release_requests_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."f10_release_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_release_requests" ADD CONSTRAINT "f10_release_requests_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_release_transitions" ADD CONSTRAINT "f10_release_transitions_release_id_f10_release_requests_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."f10_release_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "f10_attempt_fence_uniq" ON "f10_attempts" USING btree ("release_id","fence_token");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_attempt_number_uniq" ON "f10_attempts" USING btree ("release_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_destination_tenant_name_uniq" ON "f10_destinations" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_dlq_release_uniq" ON "f10_dlq" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_receipt_release_uniq" ON "f10_receipts" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_release_idempotency_uniq" ON "f10_release_requests" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "f10_release_tenant_idx" ON "f10_release_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "f10_release_transition_release_idx" ON "f10_release_transitions" USING btree ("release_id");