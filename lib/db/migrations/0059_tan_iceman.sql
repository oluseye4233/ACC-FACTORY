CREATE TABLE "internal_review_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"phase" text DEFAULT 'READY' NOT NULL,
	"result" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal_review_steps" ADD CONSTRAINT "internal_review_steps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;