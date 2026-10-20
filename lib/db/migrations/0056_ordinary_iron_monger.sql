CREATE TABLE "recovery_alert_deliveries" (
	"episode_id" uuid NOT NULL,
	"recipient_hash" text NOT NULL,
	"claim_token" uuid NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "recovery_alert_deliveries_episode_id_recipient_hash_pk" PRIMARY KEY("episode_id","recipient_hash")
);
--> statement-breakpoint
CREATE TABLE "recovery_failures" (
	"kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"scope_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"failures" integer NOT NULL,
	"last_bucket" bigint NOT NULL,
	"first_failed_at" timestamp with time zone NOT NULL,
	"last_failed_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "recovery_failures_kind_resource_id_scope_id_pk" PRIMARY KEY("kind","resource_id","scope_id")
);
--> statement-breakpoint
CREATE INDEX "recovery_failures_pending_idx" ON "recovery_failures" USING btree ("resolved_at","last_failed_at");