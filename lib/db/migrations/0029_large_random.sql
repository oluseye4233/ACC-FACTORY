ALTER TABLE "f10_bundle_deployments" ADD COLUMN "reconciliation_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD COLUMN "reconciliation_pause_reason" text;--> statement-breakpoint
CREATE INDEX "f10_bundle_deployment_reconciliation_idx" ON "f10_bundle_deployments" USING btree ("state","execution_status","execution_checked_at");