CREATE TABLE "created_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"state" text DEFAULT 'RUNNING' NOT NULL,
	"input" text NOT NULL,
	"output" text,
	"disclosure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "created_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"companion_artifact_id" uuid,
	"artifact_id" uuid,
	"request_key" uuid NOT NULL,
	"state" text DEFAULT 'BUILDING' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"state" text DEFAULT 'PENDING_EMAIL' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone,
	"download_issued_at" timestamp with time zone,
	"control_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_publications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"format" text NOT NULL,
	"state" text DEFAULT 'PREPARING' NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"editorial" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "created_agent_runs" ADD CONSTRAINT "created_agent_runs_agent_id_created_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."created_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "created_agent_runs" ADD CONSTRAINT "created_agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "created_agents" ADD CONSTRAINT "created_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "created_agents" ADD CONSTRAINT "created_agents_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "created_agents" ADD CONSTRAINT "created_agents_source_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "created_agents" ADD CONSTRAINT "created_agents_companion_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("companion_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "created_agents" ADD CONSTRAINT "created_agents_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_challenges" ADD CONSTRAINT "portal_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_challenges" ADD CONSTRAINT "portal_challenges_publication_id_portal_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."portal_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_publications" ADD CONSTRAINT "portal_publications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "created_agent_runs_owner_request" ON "created_agent_runs" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE INDEX "created_agent_runs_agent" ON "created_agent_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "created_agents_owner_request" ON "created_agents" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE INDEX "created_agents_owner" ON "created_agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portal_challenges_owner_time" ON "portal_challenges" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "portal_publications_owner" ON "portal_publications" USING btree ("user_id");