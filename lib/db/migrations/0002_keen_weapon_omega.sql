CREATE TABLE "f0_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled Engagement' NOT NULL,
	"status" text DEFAULT 'DISCOVERY' NOT NULL,
	"session_id" uuid,
	"artifact_id" uuid,
	"discovery_transcript" jsonb,
	"challenge_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f0_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"service" text NOT NULL,
	"report_code" text NOT NULL,
	"sku" text,
	"content" jsonb NOT NULL,
	"accrued_cost_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f0_retainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'F0 Retainer' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "f0_retainer_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retainer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"stage" text,
	"est_cost_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f0_engagements" ADD CONSTRAINT "f0_engagements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_engagements" ADD CONSTRAINT "f0_engagements_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_engagements" ADD CONSTRAINT "f0_engagements_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_reports" ADD CONSTRAINT "f0_reports_engagement_id_f0_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."f0_engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_reports" ADD CONSTRAINT "f0_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_retainers" ADD CONSTRAINT "f0_retainers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_retainers" ADD CONSTRAINT "f0_retainers_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_retainer_tasks" ADD CONSTRAINT "f0_retainer_tasks_retainer_id_f0_retainers_id_fk" FOREIGN KEY ("retainer_id") REFERENCES "public"."f0_retainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_retainer_tasks" ADD CONSTRAINT "f0_retainer_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "f0_engagements_user_id_idx" ON "f0_engagements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "f0_engagements_session_id_idx" ON "f0_engagements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "f0_reports_engagement_id_idx" ON "f0_reports" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "f0_reports_user_id_idx" ON "f0_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "f0_retainers_user_id_idx" ON "f0_retainers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "f0_retainer_tasks_retainer_id_idx" ON "f0_retainer_tasks" USING btree ("retainer_id");