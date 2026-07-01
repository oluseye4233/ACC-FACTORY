CREATE TABLE "magnet_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool" text NOT NULL,
	"ip_hash" text NOT NULL,
	"email" text,
	"input_chars" integer DEFAULT 0 NOT NULL,
	"band" text,
	"savings_low_pct" integer,
	"savings_high_pct" integer,
	"compression_class" text,
	"raw_score" integer,
	"provider" text,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"converted" boolean DEFAULT false NOT NULL,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sku_sequences" (
	"creator_hash" varchar(6) NOT NULL,
	"product_type" varchar(3) NOT NULL,
	"sector" varchar(3) NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sku_sequences_creator_hash_product_type_sector_pk" PRIMARY KEY("creator_hash","product_type","sector")
);
--> statement-breakpoint
CREATE TABLE "f0_report_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_code" text NOT NULL,
	"code" text NOT NULL,
	"sku" text NOT NULL,
	"artifact_id" uuid,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "f0_report_codes_report_code_unique" UNIQUE("report_code")
);
--> statement-breakpoint
CREATE TABLE "mathmon_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"report" jsonb NOT NULL,
	"provider" text,
	"model_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mathmon_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"intake_id" uuid,
	"map" jsonb NOT NULL,
	"math_coherence" integer NOT NULL,
	"applicability" integer NOT NULL,
	"predictive_reliability" integer NOT NULL,
	"disclaimer" text NOT NULL,
	"provider" text,
	"model_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "creator_hash" varchar(6);--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "mathmon_score" integer;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD COLUMN "forge_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "f0_report_codes" ADD CONSTRAINT "f0_report_codes_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "f0_report_codes" ADD CONSTRAINT "f0_report_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mathmon_intakes" ADD CONSTRAINT "mathmon_intakes_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mathmon_intakes" ADD CONSTRAINT "mathmon_intakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mathmon_maps" ADD CONSTRAINT "mathmon_maps_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mathmon_maps" ADD CONSTRAINT "mathmon_maps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "magnet_sessions_tool_created_idx" ON "magnet_sessions" USING btree ("tool","created_at");--> statement-breakpoint
CREATE INDEX "mathmon_intakes_session_id_idx" ON "mathmon_intakes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "mathmon_maps_session_id_idx" ON "mathmon_maps" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD CONSTRAINT "harness_artifacts_sku_unique" UNIQUE("sku");
