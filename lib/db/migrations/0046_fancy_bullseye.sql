CREATE TABLE "xvl_evalsets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"title" text NOT NULL,
	"rules" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xvl_verification_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"evalset_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"track" text NOT NULL,
	"adapter_id" text NOT NULL,
	"adapter_version" text NOT NULL,
	"independence" text NOT NULL,
	"outcome" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"evalset_hash" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vte_verification_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"rejected_output_origin" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vte_verification_failures_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "xvl_evalsets" ADD CONSTRAINT "xvl_evalsets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xvl_evalsets" ADD CONSTRAINT "xvl_evalsets_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xvl_verification_runs" ADD CONSTRAINT "xvl_verification_runs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xvl_verification_runs" ADD CONSTRAINT "xvl_verification_runs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xvl_verification_runs" ADD CONSTRAINT "xvl_verification_runs_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xvl_verification_runs" ADD CONSTRAINT "xvl_verification_runs_evalset_id_xvl_evalsets_id_fk" FOREIGN KEY ("evalset_id") REFERENCES "public"."xvl_evalsets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vte_verification_failures" ADD CONSTRAINT "vte_verification_failures_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vte_verification_failures" ADD CONSTRAINT "vte_verification_failures_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vte_verification_failures" ADD CONSTRAINT "vte_verification_failures_run_id_xvl_verification_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."xvl_verification_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "xvl_evalsets_owner_session_idx" ON "xvl_evalsets" USING btree ("owner_user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xvl_runs_replay_idx" ON "xvl_verification_runs" USING btree ("artifact_id","evalset_id","adapter_id","adapter_version");--> statement-breakpoint
CREATE INDEX "xvl_runs_owner_session_idx" ON "xvl_verification_runs" USING btree ("owner_user_id","session_id");--> statement-breakpoint
CREATE INDEX "vte_failures_owner_session_idx" ON "vte_verification_failures" USING btree ("owner_user_id","session_id");