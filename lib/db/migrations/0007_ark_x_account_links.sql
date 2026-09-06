CREATE TABLE "ark_x_account_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ark_subject" text NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ark_x_account_links_subject_idx" ON "ark_x_account_links" USING btree ("ark_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "ark_x_account_links_user_idx" ON "ark_x_account_links" USING btree ("user_id");--> statement-breakpoint
DROP INDEX "ark_x_redemptions_subject_idx";--> statement-breakpoint
ALTER TABLE "command_centre_ark_x_redemptions" ADD COLUMN "checkout_session_id" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "command_centre_ark_x_redemptions" ADD COLUMN "checkout_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "command_centre_ark_x_redemptions" ALTER COLUMN "checkout_session_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "command_centre_ark_x_redemptions" ALTER COLUMN "checkout_status" DROP DEFAULT;