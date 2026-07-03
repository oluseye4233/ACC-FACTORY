CREATE TABLE "cost_cap_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"threshold_percent" integer NOT NULL,
	"used_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"cap_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cost_cap_notifications_month_threshold_idx" ON "cost_cap_notifications" USING btree ("month","threshold_percent");