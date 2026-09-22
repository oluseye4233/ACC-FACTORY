CREATE TABLE IF NOT EXISTS "spc_dev_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"card_ids" jsonb NOT NULL,
	"registration_note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spc_library_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"provenance" jsonb NOT NULL,
	"status" text DEFAULT 'PRE_BUILD' NOT NULL,
	"pre_build" boolean DEFAULT true NOT NULL,
	"cheat_sheet_published" boolean DEFAULT false NOT NULL,
	"cheat_sheet" jsonb,
	"third_party_definitions" jsonb,
	"environment_notes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spc_player_draft_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"selected_card_ids" jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"governance" jsonb NOT NULL,
	"output_package" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spc_player_draft_runs_no_composite_score" CHECK ("output_package" IS NULL OR (
        NOT ("output_package" ? 'composite')
        AND NOT ("output_package" ? 'compositeScore')
        AND NOT (("output_package" -> 'scores') ? 'composite')
        AND NOT (("output_package" -> 'scores') ? 'compositeScore')
      ))
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'spc_player_draft_runs_owner_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "spc_player_draft_runs"
      ADD CONSTRAINT "spc_player_draft_runs_owner_user_id_users_id_fk"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spc_dev_kits_name_unique" ON "spc_dev_kits" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spc_library_cards_slug_unique" ON "spc_library_cards" USING btree ("slug");--> statement-breakpoint
INSERT INTO "spc_library_cards"
  ("id", "slug", "name", "provenance", "status", "pre_build", "cheat_sheet_published",
   "cheat_sheet", "third_party_definitions", "environment_notes")
VALUES
  ('11111111-1111-4111-8111-111111111111', 'atlas-360-plan', 'ATLAS 360 PLAN',
   '{"source":"SPC_PLAYER_OMNIBUS_v4_0_Unified_Build","version":"v4.0","status":"PRE_BUILD"}',
   'PRE_BUILD', true, false, null, null, null),
  ('22222222-2222-4222-8222-222222222222', 'spartan', 'SPARTAN',
   '{"source":"SPC_PLAYER_OMNIBUS_v4_0_Unified_Build","version":"v4.0","status":"PRE_BUILD"}',
   'PRE_BUILD', true, false, null, null, null),
  ('33333333-3333-4333-8333-333333333333', 'code-dj', 'CODE DJ',
   '{"source":"SPC_PLAYER_OMNIBUS_v4_0_Unified_Build","version":"v4.0","status":"PRE_BUILD"}',
   'PRE_BUILD', true, false, null, null, null),
  ('44444444-4444-4444-8444-444444444444', 'bugmxt', 'BUGMXT',
   '{"source":"SPC_PLAYER_OMNIBUS_v4_0_Unified_Build","version":"v4.0","status":"PRE_BUILD"}',
   'PRE_BUILD', true, false, null, null, null),
  ('55555555-5555-4555-8555-555555555555', 'codon', 'CODON',
   '{"source":"SPC_PLAYER_OMNIBUS_v4_0_Unified_Build","version":"v4.0","status":"PRE_BUILD"}',
   'PRE_BUILD', true, false, null, null, null),
  ('66666666-6666-4666-8666-666666666666', 'cordon', 'CORDON',
   '{"source":"SPC_PLAYER_OMNIBUS_v4_0_Unified_Build","version":"v4.0","status":"PRE_BUILD"}',
   'PRE_BUILD', true, false, null, null, null)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "spc_dev_kits" ("name", "card_ids", "registration_note")
VALUES (
  'SPC Dev Kit',
  '["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333","44444444-4444-4444-8444-444444444444","55555555-5555-4555-8555-555555555555","66666666-6666-4666-8666-666666666666"]',
  'Registration records the six-card baseline; it does not execute the Dev Kit.'
)
ON CONFLICT ("name") DO NOTHING;