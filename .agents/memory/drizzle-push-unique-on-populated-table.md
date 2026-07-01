---
name: drizzle-kit push — unique constraint on a populated table
description: Why `pnpm --filter @workspace/db run push` (and push-force) can hang/fail non-interactively, and the safe workaround.
---

Adding a `.unique()` column/constraint to an already-populated table makes
`drizzle-kit push` emit an interactive "Do you want to truncate <table>?"
prompt. In this non-TTY agent environment that throws
`Interactive prompts require a TTY terminal`. **`--force` (push-force) does NOT
skip this** — the truncate suggestion runs before the force path.

**Never answer "yes"/truncate.** For a NULLABLE unique column the constraint is
safe to add as-is: Postgres treats NULLs as distinct, so existing null rows
never violate uniqueness.

**Workaround:** apply the DDL directly instead of via push — run the exact
`ALTER TABLE … ADD CONSTRAINT <name> UNIQUE (col)` (plus new columns/tables)
through the `pool` from `@workspace/db`, using drizzle's own constraint naming
(`<table>_<col>_unique`, `<table>_<col>_<ref>_id_fk`, `<table>_<cols>_pk`) so a
later `push` sees the schema as already-matching and stays a no-op. Easiest to
run via a throwaway `scripts/src/_tmp.ts` executed with
`pnpm --filter @workspace/scripts exec tsx ./src/_tmp.ts` (tsx lives in scripts;
root/other-package code_execution can't resolve `@workspace/db`).
