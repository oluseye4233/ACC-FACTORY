CREATE TABLE "command_centre_ark_x_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jti" text NOT NULL,
	"ark_subject" text NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ark_x_redemptions_jti_idx" ON "command_centre_ark_x_redemptions" USING btree ("jti");--> statement-breakpoint
CREATE UNIQUE INDEX "ark_x_redemptions_subject_idx" ON "command_centre_ark_x_redemptions" USING btree ("ark_subject");