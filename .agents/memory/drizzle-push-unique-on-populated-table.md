---
name: drizzle DB sync — generate + migrate, not push
description: Why this repo syncs the DB with drizzle-kit generate + migrate (never push), and how the existing-DB baseline was adopted.
---

`drizzle-kit push` prompts "Do you want to truncate <table>?" whenever a
`.unique()` or NOT NULL is added to an already-populated table. In a non-TTY
environment that throws `Interactive prompts require a TTY terminal`; `--force`
only "helps" by truncating (data loss). push therefore cannot safely apply such
a change, so pushes got skipped and the dev/test DB silently drifted from
`lib/db/src/schema/*` (missing columns/tables → test failures).

**Canonical sync is now `generate` + `migrate`** (scripts in `lib/db/package.json`,
`out: ./migrations`). `generate` writes a SQL migration from the schema-vs-snapshot
diff; `migrate` applies pending migrations non-interactively and never truncates —
adding a nullable unique constraint is just `ALTER TABLE … ADD CONSTRAINT … UNIQUE`.
Commit `migrations/*.sql` + `migrations/meta/*` with the schema change. Keep `push`
only for throwaway prototyping against an empty DB.

**One blocked constraint aborts the WHOLE push.** The truncate prompt fires
even when the unique *column itself* doesn't exist yet (drizzle plans add-column
+ add-unique as one step). Because push is all-or-nothing, that single prompt
leaves *every other* pending change unapplied too — so seemingly unrelated tests
fail on missing columns (e.g. `column "creator_hash" does not exist`). Fix the
blocking constraint via pool first, then a normal `push` syncs the rest.

**Must be a CONSTRAINT, not an INDEX.** `.unique()` in the schema maps to a
UNIQUE *constraint*; a `CREATE UNIQUE INDEX <same_name>` does NOT satisfy the
diff — drizzle still plans the constraint and re-prompts to truncate. Use
`ALTER TABLE … ADD CONSTRAINT <name> UNIQUE (col)`.

**Workaround:** apply the DDL directly instead of via push — run the exact
`ALTER TABLE … ADD CONSTRAINT <name> UNIQUE (col)` (plus new columns/tables)
through the `pool` from `@workspace/db`, using drizzle's own constraint naming
(`<table>_<col>_unique`, `<table>_<col>_<ref>_id_fk`, `<table>_<cols>_pk`) so a
later `push` sees the schema as already-matching and stays a no-op. Easiest to
run via a throwaway `scripts/src/_tmp.ts` executed with
`pnpm --filter @workspace/scripts exec tsx ./src/_tmp.ts` (tsx lives in scripts;
root/other-package code_execution can't resolve `@workspace/db`).

**Adopting migrations on a pre-existing (push-built) DB:**
`drizzle-kit pull` introspects the live DB into baseline `0000` + snapshot, then
`generate` produces the diff as the next migration. Mark `0000` already-applied by
inserting a row into `drizzle.__drizzle_migrations` with `created_at` = the entry's
`when` (folderMillis from `meta/_journal.json`) — the migrator's skip logic only
compares `created_at`, so this makes `migrate` run only the newer diffs. A fresh
empty DB instead runs every migration from `0000`.

**pull→generate churn is spurious.** Introspection represents existing indexes/FKs
differently than the code does, so the first `generate` emits DROP/CREATE INDEX and
DROP/ADD FK for objects that already match. Verify against the live DB (`pg_indexes`,
`pg_constraint`) and strip that churn from the diff SQL, keeping only the genuinely
additive statements. The `meta/*_snapshot.json` stays canonical (generate reads only
snapshots, never the .sql), so hand-editing the .sql body is safe and future diffs
stay clean.

**`out` must be a RELATIVE path** in `drizzle.config.ts` (e.g. `./migrations`).
An absolute `path.join(__dirname, …)` makes `generate`/`migrate` build a broken
`.//home/...` path (ENOENT); only `pull` tolerates the absolute form.

**The two automatic apply points must BOTH avoid `push`.** (1) Post-merge → dev:
`scripts/post-merge.sh` must run `pnpm --filter @workspace/db run migrate`, NOT
`push`. Post-merge closes stdin, so a `push` truncate prompt gets EOF and fails —
this is the concrete cause of silent dev drift (dev was found ~2 migrations behind:
missing mathmon_* tables, harness_artifacts.sku +constraint, users.creator_hash,
plus the f0_* tables). (2) Publish → prod: prod schema is applied ONLY by Replit's
Publish flow (diffs the current dev DB vs prod, applies additive SQL
non-interactively — it is NOT `drizzle-kit push`, so no truncate prompt). Agent
must never run DDL against prod or add a deploy-build/startup DDL hook; the fix for
a stale prod is "get dev current, then re-Publish". `executeSql(environment:
"production")` is read-only — use it only to VERIFY prod, never to mutate it.

**Committed migrations can silently under-cover the schema.** Even after `migrate`
succeeds, run `generate` once more — if it emits a new file, tables were added to
`src/schema/*` (and index.ts) without a migration ever being generated. Inspect the
new file: all-CREATE/ADD (no DROP churn) = genuine missing tables, commit + migrate
it; DROP/CREATE INDEX or DROP/ADD FK on matching objects = spurious introspection
churn, strip it.
