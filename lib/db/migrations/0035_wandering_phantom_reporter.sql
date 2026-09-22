CREATE TYPE "public"."f10_colonization_consent_purpose" AS ENUM('STAGE', 'PROMOTION');--> statement-breakpoint
CREATE TABLE "f10_colonization_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purpose" "f10_colonization_consent_purpose" NOT NULL,
	"deployment_subject" text NOT NULL,
	"exact_write_hash" text NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD COLUMN "deployment_subject" text;--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD COLUMN "ucg_col_certificate" jsonb;--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD COLUMN "stage_consent" jsonb;--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD COLUMN "promotion_consent" jsonb;--> statement-breakpoint
ALTER TABLE "f10_colonization_runs" ADD COLUMN "vault_handle" jsonb;--> statement-breakpoint
ALTER TABLE "f10_colonization_consents" ADD CONSTRAINT "f10_colonization_consents_run_id_f10_colonization_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."f10_colonization_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f10_colonization_consents" ADD CONSTRAINT "f10_colonization_consents_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "f10_colonization_consent_once_uniq" ON "f10_colonization_consents" USING btree ("consent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f10_colonization_run_purpose_once_uniq" ON "f10_colonization_consents" USING btree ("run_id","purpose");--> statement-breakpoint
CREATE INDEX "f10_colonization_consent_tenant_idx" ON "f10_colonization_consents" USING btree ("tenant_id");