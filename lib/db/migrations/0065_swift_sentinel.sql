CREATE TABLE "jev_shadow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"kind" text NOT NULL,
	"feature_id" integer NOT NULL,
	"status" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"result" jsonb,
	"model_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jev_shadow_runs" ADD CONSTRAINT "jev_shadow_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jev_shadow_runs" ADD CONSTRAINT "jev_shadow_runs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jev_shadow_runs_user_request_idx" ON "jev_shadow_runs" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE INDEX "jev_shadow_runs_session_idx" ON "jev_shadow_runs" USING btree ("user_id","session_id","kind","feature_id");