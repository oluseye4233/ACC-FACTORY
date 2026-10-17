CREATE TABLE "sphinx_marketplace_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"public_open" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD COLUMN "artifact_mode" text DEFAULT 'LIBRARY_ARTIFACT' NOT NULL;--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD COLUMN "qualification" jsonb;--> statement-breakpoint
ALTER TABLE "sphinx_marketplace_settings" ADD CONSTRAINT "sphinx_marketplace_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;