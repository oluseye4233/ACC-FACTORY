CREATE TABLE "osiris_calibrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custody_id" uuid NOT NULL,
	"machine_artifact_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"recommendation" text NOT NULL,
	"lineage" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "osiris_custodies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_artifact_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"source_hash" text NOT NULL,
	"source_signature" text NOT NULL,
	"artifact_version" text NOT NULL,
	"media_type" text NOT NULL,
	"telemetry_contract" jsonb NOT NULL,
	"health" text DEFAULT 'unknown' NOT NULL,
	"custody_state" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_telemetry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "osiris_custody_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custody_id" uuid NOT NULL,
	"machine_artifact_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"health" text,
	"custody_state" text,
	"reason" text NOT NULL,
	"lineage" jsonb NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "osiris_deviations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custody_id" uuid NOT NULL,
	"machine_artifact_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"detail" text NOT NULL,
	"lineage" jsonb NOT NULL,
	"routed_to" text DEFAULT 'SOLVA_F0' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "osiris_calibrations" ADD CONSTRAINT "osiris_calibrations_custody_id_osiris_custodies_id_fk" FOREIGN KEY ("custody_id") REFERENCES "public"."osiris_custodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_calibrations" ADD CONSTRAINT "osiris_calibrations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_calibrations" ADD CONSTRAINT "osiris_calibrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_custodies" ADD CONSTRAINT "osiris_custodies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_custodies" ADD CONSTRAINT "osiris_custodies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_custody_events" ADD CONSTRAINT "osiris_custody_events_custody_id_osiris_custodies_id_fk" FOREIGN KEY ("custody_id") REFERENCES "public"."osiris_custodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_custody_events" ADD CONSTRAINT "osiris_custody_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_deviations" ADD CONSTRAINT "osiris_deviations_custody_id_osiris_custodies_id_fk" FOREIGN KEY ("custody_id") REFERENCES "public"."osiris_custodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_deviations" ADD CONSTRAINT "osiris_deviations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "osiris_deviations" ADD CONSTRAINT "osiris_deviations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "osiris_calibrations_owner_idx" ON "osiris_calibrations" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "osiris_custodies_machine_artifact_unique" ON "osiris_custodies" USING btree ("machine_artifact_id");--> statement-breakpoint
CREATE INDEX "osiris_custodies_owner_idx" ON "osiris_custodies" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "osiris_custodies_org_idx" ON "osiris_custodies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "osiris_custody_events_custody_idx" ON "osiris_custody_events" USING btree ("custody_id","occurred_at");--> statement-breakpoint
CREATE INDEX "osiris_custody_events_artifact_idx" ON "osiris_custody_events" USING btree ("machine_artifact_id","occurred_at");--> statement-breakpoint
CREATE INDEX "osiris_deviations_owner_idx" ON "osiris_deviations" USING btree ("owner_user_id","created_at");