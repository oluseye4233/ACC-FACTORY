CREATE TABLE "f0_monitoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retainer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"breached" boolean DEFAULT false NOT NULL,
	"highest_urgency" text,
	"notified_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "retainer_alerts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "f0_monitoring_runs" ADD CONSTRAINT "f0_monitoring_runs_retainer_id_f0_retainers_id_fk" FOREIGN KEY ("retainer_id") REFERENCES "public"."f0_retainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_monitoring_runs" ADD CONSTRAINT "f0_monitoring_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "f0_monitoring_runs_retainer_id_idx" ON "f0_monitoring_runs" USING btree ("retainer_id");--> statement-breakpoint
CREATE INDEX "f0_monitoring_runs_user_id_idx" ON "f0_monitoring_runs" USING btree ("user_id");