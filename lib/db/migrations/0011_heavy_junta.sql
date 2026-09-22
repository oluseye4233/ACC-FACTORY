CREATE TABLE "exemplar_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_artifact_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"tagline" text NOT NULL,
	"body" text NOT NULL,
	"original_filename" text,
	"artifact_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD CONSTRAINT "exemplar_library_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemplar_library_items" ADD CONSTRAINT "exemplar_library_items_source_artifact_id_harness_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."harness_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exemplar_library_source_artifact_unique" ON "exemplar_library_items" USING btree ("source_artifact_id");