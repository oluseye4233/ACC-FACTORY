ALTER TABLE "spc_player_runs" ADD COLUMN "attempt_token" uuid;--> statement-breakpoint
ALTER TABLE "spc_player_runs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "spc_player_runs_attempt_token_unique" ON "spc_player_runs" USING btree ("attempt_token");