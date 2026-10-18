# Rules for Replit Agent in this Repl

1. Never edit, replace, rename or delete existing migration files in `db/rls/`. To change the security layer, add a new, uniquely numbered file (e.g. `030_...sql`) and obtain human review before applying or publishing it. Never reset the ARK migration ledger, change a recorded checksum or mark an unexecuted migration as applied to bypass a failure.
2. Never run `drizzle-kit push`, `drizzle-kit drop` or raw `DROP`/`ALTER ... DISABLE`/`NO FORCE` against the `imprima`, `short_sprints`, `app` or `ark_meta` schemas. Keep `schemaFilter: ["public"]` in `lib/db/drizzle.config.ts` and retain its existing `out: "./migrations"` history. The filter limits schema introspection; it does not sandbox arbitrary SQL in migration files.
3. Application requests reach the protected ARK schemas only through `withContext()` in `server/db/withContext.ts`, using the restricted `APP_DATABASE_URL` connection. Derive organization, user and role context from verified authentication, never from caller-supplied identity fields. Never use `DATABASE_URL`, a database-owner connection or a superuser fallback for request access to those schemas. The owner connection is reserved for the authorized ARK migration step; the verifier uses `APP_DATABASE_URL`. Existing `public`-schema application access and its separate artifact-operation role/context remain separate: do not claim they are protected by the new ARK wrapper or silently replace their data model.
4. Never add DELETE endpoints for IMPRIMA or SHORT SPRINTS records. Corrections are new versions. Do not bypass this rule with destructive updates, cascading deletes or disabled immutability triggers.
5. If `pnpm run db:migrate` or `pnpm run db:verify` fails, stop and report. Do not "fix" it by weakening a check, changing to an owner connection, skipping a step or treating failure as success. Use pnpm; this workspace intentionally rejects npm installation.

## Deployment contract

Production API startup is controlled by
`artifacts/api-server/.replit-artifact/artifact.toml`, not `.replit`'s `run`
setting. Preserve this fail-closed order:

```sh
pnpm run db:migrate && pnpm run db:verify && exec node --enable-source-maps artifacts/api-server/dist/index.mjs
```

The `.replit` pre-build hook uses `pnpm install --frozen-lockfile`; the API
artifact retains its own build command. Preserve artifact paths, ports and
production environment settings. Update deployment configuration only through
the platform's validated configuration replacement tools.

The user has authorized the deployment startup chain. This does not authorize
the Agent to execute production migrations as a validation step or add silent
startup repairs. Run `pnpm run db:test` only against an explicitly designated
throwaway database: its SQL fixtures include deliberately immutable records.

## Activation and verification boundaries

Installing these files or passing the simulated startup-chain tests does not
prove production RLS enforcement. The real migrations and verifier must succeed,
and protected request handlers must use the restricted connection and verified
transaction context before claiming the ARK-protected workflows are active.
Never use a passing check on a separate connection as proof of the application's
runtime privileges.

Keep existing private preparation workflows distinct from protected approval,
certification, marketplace qualification and release. Missing protections must
not activate those operations or select a privileged fallback.
