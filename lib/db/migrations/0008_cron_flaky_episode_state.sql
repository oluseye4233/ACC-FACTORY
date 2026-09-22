CREATE TABLE "cron_flaky_episode_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"episode_key" text NOT NULL,
	"shortfall_checks" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cron_flaky_episode_state_target_idx" ON "cron_flaky_episode_state" USING btree ("target");