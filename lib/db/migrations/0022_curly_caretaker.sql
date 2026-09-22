ALTER TABLE "f9_mecha_runs" ADD COLUMN "evidence_hash" text;--> statement-breakpoint
ALTER TABLE "f9_mecha_runs" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "f9_mecha_runs_idempotency_key_unique" ON "f9_mecha_runs" USING btree ("idempotency_key");