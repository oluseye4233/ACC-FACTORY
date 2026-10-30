CREATE TABLE "autocommand_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"verified_email" text NOT NULL,
	"project_name" text NOT NULL,
	"package_type" text NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autocommand_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"extracted_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autocommand_drafts" ADD CONSTRAINT "autocommand_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autocommand_uploads" ADD CONSTRAINT "autocommand_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "autocommand_drafts_user_request_key" ON "autocommand_drafts" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE INDEX "autocommand_drafts_user_created" ON "autocommand_drafts" USING btree ("user_id","created_at");