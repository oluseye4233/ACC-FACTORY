CREATE TYPE "public"."f9_run_status" AS ENUM('RUNNING', 'EMITTED', 'REFUSED');--> statement-breakpoint
CREATE TABLE "f9_mecha_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mecha_run_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"status" "f9_run_status" DEFAULT 'RUNNING' NOT NULL,
	"device_class" text NOT NULL,
	"artifact_version" text DEFAULT '1.0.0' NOT NULL,
	"phase" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"refusal" jsonb,
	"payload_hash" text,
	"artifact_signature" text,
	"artifact_content" jsonb,
	"osiris_custody" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "f9_mecha_runs_mecha_run_id_unique" UNIQUE("mecha_run_id")
);
--> statement-breakpoint
ALTER TABLE "f9_mecha_runs" ADD CONSTRAINT "f9_mecha_runs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f9_mecha_runs" ADD CONSTRAINT "f9_mecha_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f9_mecha_runs" ADD CONSTRAINT "f9_mecha_runs_source_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "f9_mecha_runs_session_idx" ON "f9_mecha_runs" USING btree ("session_id","created_at");