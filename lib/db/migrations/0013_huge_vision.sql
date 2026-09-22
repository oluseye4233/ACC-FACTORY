CREATE TABLE "spc_player_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"selected_exemplar" jsonb NOT NULL,
	"profile" text NOT NULL,
	"structured_brief" jsonb NOT NULL,
	"status" text NOT NULL,
	"stage_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_package" jsonb,
	"clarity_score" integer,
	"truthfulness_score" integer,
	"detectability_score" integer,
	"execution_advisory" jsonb NOT NULL,
	"distribution_plan" jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "spc_player_runs" ADD CONSTRAINT "spc_player_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;