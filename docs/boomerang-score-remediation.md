# Score-driven Boomerang rework and re-ingestion

## Numbered returns to the originating stage

An artifact-bound Boomerang return now retains an immutable candidate named
`<source name> · Upgraded 1`, followed by `Upgraded 2`, `Upgraded 3` and so on
within that source lineage. The return links to the exact artifact at the
original session and cockpit stage, not just a generic session page. Refreshing
the page retains its identity. A repeated delivery request reuses its existing
receipt rather than allocating another version.

The original artifact and its evaluations are not overwritten. SPC Player
returns remain reviewed, plan-only candidates; their numbered label does not
turn them into certified production artifacts. The returned card lets the owner
explicitly select that candidate for another SPC Player rework without silently
substituting the original production source. Normal source/ownership, review,
re-ingestion and stage-evaluation requirements still apply.

For a failed F8 drift gate, use **AUTO REMEDIATE + RE-DRIFT CHECK**. The corrected
bundle receives its numbered lineage and is checked against the bound certified
MVP PDD immediately. A completed check with verdict FAIL is still a failed
check, even though the repair procedure itself completed. The interface offers
**REMEDIATE AGAIN + RE-DRIFT CHECK**, bound to that fresh failed report, to
authorize the next attempt. A passing internal drift result is displayed
separately from release or independent-verification approval.

Each attempt is bounded and may consume model credits. There is no unattended
infinite retry loop or guarantee that the first correction will pass. Uncertain
provider outcomes, unavailable budget and required changes to approved
requirements stop for review rather than trigger repeated charges or weakened
checks. Historical support-only runs without a retained departure baseline are
not retroactively assigned invented source evidence.

## Score-driven re-ingestion remains a separate path

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
