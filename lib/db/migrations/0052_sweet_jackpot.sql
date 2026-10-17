CREATE TABLE "boomerang_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"origin_kind" text NOT NULL,
	"origin_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"source_hash" text NOT NULL,
	"source_refs" jsonb NOT NULL,
	"state" text DEFAULT 'REQUESTED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"result_text" text,
	"result_hash" text,
	"spc_player_run_id" uuid,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boomerang_cases" ADD CONSTRAINT "boomerang_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boomerang_owner_origin_idx" ON "boomerang_cases" USING btree ("user_id","origin_kind","origin_id","stage");