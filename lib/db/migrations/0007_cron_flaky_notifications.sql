CREATE TABLE "cron_flaky_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"flaky_since_key" text NOT NULL,
	"expected_ticks" integer DEFAULT 0 NOT NULL,
	"observed_ticks" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cron_flaky_notifications_target_episode_idx" ON "cron_flaky_notifications" USING btree ("target","flaky_since_key");