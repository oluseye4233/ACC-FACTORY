# Rules for Replit Agent in this Repl

1. Never edit files in `db/rls/`. To change the security layer, add a new numbered file (e.g. `030_...sql`) and ask a human to review it.
2. Never run `drizzle-kit push`, `drizzle-kit drop` or raw `DROP`/`ALTER ... DISABLE`/`NO FORCE` against the `imprima`, `short_sprints`, `app` or `ark_meta` schemas.
3. Server code reaches those schemas only through `withContext()` in `server/db/withContext.ts`, using `APP_DATABASE_URL`. Never use `DATABASE_URL` in request-handling code.
4. Never add DELETE endpoints for IMPRIMA or SHORT SPRINTS records. Corrections are new versions.
5. If `npm run db:verify` fails, stop and report. Do not "fix" it by weakening a check.
