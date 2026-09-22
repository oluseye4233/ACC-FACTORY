CREATE TABLE "cron_tick_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"ticked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cron_tick_events_target_ticked_at_idx" ON "cron_tick_events" USING btree ("target","ticked_at");