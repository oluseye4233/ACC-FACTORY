# IMPRIMA + SHORT SPRINTS — database security layer (v1.1, Replit-ready)

PostgreSQL 16 migrations for the ATANDA Command Centre (Postgres + Drizzle + Express + Clerk).
Tier 0: tested in a scratch PostgreSQL 16 cluster only; not deployed, not independently reviewed.

## Files

| File | What it does |
| --- | --- |
| `db/rls/000_roles_and_context.sql` | Roles (`ark_owner`, restricted `ark_app`, `ark_app_login`), request-context functions, generic immutability trigger |
| `db/rls/010_imprima.sql` | IMPRIMA tables (PDD Part 4.8), forced RLS, owner-isolation policies, immutable-version triggers, INV-01/07/08 enforcement |
| `db/rls/020_short_sprints.sql` | SHORT SPRINTS tables (PDD Part 4), forced RLS, owner + delegate policies, immutable records, SS-INV enforcement |
| `tests/test_security.sql` | Run as `ark_app_login`: isolation, approver path, immutability, invariants |
| `tests/test_forced_rls.sql` | Run as a superuser: RLS forced on every table and on the owner; triggers hold even for a superuser; no ARK role can bypass RLS |
| `scripts/db/migrate.mjs` | Ledgered migration runner (uses `DATABASE_URL`, the owner) |
| `scripts/db/verify.mjs` | Fail-closed startup check (uses `APP_DATABASE_URL`) |
| `scripts/db/test.sh` | Runs both SQL suites (needs psql; throwaway database) |
| `server/db/withContext.ts` | The only path from request code to the ARK schemas |
| `replit/` | Deployment command, Drizzle fence, rules for Replit Agent |

**v1.1 changes:** no BYPASSRLS helper role (lookup functions run as `ark_owner` through org-scoped read policies); installs as a non-superuser owner with CREATEROLE; migrations are pure SQL (no psql commands). Full build plan: *ARK RLS Layer — ATLAS PDD for Replit*.

## Apply and test

```bash
npm install
DATABASE_URL=...      APP_DB_PASSWORD=... npm run db:migrate   # as the database owner
APP_DATABASE_URL=...  npm run db:verify                        # as ark_app_login
TEST_OWNER_URL=... TEST_APP_URL=... npm run db:test            # throwaway DB only
```

The tests insert fixture rows that cannot be deleted (by design). Run them against a throwaway database.

## The contract with the API

The database trusts the API to say who is asking. At the start of **every transaction** the API sets the context from the verified Clerk session, transaction-local:

```ts
// Drizzle (node-postgres) — wrap every request's work in this.
await db.transaction(async (tx) => {
  await tx.execute(sql`
    select set_config('app.org_id',     ${orgId},          true),
           set_config('app.user_id',    ${clerkUserId},    true),
           set_config('app.user_roles', ${roles.join(',')}, true)`);
  // ...queries...
});
```

If the context is missing, every policy returns nothing and every insert is refused.

## Roles

| Role | Login | Can | Cannot |
| --- | --- | --- | --- |
| `ark_owner` | No | Own schemas, tables and helper functions | Read rows, except through org-scoped lookup policies used by the two helper functions; nothing without a request context |
| `ark_app` | No | SELECT and INSERT; UPDATE only `publish_jobs.state, gro_state` and `ss_runs.status` | DELETE, TRUNCATE, DDL, bypass RLS |
| `ark_app_login` | Yes | Everything `ark_app` can, by inheritance | SET ROLE, create objects in `public` |

Role claims used by policies: `publisher`, `approver` (IMPRIMA), `sphinx_approver` (SHORT SPRINTS promotions).

## Known limits

- **The context is trusted.** Any session can call `set_config`. The protection is that only the API holds `ark_app_login` credentials. Keep that password in Key Vault and never give it to a client.
- **Superusers and `BYPASSRLS` roles bypass RLS**, and a superuser can disable triggers. Azure's admin role must not be used by the application. Audit who holds it.
- **Route order is not enforced here.** `ss_runs.status` can move in any order the owner chooses. The F9 → F9.5 → F10 checks belong in a status trigger (next step) or the API.
- **Approver ≠ publisher is not enforced.** IMPRIMA's PDD requires a named approval, not a different person. Add `CHECK` logic if OD-IMP-05 decides it.
- **Author is a human (IMP-02)** cannot be proven in SQL; the API must set the author token from the Clerk profile.
- **Consider revoking `TEMP`** on the database from `PUBLIC` in production. The test scripts use temporary functions, so tests need it.
