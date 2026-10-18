---
name: DB migrations must be generated, not just pushed
description: This repo commits drizzle migration files; drizzle-kit push alone leaves deploys broken.
---

# DB schema changes need a committed migration file

`lib/db` uses committed drizzle migrations (`lib/db/migrations/*.sql` + `meta/_journal.json`).
`pnpm --filter @workspace/db run push` (drizzle-kit push) applies schema to the DEV DB but writes NO migration file, so deploys that replay committed migrations fail with missing relation/column errors.

**Why:** code review rejects any schema change (new table / new column in `lib/db/src/schema/*`) that lacks a matching migration file — it is not deploy-safe.

**How to apply:** after editing schema, run `cd lib/db && pnpm run generate` to emit the next `NNNN_*.sql` + update the journal/meta snapshot, then commit it. `generate` captures ALL accumulated drift, so it may also fold in earlier tables that were only ever `push`ed.

## Keep the existing migration history when adopting security templates

Retain the existing migration output directory when adapting the supplied ARK RLS Drizzle template; the user explicitly chose preserving history over changing to the template's output directory.

**Why:** changing the output directory without relocating the journal and migrations points tooling away from the established migration history. The template is not authorization to reset it.

**How to apply:** preserve the established history when updating tooling configuration. Restrict introspection to `public` for the separately SQL-managed ARK security schemas, but do not treat an introspection filter as enforcement over arbitrary SQL in migration files.
