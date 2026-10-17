CREATE TABLE "code_bundle_verification_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"evidence_kind" text NOT NULL,
	"run_reference" text NOT NULL,
	"command" text NOT NULL,
	"summary" text NOT NULL,
	"evidence_payload" jsonb,
	"evidence_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "parent_artifact_id" uuid;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "verification_status" text DEFAULT 'UNVERIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "verification_evidence_hash" text;--> statement-breakpoint
ALTER TABLE "code_bundle_verification_evidence" ADD CONSTRAINT "code_bundle_verification_evidence_source_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_bundle_verification_evidence" ADD CONSTRAINT "code_bundle_verification_evidence_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_bundle_verification_evidence" ADD CONSTRAINT "code_bundle_verification_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;