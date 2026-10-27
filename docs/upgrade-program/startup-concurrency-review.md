# Startup concurrency fix — workspace review

## Scope and preserved security contract

The existing authorized ARK startup migration runner now acquires a PostgreSQL
session advisory lock **before** reading or creating its ledger. It holds the
lock through checksum checks, file transactions, grants and the existing
`ark_app_login` password assignment. The verifier and API startup order are
unchanged. No SQL migration, checksum, RLS policy, role privilege or security
verification was weakened or replaced.

Cooperating runners for the same database use the fixed two-integer advisory
key `(1095912241, 1)` on the actual migration session. Lock contention waits at
most 60 seconds between successful database responses, then exits unsuccessfully
without entering migration work. This does not bound a stalled database/network
query. Connection establishment has a ten-second timeout.

Locks are explicitly released on success and failure; closing the connection
also releases a session lock. File transactions still roll back on errors.
Checksum drift, unrecorded existing tables and pending `--check` results remain
fatal. No automatic retry of failed migrations or password updates was added.

## Limits

- Advisory locking coordinates only runners using this key in the same database.
  Manual administration, old deployed runners and connections to different
  databases in the same PostgreSQL cluster do not participate.
- PostgreSQL role passwords are cluster-wide. Operators must avoid simultaneous
  manual password changes and incompatible credential versions during rollout.
- The migration lock ends before the separate verifier runs. A different runner
  with a different password can still invalidate that verifier's credentials.
  Matching production secrets across instances remain an operational requirement.
- A rolling rollout can still overlap old unlocked startup code. If another
  role-update collision occurs during rollout, it must fail closed; do not skip
  verification or retry mutations blindly.
- This is a workspace fix, not proof of production recovery or security parity.
  The earlier 06:41 readiness failure's underlying exception remains unproven.

## Readiness diagnostics

Each fresh failed probe logs `database_readiness_failed`, its UTC timestamp and
an allowlisted PostgreSQL/network error code (otherwise `UNKNOWN`). The raw
error, message, stack, query, hostname and connection URL are never logged by
this diagnostic. Cached/concurrent checks do not produce duplicate diagnostics
within the five-second cache period. Public endpoint response shapes and
fail-closed 503 behaviour are unchanged.

## Safe local verification

These unit tests use fake clients; they do not run migrations or need credentials:

```sh
node --test scripts/db/startup-lock.test.mjs
pnpm --filter @workspace/api-server exec vitest run --config vitest.readiness.config.ts
pnpm --filter @workspace/api-server run typecheck
```

Coverage includes two simulated competing sessions, timeout, lock-query failure,
work failure/unlock, ledger/password critical-section ordering, checksum and
unrecorded-table refusal, rollback and check-only nonzero results. Readiness
tests cover safe diagnostics, caching and HTTP status behaviour.

Real multi-process PostgreSQL contention has not been tested by these mocks.
Use an explicitly designated disposable database for such integration testing,
never production or the shared development database. No agent-side production
migration or publication is part of this review.
