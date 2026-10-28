CREATE TABLE "email_delivery_settings" (
	"scope_key" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"mode" text DEFAULT 'MANAGED' NOT NULL,
	"provider" text,
	"sender_name" text,
	"from_email" text,
	"reply_to" text,
	"credential_encrypted" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid,
	"verification_hash" text,
	"verification_user_id" uuid,
	"verification_expires_at" timestamp with time zone,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"verification_sent" boolean DEFAULT false NOT NULL,
	"test_window_start" timestamp with time zone,
	"test_count" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_delivery_exact_scope" CHECK (
  ("email_delivery_settings"."user_id" IS NOT NULL AND "email_delivery_settings"."organization_id" IS NULL AND "email_delivery_settings"."scope_key" = 'user:' || "email_delivery_settings"."user_id"::text)
  OR ("email_delivery_settings"."user_id" IS NULL AND "email_delivery_settings"."organization_id" IS NOT NULL AND "email_delivery_settings"."scope_key" = 'org:' || "email_delivery_settings"."organization_id"::text)
)
);
--> statement-breakpoint
ALTER TABLE "portal_publications" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "email_delivery_settings" ADD CONSTRAINT "email_delivery_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_settings" ADD CONSTRAINT "email_delivery_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_settings" ADD CONSTRAINT "email_delivery_settings_verification_user_id_users_id_fk" FOREIGN KEY ("verification_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;