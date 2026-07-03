---
name: Pending migration → dev DB drift
description: Runtime 500s / failing DB-tests for a table or column that IS in the committed schema usually means an unapplied migration in dev, not a code bug.
---

When a route 500s or DB-backed tests fail with `relation "<t>" does not exist` or
`column "<c>" does not exist` **for a table/column that is present in `lib/db/src/schema/*`
and in a committed `lib/db/migrations/*.sql`**, the dev DB is behind on migrations —
one or more are PENDING, not applied. This is drift, not a schema/code error.

**Fix:** `pnpm --filter @workspace/db run migrate` (applies pending migrations
non-interactively). Then verify the object exists (`\d <table>` / information_schema)
and restart the api-server workflow.

**Why:** dev is synced only by `migrate`; `push` is avoided because it truncates on
unique/NOT NULL over populated tables (see db-migrations-vs-push.md). If a migration
was committed on another branch/merge but `migrate` never ran locally, the file exists
on disk while `drizzle.__drizzle_migrations` has no row for it → the objects are missing
at runtime even though everything looks correct in source.

**How to apply:** before assuming a feature is broken or "unimplemented" when its
schema/migration clearly exists, check migration state first. The app DB, the
`executeSql` sandbox, and the Playwright testing subagent all share the same dev DB,
so applying the migration once fixes runtime, unit tests, and e2e alike.
