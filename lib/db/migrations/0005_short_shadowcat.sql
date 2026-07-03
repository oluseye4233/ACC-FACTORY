CREATE TABLE "cron_stale_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"stale_since_key" text NOT NULL,
	"overdue_minutes" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_tick_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_tick_at" timestamp with time zone,
	"tick_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cron_stale_notifications_target_episode_idx" ON "cron_stale_notifications" USING btree ("target","stale_since_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cron_tick_status_target_idx" ON "cron_tick_status" USING btree ("target");