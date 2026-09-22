ALTER TABLE "f10_bundle_deployments" ADD COLUMN "execution_status" text DEFAULT 'NOT_CONFIRMED' NOT NULL;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD COLUMN "execution_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD COLUMN "provider_execution_updated_at" timestamp with time zone;