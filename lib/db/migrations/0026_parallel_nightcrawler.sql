CREATE TABLE "f10_github_pushes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"result" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f10_github_pushes" ADD CONSTRAINT "f10_github_pushes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_github_pushes" ADD CONSTRAINT "f10_github_pushes_source_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "f10_github_pushes_user_idempotency_uniq" ON "f10_github_pushes" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "f10_github_pushes_source_idx" ON "f10_github_pushes" USING btree ("source_artifact_id");