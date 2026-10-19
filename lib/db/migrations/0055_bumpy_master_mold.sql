CREATE TABLE "preparation_storage_leases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"file_keys" jsonb NOT NULL,
	"state" text DEFAULT 'UPLOADING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_recovery_at" timestamp with time zone DEFAULT now() + interval '1 day' NOT NULL,
	"last_recovery_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "preparation_storage_leases_due_idx" ON "preparation_storage_leases" USING btree ("next_recovery_at") WHERE "preparation_storage_leases"."state" <> 'COMMITTED';