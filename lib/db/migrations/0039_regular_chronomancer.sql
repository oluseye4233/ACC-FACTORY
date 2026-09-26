ALTER TABLE "harness_artifacts" ADD COLUMN "scorecards" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mathmon_maps" ADD COLUMN "scorecard" jsonb;