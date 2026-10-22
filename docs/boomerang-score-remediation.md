# Score-driven Boomerang rework and re-ingestion

1. Open Boomerang at a session's F-stage (embedded panel or workspace).
2. The server selects the latest saved production artifact at that **exact**
   stage, owned by that user. It never cherry-picks an older low score,
   substitutes another project's artifact, or treats missing scores as low.
3. A recorded JCSE below **45** or MATHMON below **70** produces a rework
   recommendation. At 45/70 there is no low-score trigger. Missing scores
   remain NOT RUN; absence of a recommendation is not approval.
4. The recommendation shows the artifact name/ID, actual scores, recorded
   scorecard explanations/actions and bounded evaluator feedback. General
   dimension-level correction guidance is also labelled by metric; it is not
   a new model diagnosis.
5. Choose **Rework selected artifact in SPC Player → F1**. The selected source
   is pinned read-only, and the recommendation fills the rework brief.
   Select appropriate SPCs and confirm creation/execution. Existing provider
   budget controls apply. The server retains canonical shortcomings even if
   the optional operator brief changes.
6. The server freezes evidence in run governance and checks the current source,
   scores, scorecards and conservative project baseline again before execution.
   Stale or superseded recommendations require a fresh run.
7. Once synthesis completes, the executing browser automatically opens F1.
   Completed saved runs also retain the F1 link for later/reloaded access.
   The package includes the recommendation, exact source reference, correction
   goals and mandatory re-ingestion next step.
8. F1 automatically loads the package into an empty input. Existing input is
   never silently overwritten. Read the shortcomings and revised artifact,
   then use the normal ingestion action. Nothing automatically spends an
   ingestion credit or calls the ingestion model.
9. Continue through normal evaluation. Improvement is not established until
   fresh evaluations provide evidence. Original artifacts and scores are
   unchanged. No automatic Boomerang acceptance, certification, release or
   stage advancement occurs.

This is separate from Boomerang's return-to-origin supporting-work review.
F0 and stages without an artifact-backed engine do not acquire a fabricated
source. Recommendation GET requests perform no model calls or data writes.
No schema migration or production security installation is required.
