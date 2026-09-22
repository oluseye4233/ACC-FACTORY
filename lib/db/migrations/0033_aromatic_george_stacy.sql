DROP INDEX "f10_bundle_deployment_reconciliation_idx";--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD COLUMN "reconciliation_claim_token" text;--> statement-breakpoint
ALTER TABLE "f10_bundle_deployments" ADD COLUMN "reconciliation_claim_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "f10_bundle_deployment_reconciliation_idx" ON "f10_bundle_deployments" USING btree ("state","execution_status","reconciliation_claim_expires_at","execution_checked_at");