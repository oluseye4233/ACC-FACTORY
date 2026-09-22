CREATE TABLE "spc_player_webhook_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spc_player_webhook_authorizations" ADD CONSTRAINT "spc_player_webhook_authorizations_run_id_spc_player_draft_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."spc_player_draft_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spc_player_webhook_authorizations_run_unique" ON "spc_player_webhook_authorizations" USING btree ("run_id");