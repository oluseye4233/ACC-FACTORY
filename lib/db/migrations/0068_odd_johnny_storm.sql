CREATE TABLE "autocommand_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"verified_email" text NOT NULL,
	"project_name" text NOT NULL,
	"package_type" text NOT NULL,
	"standard_price_cents" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"snapshot_hash" text NOT NULL,
	"plan_version" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'AWAITING_AUTHORIZATION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autocommand_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'PENDING' NOT NULL,
	"claim_token" uuid,
	"evidence" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "autocommand_orders" ADD CONSTRAINT "autocommand_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autocommand_orders" ADD CONSTRAINT "autocommand_orders_draft_id_autocommand_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."autocommand_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autocommand_steps" ADD CONSTRAINT "autocommand_steps_order_id_autocommand_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."autocommand_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "autocommand_orders_draft" ON "autocommand_orders" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "autocommand_orders_user_created" ON "autocommand_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "autocommand_steps_order_position" ON "autocommand_steps" USING btree ("order_id","position");