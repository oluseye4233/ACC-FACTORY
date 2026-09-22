ALTER TABLE "f10_provider_connections" ADD COLUMN "authorization_key_version" text;--> statement-breakpoint
ALTER TABLE "f10_provider_connections" ADD COLUMN "reconnect_required_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "f10_provider_connections" ADD COLUMN "reconnect_reason" text;