CREATE TABLE "stage_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_key" text NOT NULL,
	"kind" text NOT NULL,
	"version" integer NOT NULL,
	"script" text NOT NULL,
	"state" text DEFAULT 'DRAFT' NOT NULL,
	"provider_video_id" uuid,
	"is_test" boolean DEFAULT true NOT NULL,
	"generation_started_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"published_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage_guides" ADD CONSTRAINT "stage_guides_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_guides" ADD CONSTRAINT "stage_guides_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stage_guides_variant_version" ON "stage_guides" USING btree ("stage_key","kind","version");