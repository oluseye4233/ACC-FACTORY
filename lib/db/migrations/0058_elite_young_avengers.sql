CREATE TABLE "f8_remediation_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"phase" text DEFAULT 'READY' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f8_remediation_attempts" ADD CONSTRAINT "f8_remediation_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f8_remediation_attempts" ADD CONSTRAINT "f8_remediation_attempts_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;