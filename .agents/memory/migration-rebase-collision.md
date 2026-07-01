---
name: Drizzle migration collision on rebase + empty tracking table
description: How to reconcile a duplicate migration and an empty __drizzle_migrations after rebasing onto main
---

Two related traps hit together when a branch's migration is rebased onto a main
that added its own migration in the same numeric slot.

## 1. Superset/duplicate migration → drop and regenerate as a delta
If both branches independently generated a migration that CREATEs the same tables
(e.g. both created the base F0 tables because they branched before those tables
were migrated), your migration is a superset of main's. Do NOT keep both — the
second would re-CREATE tables main already creates.

Resolution during rebase:
- Adopt main's migration + its snapshot/journal entry as-is (`git checkout --ours`
  the snapshot, keep only main's entry in `_journal.json`).
- `git rm -f` your duplicate `.sql` and its snapshot.
- The schema *source* (`lib/db/src/schema/*`) merges cleanly and already contains
  both sides' changes, so `pnpm --filter @workspace/db run generate` diffs against
  main's latest snapshot and emits ONLY your delta as the next-numbered migration.
- Stage all, `git rebase --continue`.

**Why:** migrations are ordered and cumulative; a rebase can't auto-merge two
files claiming the same index. Regenerating guarantees the delta chains on main's
state instead of duplicating it.

## 2. Empty drizzle.__drizzle_migrations on a push-built dev DB
The shared dev DB is often built via `push`, leaving `drizzle.__drizzle_migrations`
EMPTY while every table physically exists. `migrate` then tries to apply from 0000
and fails "already exists". Reconcile by marking the existing migrations applied
(NEVER truncate/drop): insert one row per journal entry with
`created_at = entry.when` and `hash = sha256(raw .sql file contents)`
(drizzle's own hashing). `migrate` decides what to run by MAX(created_at), so after
this it becomes a clean no-op and future migrations apply normally.

**How to apply:** compute hashes in node
(`crypto.createHash('sha256').update(fileContents).digest('hex')`) and
`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ...`. Prod is a
separate fresh DB and still replays every migration from 0000, so this dev-only
reconciliation is deploy-safe.
