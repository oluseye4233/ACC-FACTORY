# IMPRIMA Internal review recovery and edit comparison

KLARITY and SOCRATES each retain an owner-private checkpoint keyed to the exact
source/prompt, adapter, provider and session. Retrying the same saved source and
options reuses completed steps; it does not repeat a paid KLARITY call just
because SOCRATES was denied or file rendering was interrupted.

Each step is serialized across API workers with a database lock. Dispatch
intent is saved before calling the provider. A known budget-reservation denial
returns the step to ready for an explicit retry. Other ambiguous failures stop
for run-ledger review instead of dispatching again. Completed outputs are
schema-validated on replay. Changing the saved source, prompt or relevant
options creates different input, not permission to reuse stale evidence.

This does not make final file generation idempotent: repeating a completed
assessment can produce another private draft package using the cached review.
It never grants release, Final approval, independent verification or
certification. Existing protected IMPRIMA and SHORT SPRINTS remain separate.

New internal assessments retain their editorial evidence in the private report.
The assessment workspace shows KLARITY's exact before/after paragraphs, source
and reviewed-content hashes, with an internal-only caveat. Historical reports
without that evidence remain readable and explicitly say it was not retained;
their downloadable review may still be available. Nothing is reconstructed or
silently attached to an old assessment.

The committed public-schema migration keeps development and replay environments
reproducible. Production must include the new checkpoint table in its reviewed
Publish schema plan. The separate ARK startup migrator does not apply this public
migration. No production database changes were performed by the Agent.
