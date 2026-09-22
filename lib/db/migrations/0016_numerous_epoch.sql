ALTER TABLE "spc_player_runs" ADD CONSTRAINT "spc_player_runs_no_composite_score" CHECK ("output_package" IS NULL OR (
        NOT ("output_package" ? 'composite')
        AND NOT ("output_package" ? 'compositeScore')
        AND NOT (("output_package" -> 'scores') ? 'composite')
        AND NOT (("output_package" -> 'scores') ? 'compositeScore')
      ));--> statement-breakpoint
ALTER TABLE "spc_player_runs" ADD CONSTRAINT "spc_player_runs_scores_0_100" CHECK (("clarity_score" IS NULL OR ("clarity_score" BETWEEN 0 AND 100))
        AND ("truthfulness_score" IS NULL OR ("truthfulness_score" BETWEEN 0 AND 100))
        AND ("detectability_score" IS NULL OR ("detectability_score" BETWEEN 0 AND 100)));