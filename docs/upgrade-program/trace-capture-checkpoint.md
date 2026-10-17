# Development trace capture checkpoint

## Implemented

- A committed, additive migration creates private Command Deck metadata storage.
- Shared engine artifact persistence writes the artifact and its trace in one
  transaction. Failure in trace capture rolls back the artifact insert.
- F8 verified-child creation and SPC Player return-to-stage writes use the same
  capture primitive inside their existing transactions.
- Session ownership is checked before capture; read access is owner-scoped.
  This is application-level isolation, **not PostgreSQL RLS**.
- A trace uses the session identity across stage saves, records stage, canonical
  output hash, version-bound artifact reference and per-session actor pseudonym.
- Duplicate artifact/version events are idempotent. Trace rows contain no
  artifact body, scorecard body, model response or user display name/email.
- Corpus capture remains disabled: stream NONE, NOT_ELIGIBLE, with an explicit
  reason. No training record, export or opt-in is created by these hooks.

## Boundaries

This is not the full Command Deck release. There is no new operator UI or
public trace endpoint. The internal owner-scoped read service is for subsequent
UI integration. F0's separate record types, pre-session activity, F9 machine
records, F9.5 custody, F10 delivery, F11 handoff, F12 and failure/waiver events
are not covered by these artifact-save hooks.

Parent trace/fork lineage, a versioned capture map, full consent and ethics
transactions, signed intake, database RLS, retention/partitioning, redacted
corpus construction and independently verified enforcement are still pending.
Existing artifacts are not backfilled or falsely labelled as newly observed.
Deleting a session/user cascades its private trace data; this is not an
immutable external audit archive.

## Release status

Development migration applied. Production not modified or republished.
Azure credentials are not configured. The last production database check was
blocked by a frozen database. No invariant is marked ACTIVE or ENFORCED based
on these local changes.
