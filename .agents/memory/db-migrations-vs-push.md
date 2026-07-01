---
name: DB migrations must be generated, not just pushed
description: This repo commits drizzle migration files; drizzle-kit push alone leaves deploys broken.
---

# DB schema changes need a committed migration file

`lib/db` uses committed drizzle migrations (`lib/db/migrations/*.sql` + `meta/_journal.json`).
`pnpm --filter @workspace/db run push` (drizzle-kit push) applies schema to the DEV DB but writes NO migration file, so deploys that replay committed migrations fail with missing relation/column errors.

**Why:** code review rejects any schema change (new table / new column in `lib/db/src/schema/*`) that lacks a matching migration file — it is not deploy-safe.

**How to apply:** after editing schema, run `cd lib/db && pnpm run generate` to emit the next `NNNN_*.sql` + update the journal/meta snapshot, then commit it. `generate` captures ALL accumulated drift, so it may also fold in earlier tables that were only ever `push`ed.
