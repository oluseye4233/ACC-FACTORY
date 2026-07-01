-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "command_centre_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" text DEFAULT 'EXPLORER' NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_price_id" varchar(255),
	"status" text DEFAULT 'inactive' NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"f1_today" integer DEFAULT 0 NOT NULL,
	"f2_today" integer DEFAULT 0 NOT NULL,
	"f3_today" integer DEFAULT 0 NOT NULL,
	"f4_today" integer DEFAULT 0 NOT NULL,
	"f5_today" integer DEFAULT 0 NOT NULL,
	"f6_today" integer DEFAULT 0 NOT NULL,
	"f7_today" integer DEFAULT 0 NOT NULL,
	"limits_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"f8_today" integer DEFAULT 0 NOT NULL,
	"monthly_cost_cap_usd_override" numeric(12, 2),
	"f1000_member" boolean DEFAULT false NOT NULL,
	CONSTRAINT "command_centre_subscribers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pricing_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"content" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_content_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(320),
	"display_name" varchar(255),
	"role" text DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "cartridge_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"stripe_checkout_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"amount_usd_cents" integer,
	"cartridge_package_id" uuid,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "cartridge_credits_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "harness_feature_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"feature_id" integer NOT NULL,
	"status" text DEFAULT 'LOCKED' NOT NULL,
	"unlocked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harness_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"from_feature" integer DEFAULT 3 NOT NULL,
	"to_feature" integer DEFAULT 5 NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"stripe_checkout_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"amount_usd_cents" integer,
	"ingestion_document_id" uuid,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "ingestion_credits_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "harness_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"feature_id" integer NOT NULL,
	"artifact_type" text NOT NULL,
	"artifact_content" jsonb NOT NULL,
	"jcse_score" integer,
	"cert_tier" text,
	"gro_state" text DEFAULT 'SAFE_LIFE' NOT NULL,
	"spartan_cert" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"spc_origin" text DEFAULT 'artisanal' NOT NULL,
	"provider" text,
	"model_id" text,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "harness_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_name" varchar(255) DEFAULT 'Untitled Session' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"ingestion_id" uuid,
	"preferred_model_provider" text DEFAULT 'claude' NOT NULL,
	"cartridge_id" uuid,
	"org_id" uuid,
	"org_visible" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harness_engine_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"engine_id" integer NOT NULL,
	"model_id" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text DEFAULT 'claude' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" text
);
--> statement-breakpoint
CREATE TABLE "cartridge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cartridge_id" uuid NOT NULL,
	"original_filename" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"extracted_text_chars" integer NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartridge_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cartridge_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"descriptor" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartridge_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"outcome_one_liner" text NOT NULL,
	"scope_statement" text NOT NULL,
	"target_platform_hint" text,
	"seed_prompt" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartridge_spcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cartridge_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"billing_alerts_enabled" boolean DEFAULT true NOT NULL,
	"high_cost_alerts_enabled" boolean DEFAULT false NOT NULL,
	"high_cost_threshold_usd" numeric(8, 2) DEFAULT '1.00' NOT NULL,
	"unsubscribe_token" varchar(64) NOT NULL,
	"last_digest_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"label" text,
	"key_prefix" text NOT NULL,
	"key_encrypted" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_price_id" varchar(255),
	"seats_purchased" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan" text DEFAULT 'team' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reader_onboarding" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"track" varchar(32) DEFAULT 'default' NOT NULL,
	"reader_code" varchar(64),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_centre_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"status" text DEFAULT 'UNLOCKED' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"revoked_by_user_id" uuid,
	"revoke_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restored_at" timestamp with time zone,
	"restored_by_user_id" uuid,
	"restored_note" text
);
--> statement-breakpoint
CREATE TABLE "ingestion_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_filename" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"source_doc_kind" text DEFAULT 'other' NOT NULL,
	"detected_title" varchar(512),
	"extracted_text_sha256" varchar(64) NOT NULL,
	"extracted_text_chars" integer NOT NULL,
	"summary" text NOT NULL,
	"seed_prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_revocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"reason" text NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_craft_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pillar" varchar(16) NOT NULL,
	"best_score" integer NOT NULL,
	"evidence_artifact_id" uuid,
	"first_earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "context_craft_badges_user_pillar_unique" UNIQUE("user_id","pillar")
);
--> statement-breakpoint
CREATE TABLE "jst_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"jobs_score" integer NOT NULL,
	"skills_score" integer NOT NULL,
	"talent_score" integer NOT NULL,
	"composite" numeric(5, 2) NOT NULL,
	"band" varchar(16) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(24) DEFAULT 'self_assessment' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_centre_f1000_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"issued_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"redeemed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_centre_f1000_invites_seq_unique" UNIQUE("seq"),
	CONSTRAINT "command_centre_f1000_invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "command_centre_subscribers" ADD CONSTRAINT "command_centre_subscribers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartridge_credits" ADD CONSTRAINT "cartridge_credits_cartridge_package_id_cartridge_packages_id_fk" FOREIGN KEY ("cartridge_package_id") REFERENCES "public"."cartridge_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartridge_credits" ADD CONSTRAINT "cartridge_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_feature_state" ADD CONSTRAINT "harness_feature_state_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_escalations" ADD CONSTRAINT "harness_escalations_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_credits" ADD CONSTRAINT "ingestion_credits_ingestion_document_id_ingestion_documents_id_" FOREIGN KEY ("ingestion_document_id") REFERENCES "public"."ingestion_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_credits" ADD CONSTRAINT "ingestion_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD CONSTRAINT "harness_artifacts_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_artifacts" ADD CONSTRAINT "harness_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_sessions" ADD CONSTRAINT "harness_sessions_cartridge_id_cartridge_packages_id_fk" FOREIGN KEY ("cartridge_id") REFERENCES "public"."cartridge_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_sessions" ADD CONSTRAINT "harness_sessions_ingestion_id_ingestion_documents_id_fk" FOREIGN KEY ("ingestion_id") REFERENCES "public"."ingestion_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_sessions" ADD CONSTRAINT "harness_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_sessions" ADD CONSTRAINT "harness_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_engine_runs" ADD CONSTRAINT "harness_engine_runs_session_id_harness_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."harness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_engine_runs" ADD CONSTRAINT "harness_engine_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartridge_documents" ADD CONSTRAINT "cartridge_documents_cartridge_id_cartridge_packages_id_fk" FOREIGN KEY ("cartridge_id") REFERENCES "public"."cartridge_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartridge_links" ADD CONSTRAINT "cartridge_links_cartridge_id_cartridge_packages_id_fk" FOREIGN KEY ("cartridge_id") REFERENCES "public"."cartridge_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartridge_packages" ADD CONSTRAINT "cartridge_packages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartridge_spcs" ADD CONSTRAINT "cartridge_spcs_cartridge_id_cartridge_packages_id_fk" FOREIGN KEY ("cartridge_id") REFERENCES "public"."cartridge_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_onboarding" ADD CONSTRAINT "reader_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_centre_badges" ADD CONSTRAINT "command_centre_badges_restored_by_user_id_users_id_fk" FOREIGN KEY ("restored_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_centre_badges" ADD CONSTRAINT "command_centre_badges_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_centre_badges" ADD CONSTRAINT "command_centre_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_documents" ADD CONSTRAINT "ingestion_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_revocations" ADD CONSTRAINT "badge_revocations_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_revocations" ADD CONSTRAINT "badge_revocations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_craft_badges" ADD CONSTRAINT "context_craft_badges_evidence_artifact_id_harness_artifacts_id_" FOREIGN KEY ("evidence_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_craft_badges" ADD CONSTRAINT "context_craft_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jst_assessments" ADD CONSTRAINT "jst_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_centre_f1000_invites" ADD CONSTRAINT "command_centre_f1000_invites_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "harness_feature_state_session_feature_idx" ON "harness_feature_state" USING btree ("session_id" int4_ops,"feature_id" int4_ops);--> statement-breakpoint
CREATE INDEX "harness_sessions_cartridge_id_idx" ON "harness_sessions" USING btree ("cartridge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "harness_sessions_ingestion_id_idx" ON "harness_sessions" USING btree ("ingestion_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "harness_sessions_org_id_idx" ON "harness_sessions" USING btree ("org_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "harness_engine_runs_user_created_idx" ON "harness_engine_runs" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "cartridge_documents_cartridge_id_idx" ON "cartridge_documents" USING btree ("cartridge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cartridge_links_cartridge_id_idx" ON "cartridge_links" USING btree ("cartridge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cartridge_packages_user_id_idx" ON "cartridge_packages" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cartridge_spcs_cartridge_id_idx" ON "cartridge_spcs" USING btree ("cartridge_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_token_uniq" ON "notification_preferences" USING btree ("unsubscribe_token" text_ops);--> statement-breakpoint
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_org_uniq" ON "notification_preferences" USING btree ("user_id" uuid_ops,"organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "integration_credentials_user_id_idx" ON "integration_credentials" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "integration_credentials_user_provider_uniq" ON "integration_credentials" USING btree ("user_id" text_ops,"provider" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uniq" ON "organizations" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "organizations_stripe_customer_id_idx" ON "organizations" USING btree ("stripe_customer_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "badges_user_badge_uniq" ON "command_centre_badges" USING btree ("user_id" text_ops,"badge_id" text_ops);--> statement-breakpoint
CREATE INDEX "badge_revocations_revoked_at_idx" ON "badge_revocations" USING btree ("revoked_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "badge_revocations_target_idx" ON "badge_revocations" USING btree ("target_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "organization_invites_org_id_idx" ON "organization_invites" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invites_token_uniq" ON "organization_invites" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "jst_assessments_user_created_idx" ON "jst_assessments" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "f1000_invites_redeemed_by_user_idx" ON "command_centre_f1000_invites" USING btree ("redeemed_by_user_id" uuid_ops) WHERE (redeemed_by_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id" uuid_ops);
*/