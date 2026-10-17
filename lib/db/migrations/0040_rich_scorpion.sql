CREATE TABLE "provider_billing_report_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"model_id" varchar(160) NOT NULL,
	"amount_usd" numeric(14, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_billing_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(48) NOT NULL,
	"billing_month" date NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"uploaded_by" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD COLUMN "source_f0_report_id" uuid;--> statement-breakpoint
ALTER TABLE "spc_player_draft_runs" ADD COLUMN "origin_session_id" uuid;--> statement-breakpoint
ALTER TABLE "spc_player_draft_runs" ADD COLUMN "origin_feature_id" integer;--> statement-breakpoint
ALTER TABLE "spc_player_draft_runs" ADD COLUMN "returned_artifact_id" uuid;--> statement-breakpoint
ALTER TABLE "provider_billing_report_lines" ADD CONSTRAINT "provider_billing_report_lines_report_id_provider_billing_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."provider_billing_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_billing_reports" ADD CONSTRAINT "provider_billing_reports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_billing_report_lines_report_model_uq" ON "provider_billing_report_lines" USING btree ("report_id","model_id");--> statement-breakpoint
CREATE INDEX "provider_billing_report_lines_report_idx" ON "provider_billing_report_lines" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_billing_reports_provider_month_uq" ON "provider_billing_reports" USING btree ("provider","billing_month");--> statement-breakpoint
CREATE INDEX "provider_billing_reports_month_idx" ON "provider_billing_reports" USING btree ("billing_month");--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD CONSTRAINT "exemplar_library_items_source_f0_report_id_f0_reports_id_fk" FOREIGN KEY ("source_f0_report_id") REFERENCES "public"."f0_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spc_player_draft_runs" ADD CONSTRAINT "spc_player_draft_runs_origin_session_id_harness_sessions_id_fk" FOREIGN KEY ("origin_session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spc_player_draft_runs" ADD CONSTRAINT "spc_player_draft_runs_returned_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("returned_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "harness_engine_runs_created_provider_model_idx" ON "harness_engine_runs" USING btree ("created_at","provider","model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exemplar_library_source_f0_report_unique" ON "exemplar_library_items" USING btree ("source_f0_report_id");--> statement-breakpoint
ALTER TABLE "spc_player_draft_runs" ADD CONSTRAINT "spc_player_origin_session_stage_pair" CHECK (("origin_session_id" IS NULL) = ("origin_feature_id" IS NULL));