# ARK RLS Layer — ATLAS PDD for Replit

Oct 17, 2026 · @oluseye amusa

## Part 0 — Title and contents

This PDD tells a Replit build team, and Replit Agent, how to install and run the database security layer for IMPRIMA and SHORT SPRINTS: a restricted application role, owner-isolation policies, forced row-level security and immutable-version triggers. The SQL is written and tested; this document is how it goes into a Replit App without losing any of its protections on the way to production.

| Field | Value |
| --- | --- |
| Document | ARK RLS Layer — ATLAS PDD for the Replit build environment, v1.0 |
| Production ID | JNGL-ARKH-PDD-RLS-2026-001 (checked only against IDs visible in project documents) |
| Standard | ATLAS 360 PLAN v4.0.1, 12-Part PDD |
| Builds | `ark_rls` package v1.1: three SQL migrations, a migration runner, a startup verifier, a request-context helper, two test suites, Replit config examples |
| Serves | IMPRIMA Upgrade PDD v1.1 (JNGL-PDD-IMPRIMA-2026-001); SHORT SPRINTS PDD v1.1 (JNGL-ARKH-PDD-SS-2026-001); ARK Harness Upgrade PDD prerequisite UPG-SEC-001 |
| Target | A Replit App on Replit's PostgreSQL 16 database ("Helium"), Node.js, Express, Drizzle, Clerk |
| Author / Principal | OLUSEYE AMUSA — Junglenomics · Koncentric Labs · Idea Factory |
| Drafting model | Claude (claude-opus-5-5). AI-drafted; requires human review |
| Status | DRAFT v1.0 — Tier 0. Code tested in a local PostgreSQL 16 cluster that mimics Replit's owner role; **not yet run on Replit** |
| JCSE | Not asserted |
| GRO mode | SAFE\_LIFE: security controls; any weakening needs a named human |

**What changed from the first SQL drop (v1.0 → v1.1).** Three changes so the layer installs on Replit, where the database owner is not a superuser:

1. **No role can bypass row-level security.** v1.0 used a helper role with BYPASSRLS; v1.1 removes it. The two lookup functions now run as the table owner through read-only, organisation-scoped policies.
2. **A non-superuser can install it.** The migrator grants itself the right to act as `ark_owner`, so the database owner Replit provides is enough.
3. **Pure SQL.** The migrations no longer use psql commands, so a Node runner can apply them inside Replit's deployment.

| Part | Contents |
| --- | --- |
| 1 | Requirements, invariants enforced, reconciliation |
| 2 | Business case, validation, risks |
| 3 | SPC roster |
| 4 | Platform specifics for Replit |
| 5 | Atomic prompt worksheet for Replit Agent |
| 6 | DJ implementation plan and acceptance gates |
| 7–11 | Sources, terms, IP, security, regulatory |
| A–C | Open decisions, Honesty Gate, version history |

## Part 1 — Requirements

*Owning SPCs: ADA + SPARTAN*

**Purpose.** IMPRIMA stores documents that must never change once published; SHORT SPRINTS stores gate decisions, verification results and certificates that must never be edited. Both hold one person's work inside one organisation. The application cannot be the only thing standing between users and each other's data: SEC REP ONE found no row-level security in the Command Centre at all. This layer puts the rules in the database, where a bug in an API route cannot undo them.

### Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| RLS-FR-01 | The application connects as a restricted login role that cannot bypass row-level security, change tables, delete or truncate | P0 |
| RLS-FR-02 | Every row carries an organisation and an owner; users see and write only their own rows inside their own organisation | P0 |
| RLS-FR-03 | Row-level security is enabled and **forced** on every table, so the table owner is filtered too | P0 |
| RLS-FR-04 | Published records refuse UPDATE, DELETE and TRUNCATE from every role, superusers included unless they disable triggers | P0 |
| RLS-FR-05 | Re-publishing creates the next version in a gap-free, fork-free chain (IMPRIMA documents, SHORT SPRINTS spec sheets) | P0 |
| RLS-FR-06 | IMPRIMA approvers may read a job only while it awaits approval, and only an approver may approve | P0 |
| RLS-FR-07 | SHORT SPRINTS run owners may name delegates who can see the run and answer its gates; only the owner changes the run's status | P0 |
| RLS-FR-08 | The API sets organisation, user and role claims per transaction from the verified Clerk session; with no context, nothing is visible | P0 |
| RLS-FR-09 | Migrations apply once each, in order, with a checksum ledger; an edited migration is refused | P0 |
| RLS-FR-10 | The app refuses to start if any protection is missing in the database it is about to serve | P0 |
| RLS-FR-11 | The layer installs on Replit's database as its non-superuser owner | P0 |
| RLS-FR-12 | drizzle-kit and Replit Agent cannot alter the protected schemas | P0 |

### Invariants the database enforces

Register IDs from the ARK Harness Invariant Register v1.0.

| Register ID | Rule | How |
| --- | --- | --- |
| IMP-01 | Five-token filename | CHECK on `document_files.filename` |
| IMP-06 | Scores never merged | Separate nullable columns; no composite column exists |
| IMP-07 | Published means immutable | Append-only triggers; linear version chain |
| IMP-08 | A human signs Final | Insert trigger requires an approval for the job |
| — (IMPRIMA G-Honesty) | No Final over a HOLD without a written override | Insert trigger; override reason ≥ 20 characters |
| — (IMPRIMA G-Parity) | All formats share one content hash | Insert trigger on `document_files` |
| SS-02 | Only a named human answers a gate | Owner or delegate policy; YES refused if any eligibility rule failed |
| SS-03 | Firmware passes F9 with outside evidence | CHECK on `ss_mecha_results` |
| SS-04 | F9.5 and F10–F12 are never skipped | CHECK on skips and certificates |
| SS-05 | Skipped means recorded | Append-only `ss_stage_skips` |
| SS-06 | A skipped stage is never shown as passed | CHECK on certificates |
| XVL-01 | No stage grades its own work | CHECK: a PASS pack needs independence I1 or higher |

### Reconciliation

| ID | Issue | Ruling |
| --- | --- | --- |
| XR-01 | IMPRIMA and the Upgrade PDD name Azure (Container Apps, PostgreSQL, Key Vault) as the hosting target; this build is on Replit | Replit is the build and pilot environment. The SQL is plain PostgreSQL 16 and moves to Azure unchanged; only the runner's secrets and deploy command differ |
| XR-02 | Replit's database moved from Neon to "Helium" on 4 December 2025 | Design targets Helium (PostgreSQL 16). Legacy Neon databases also run PostgreSQL 16 and should work, but are not tested |
| XR-03 | v1.0 of the SQL used a BYPASSRLS helper role | Removed in v1.1 (Part 0). Better on any host; required where the owner cannot create BYPASSRLS roles |
| XR-04 | Replit applies dev schema changes to production when you publish; its docs do not say whether policies, triggers or functions are carried | Do not rely on it. The deployment runs the migrator itself, and the verifier refuses to start if anything is missing (Part 4.6) |
| XR-05 | Route order (F9 → F9.5 → F10) is not enforced in SQL | Out of scope, as in the SQL drop. Next migration (RLS-RTE-001, P1) |

## Part 2 — Business case, validation and risks

*Owning SPCs: PLUTUS + SOCRATES*

**Value.** Two Tier 0 products move one step toward a defensible security claim. SEC REP ONE's first critical finding (no row-level security) and UPG-SEC-001 are closed for these two schemas, with evidence a reviewer can rerun. The pattern — restricted role, forced RLS, append-only records, a verifier that refuses to start — becomes the template for the rest of the Command Centre. Building on Replit keeps the pilot cheap and fast; the SQL itself is not tied to Replit.

### Validation already done

Run on 17 October 2026 in a local PostgreSQL 16.15 cluster. The installer ran as a non-superuser owner with CREATEROLE and no BYPASSRLS, mimicking Replit's database owner.

| Check | Result |
| --- | --- |
| App-role suite (`tests/test_security.sql`, as `ark_app_login`) | 57 checks pass |
| Owner and superuser suite (`tests/test_forced_rls.sql`) | 13 checks pass, including "no ARK role holds BYPASSRLS" |
| Migration runner: fresh install, rerun, `--check` | Applied 3; rerun no-op; check exit 0 |
| Runner refuses an edited migration | Exit 4 |
| Runner refuses unprotected ARK tables with no ledger | Exit 3 |
| Verifier refuses a disabled trigger and un-forced RLS | Exit 1, two failures named |
| Verifier refuses an empty database | Exit 1 |
| Startup verifier on a correct install | 13 checks pass |

### Validation still needed on Replit

1. Install on a Replit development database; run `npm run db:migrate`, `db:verify` and `db:test` (Part 6, gate R1).
2. Publish once to a deployment and confirm the production database has every policy and trigger (`db:verify` in the deploy log).
3. Confirm what Replit's publish-time schema sync does with the protected schemas (OD-RLS-01).

### Risks

| Risk | Effect | Control |
| --- | --- | --- |
| Replit's publish sync creates ARK tables in production without RLS or triggers | Unprotected production data | Runner stops on unledgered ARK tables (exit 3); verifier refuses to start |
| Replit's sync drops or rewrites policies it does not recognise | Silent loss of protection | Verifier runs on every start and every deploy |
| Agent runs `drizzle-kit push` and drops policies | Silent loss of protection | `schemaFilter: ["public"]`; AGENT\_RULES.md; verifier |
| Request code uses the owner's `DATABASE_URL` | The owner has no table grants, so queries fail; but it can run DDL | Separate `APP_DATABASE_URL`; `withContext()` is the only path; code review rule |
| The production owner role is a superuser or has BYPASSRLS | Owner could read everything | Verifier checks the **app** role; the owner never serves requests. Record what the owner is (OD-RLS-02) |
| Role passwords do not migrate to production on Replit | App cannot connect | Runner sets `ark_app_login`'s password from the `APP_DB_PASSWORD` secret on every deploy |
| A forged context from an attacker who holds the app password | Impersonation of any user | Password only in Replit Secrets; never shipped to a client; rotate on suspicion |

## Part 3 — SPC roster

*Owning SPC: ATLAS 360 PLAN*

| SPC | Role here |
| --- | --- |
| **ADA ULTRA SI** | Architect and builder: SQL, runner, verifier, context helper |
| **ARES** | Security owner: SEC REP ONE closure for these schemas; reviews any change to `db/rls/` |
| **BUGMXT** | Runs the test suites and failure-path tests before each release |
| **MATHMON** | Owns the invariant mapping (Part 1) and the future route-order migration |
| **OSIRIS** | Custody: the migration ledger and checksums are the custody record for the security layer |
| **SPARTAN** | Keeps the scope to two schemas; defers the rest of the Command Centre to later migrations |
| **CODE DJ** | Repository layout, scripts, Drizzle configuration |
| **HOST DJ** | Replit Secrets, deployment command, production database |
| **VIBE DJ** | Confirms Replit as the build environment and records its limits |
| **Replit Agent** | Executes Part 5 prompts under AGENT\_RULES.md; never changes `db/rls/` |

## Part 4 — Platform specifics for Replit

*Owning SPCs: ADA + HOST DJ + CODE DJ*

### 4.1 What Replit provides

| Item | Replit behaviour (per Replit docs, October 2026) | Consequence here |
| --- | --- | --- |
| Database | PostgreSQL 16 ("Helium"), separate development and production databases; reachable only from inside the app | PG16 role syntax (`WITH INHERIT …, SET …`) is available |
| Connection | `DATABASE_URL` secret; `PGHOST`/`PGUSER`/`PGPASSWORD` were removed in the Helium upgrade | Used only by the migrator. The app gets a second secret, `APP_DATABASE_URL` |
| Schema to production | Structure changes Agent made in development are applied to production when you publish | Not trusted for policies and triggers; the deploy command runs the migrator and verifier |
| Roles | "Roles and permissions migrate automatically, but role passwords can't be copied" | The migrator sets `ark_app_login`'s password from a secret on every deploy |
| Agent | Can change the development database only | AGENT\_RULES.md keeps it out of the protected schemas |
| Pooling | Off by default; frameworks manage their own pool | `pg.Pool` in `withContext.ts`; context is transaction-local, so pooling is safe |
| SSL | Forced SSL can fail on Helium | Runner leaves SSL to the connection string unless `DB_SSL=true` |

### 4.2 Roles and connections

| Role | Login | Used by | Holds |
| --- | --- | --- | --- |
| Replit owner (from `DATABASE_URL`) | Yes | The migrator only, at deploy time | CREATEROLE; may act as `ark_owner`; owns `ark_meta` |
| `ark_owner` | No | Owns schemas, tables, triggers, helper functions | No row access except org-scoped lookup policies used by the helpers |
| `ark_app` | No | Group role with the app's privileges | SELECT, INSERT; UPDATE on two status columns; no DELETE, TRUNCATE or DDL |
| `ark_app_login` | Yes | The Express server, via `APP_DATABASE_URL` | Inherits `ark_app`; cannot SET ROLE; 30 s statement timeout |

No ARK role holds SUPERUSER or BYPASSRLS (checked by the test suite and the verifier).

### 4.3 Secrets

| Secret | Value | Who reads it |
| --- | --- | --- |
| `DATABASE_URL` | Provided by Replit | `scripts/db/migrate.mjs` only |
| `APP_DB_PASSWORD` | A long random string you generate | The migrator, to set `ark_app_login`'s password |
| `APP_DATABASE_URL` | `DATABASE_URL` with user `ark_app_login` and `APP_DB_PASSWORD` | The server and `verify.mjs` |

Set all three separately for development and for the deployment. Never print them in logs; rotate `APP_DB_PASSWORD` if it leaks (the next deploy applies it).

### 4.4 Repository layout

```
db/rls/000_roles_and_context.sql   roles, request-context functions, immutability trigger
db/rls/010_imprima.sql             IMPRIMA: 10 tables, forced RLS, policies, triggers
db/rls/020_short_sprints.sql       SHORT SPRINTS: 12 tables, forced RLS, policies, triggers
scripts/db/migrate.mjs             ledgered runner (DATABASE_URL)
scripts/db/verify.mjs              fail-closed startup check (APP_DATABASE_URL)
scripts/db/test.sh                 runs both SQL suites (needs psql; throwaway DB only)
server/db/withContext.ts           the only path from request code to the ARK schemas
tests/test_security.sql            57 checks as ark_app_login
tests/test_forced_rls.sql          13 checks as owner / superuser
replit/replit.toml.example         deployment build and run commands
replit/drizzle.config.example.ts   schemaFilter: ["public"]
replit/AGENT_RULES.md              five rules for Replit Agent
```

### 4.5 Deployment sequence

```
[deployment]
build = ["sh", "-c", "npm ci && npm run build"]
run   = ["sh", "-c", "npm run db:migrate && npm run db:verify && node dist/index.js"]
```

`db:migrate` applies pending files once each and records their checksums in `ark_meta.schema_migrations`. `db:verify` connects as the app and checks: the app role cannot bypass RLS; all 22 tables exist with RLS enabled and forced; the immutability trigger is enabled on all 20 append-only tables; at least 49 policies exist; the app holds no DELETE, TRUNCATE, TRIGGER or REFERENCES grant; every migration file's checksum matches the ledger; and with no request context the app sees no rows. Any failure stops the process before the server starts.

### 4.6 When Replit's publish sync gets there first

If ARK tables exist in production but the ledger is empty, the migrator stops with exit code 3 and lists them. That means something other than the migrator created them, probably Replit's schema sync, and they may have no RLS or triggers. A human must then:

1. Keep the app offline (the verifier will already refuse to start).
2. Confirm the tables are empty, or export their rows.
3. Drop the unprotected schemas as the database owner, then redeploy so the migrator builds them correctly.
4. Record what happened against OD-RLS-01.

### 4.7 Request context

Every request that touches IMPRIMA or SHORT SPRINTS goes through `withContext()`:

```ts
await withContext({ orgId, userId, roles }, async (tx) => {
  // set_config('app.org_id' | 'app.user_id' | 'app.user_roles', ..., true) runs first
  return tx.execute(sql`SELECT * FROM imprima.publish_jobs`);
});
```

`orgId`, `userId` and `roles` come only from Clerk's verified session (`getAuth(req)`), never from the request body. Role claims: `publisher`, `approver`, `sphinx_approver`.

### 4.8 Drizzle

drizzle-kit stays inside `public` (`schemaFilter: ["public"]`). For typed queries against the ARK tables, declare them in Drizzle with `pgSchema("imprima")` for reading and inserting, but never let drizzle-kit generate or push migrations for those schemas. Migrations for them are hand-written SQL files in `db/rls/`.

### 4.9 The SQL, in one view

| Control | IMPRIMA (`010`) | SHORT SPRINTS (`020`) |
| --- | --- | --- |
| Tables | 10 | 12 |
| Append-only (UPDATE, DELETE, TRUNCATE refused) | 9 | 11 |
| Mutable with frozen identity | `publish_jobs` (state, GRO state only; frozen when PUBLISHED or FAILED) | `ss_runs` (status only; frozen when RELEASED, WITHDRAWN or PROMOTED) |
| Version chain trigger | `document_versions` | `ss_sass_versions` |
| Rule triggers | Final needs approval; HOLD needs override; file hash parity | YES needs all eligibility rules passed; gate matches circuit; promotion re-entry stage |
| CHECK rules | Five-token filename; hashes are 64 hex; design score 0–50 | PASS pack needs I1+; F9 PASS needs outside evidence; F9.5 never skipped; certificate never lists a skipped stage as passed |
| Read exceptions | Approvers, while a job awaits approval | Delegates of a run |

## Part 5 — Atomic prompt worksheet

*Owning SPCs: ATLAS 360 PLAN + CORDON*

Each row is one instruction for Replit Agent or a named builder, with a check that proves it is done. 28 prompts in 9 features, 34 dependencies, 10 waves. A script computed the waves, found no cycles and applied priority inheritance (no priority changed).

| Measure | Value |
| --- | --- |
| Atomic prompts | 28 in 9 features |
| Dependencies | 34 |
| Build waves | 10 |
| Starting points | 2: RLS-SET-001, RLS-GOV-001 |
| End points | 11 |
| Cycles | 0 |
| Priority | P0 23 · P1 5 (unchanged by inheritance) |

**Critical path (10 waves).** RLS-SET-001 → SET-004 → DRZ-001 → MIG-001 → MIG-003 → VER-001 → DEP-001 → DEP-002 → DEP-003 → GOV-002. Drizzle is fenced off before the first migration runs, so drizzle-kit can never see the protected schemas.

**SET — Setup and secrets** (5 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-SET-001 | Create the Replit App on PostgreSQL 16 (Helium); confirm the Settings tab shows helium, not neon.tech. | HOST DJ | P0 | — | — | W1 |
| RLS-SET-002 | Generate a 40+ character random APP\_DB\_PASSWORD and store it in Replit Secrets for development and for the deployment. | HOST DJ | P0 | RLS-SET-001 | — | W2 |
| RLS-SET-004 | Copy the ark\_rls package into the repo with the layout in Part 4.4; add pg as a dependency and the db:\* scripts to package.json. | CODE DJ | P0 | RLS-SET-001 | ark\_rls v1.1 | W2 |
| RLS-SET-003 | Add APP\_DATABASE\_URL to Secrets: DATABASE\_URL with user ark\_app\_login and password APP\_DB\_PASSWORD, for each environment. | HOST DJ | P0 | RLS-SET-002 | — | W3 |
| RLS-SET-005 | Add replit/AGENT\_RULES.md to the Agent instructions so Agent never edits db/rls/ or runs drizzle-kit push on the protected schemas. | CODE DJ | P0 | RLS-SET-004 | — | W3 |

**DRZ — Drizzle** (2 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-DRZ-001 | Set schemaFilter: \["public"\] in drizzle.config.ts; confirm drizzle-kit introspect lists no imprima, short\_sprints, app or ark\_meta tables. | CODE DJ | P0 | RLS-SET-004 | — | W3 |
| RLS-DRZ-002 | Declare read and insert models for the ARK tables with pgSchema("imprima") and pgSchema("short\_sprints"), excluded from drizzle-kit generation. | CODE DJ | P1 | RLS-DRZ-001 | — | W4 |

**MIG — Migrations** (4 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-MIG-001 | Run npm run db:migrate against the development database; expect three files applied and ark\_meta.schema\_migrations to list them. | ADA | P0 | RLS-SET-004, RLS-DRZ-001 | — | W4 |
| RLS-MIG-002 | Rerun npm run db:migrate; expect every file reported ok and nothing applied. | ADA | P0 | RLS-MIG-001 | — | W5 |
| RLS-MIG-003 | Confirm the migrator set ark\_app\_login's password: connect with APP\_DATABASE\_URL and SELECT current\_user. | ADA | P0 | RLS-MIG-001, RLS-SET-003 | — | W5 |
| RLS-MIG-004 | Record whether the Replit owner role is SUPERUSER or BYPASSRLS (SELECT rolsuper, rolbypassrls FROM pg\_roles WHERE rolname = current\_user) in OD-RLS-02. | ARES | P0 | RLS-MIG-001 | — | W5 |

**VER — Startup verifier** (2 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-VER-001 | Run npm run db:verify in development; expect 13 PASS and "Database security verified." | ADA | P0 | RLS-MIG-003 | — | W6 |
| RLS-VER-002 | On a scratch copy, disable one immutability trigger and un-force RLS on one table; confirm db:verify exits 1 naming both; restore. | BUGMXT | P0 | RLS-VER-001 | — | W7 |

**TST — Test suites** (3 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-TST-001 | Create a throwaway development database or Repl and install the PostgreSQL client so psql is available. | BUGMXT | P0 | RLS-MIG-001 | Replit Nix packages | W5 |
| RLS-TST-002 | Run npm run db:test on the throwaway database; expect ALL TESTS PASSED and 70 PASS lines. | BUGMXT | P0 | RLS-TST-001, RLS-MIG-003 | — | W6 |
| RLS-TST-003 | Edit a copy of an applied migration and rerun db:migrate on the throwaway database; confirm exit 4 and no change. | BUGMXT | P0 | RLS-TST-002 | — | W7 |

**CTX — Request context** (4 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-CTX-001 | Add server/db/withContext.ts; the pool connects with APP\_DATABASE\_URL and sets app.org\_id, app.user\_id and app.user\_roles transaction-locally. | ADA | P0 | RLS-SET-003, RLS-SET-004 | — | W4 |
| RLS-CTX-002 | Derive orgId, userId and roles only from Clerk getAuth(req) and session claims; reject requests without an organisation. | ADA | P0 | RLS-CTX-001 | Clerk org claims | W5 |
| RLS-CTX-003 | Add a lint rule or code check that fails the build if request handlers import DATABASE\_URL or query imprima or short\_sprints outside withContext(). | ADA | P0 | RLS-CTX-001 | — | W5 |
| RLS-CTX-004 | Write two API tests: user B cannot read user A's publish job; a request with no Clerk organisation gets no rows. | BUGMXT | P1 | RLS-CTX-002, RLS-VER-001 | — | W7 |

**DEP — Deployment** (4 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-DEP-001 | Set the deployment build and run commands from replit/replit.toml.example so the server starts only after db:migrate and db:verify succeed. | HOST DJ | P0 | RLS-VER-001, RLS-CTX-001 | — | W7 |
| RLS-DEP-002 | Publish to a deployment preview; confirm the deploy log shows the migrations applied and 13 verifier PASS lines against the production database. | HOST DJ | P0 | RLS-DEP-001, RLS-SET-003 | — | W8 |
| RLS-DEP-003 | Inspect production with the Database tool: schemas imprima and short\_sprints exist, policies and triggers present, no unprotected copies created by the publish sync. | ARES | P0 | RLS-DEP-002 | — | W9 |
| RLS-DEP-004 | Rotate APP\_DB\_PASSWORD once in production and redeploy; confirm the app reconnects. | HOST DJ | P1 | RLS-DEP-003 | — | W10 |

**GOV — Governance** (3 prompts)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-GOV-001 | Treat ark\_meta.schema\_migrations and the db/rls file checksums as the custody record; export them with each release. | OSIRIS | P0 | — | — | W1 |
| RLS-GOV-003 | Require a named reviewer for any new file in db/rls/; add it to the repository's review rules. | ARES | P1 | RLS-SET-005 | — | W4 |
| RLS-GOV-002 | Record the SEC REP ONE finding on missing row-level security as closed for the imprima and short\_sprints schemas only, with the test and verifier output as evidence. | ARES | P0 | RLS-GOV-001, RLS-DEP-003 | SEC REP ONE | W10 |

**RTE — Next migration** (1 prompt)

| ID | Atomic prompt | Owner | P | Depends on | External prerequisite | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| RLS-RTE-001 | Write migration 030 adding a status trigger on ss\_runs that refuses IN\_F9\_5 without a PASS pack (and an F9 PASS for firmware) and IN\_F10 without a custody record. | MATHMON | P1 | RLS-DEP-003 | SS-RTE-001 | W10 |

## Part 6 — DJ implementation plan

*Owning SPCs: VIBE DJ + CODE DJ + HOST DJ*

**VIBE DJ.** Replit is fit for this layer: it runs PostgreSQL 16, lets the database owner create roles, and keeps the database inside the app. Its one weak point for this design is the publish-time schema sync, which the runner and verifier fence off. Azure stays the production target named in the IMPRIMA and Upgrade PDDs; the same SQL moves there unchanged.

### Releases and gates

| Release | Waves | Delivers | Exit gate (all must pass) |
| --- | --- | --- | --- |
| **R1 — Development install** | W1–W7 | Secrets, repo layout, Drizzle fence, migrations in development, verifier, test suites, request context | `db:migrate` applied 3 and reruns clean; `db:verify` 13 PASS; `db:test` 70 PASS on a throwaway database; tamper test exits 4; disabled-control test exits 1 |
| **R2 — Production** | W7–W9 | Deployment command, first publish, production inspection | Deploy log shows migrations and 13 verifier PASS against production; production has both schemas with policies and triggers and nothing unprotected; OD-RLS-01 answered |
| **R3 — Hardening** | W10 | Password rotation, review rule, SEC REP ONE evidence, route-order migration | Rotation reconnects; finding recorded as closed for these two schemas only; migration 030 written with its own tests |

### Gates in every build

| Gate | Check | Blocks |
| --- | --- | --- |
| G-Ledger | Every `db/rls` file applied once with a matching checksum | Deploy |
| G-Verify | All verifier checks pass as `ark_app_login` | Server start |
| G-Fence | drizzle-kit `schemaFilter` excludes the ARK schemas | Merge |
| G-Path | No request handler touches the ARK schemas outside `withContext()` | Merge |
| G-Review | A named reviewer approved any new `db/rls` file | Merge |
| G-Tests | 70 SQL checks and the failure-path tests pass | Release |

### Rollback

Migrations are forward-only. A bad migration is fixed by a new numbered file, never by editing or deleting an applied one. If a deploy fails the verifier, the new server never starts. Whether Replit keeps the previous deployment serving in that case is not confirmed; check it during R2 (OD-RLS-07). Fix forward and redeploy. Replit's time-travel restore exists for the development database, but restoring production data is a decision for a named human because the records are meant to be permanent.

## Part 7 — Sources

| Source | Used for | How read |
| --- | --- | --- |
| [Replit docs: Development and production databases](https://docs.replit.com/cloud-services/storage-and-databases/production-databases) | Helium, PostgreSQL 16, publish-time schema changes, role migration, DATABASE\_URL, pooling, SSL | Read 17 Oct 2026 |
| [Replit docs: SQL database](https://docs.replit.com/cloud-services/storage-and-databases/sql-database) | Move from Neon on 4 Dec 2025; storage limits | Read 17 Oct 2026 |
| PostgreSQL 16 documentation | Role grants, FORCE ROW LEVEL SECURITY, triggers \[EXT-K\] | Drafting model's knowledge; behaviour confirmed by the tests |
| ark\_rls package v1.1 and its test output | Every control and every count in this PDD | Written and run 17 Oct 2026 |
| IMPRIMA Upgrade PDD v1.1; SHORT SPRINTS PDD v1.1 | Data models and invariants | Read in full |
| ARK Harness Invariant Register v1.0 | Register IDs | Read in full |

## Part 8 — Terms

| Term | Meaning |
| --- | --- |
| Row-level security (RLS) | PostgreSQL rules that decide, row by row, what a role can see or write |
| Forced RLS | RLS that applies to the table owner too |
| Restricted role | `ark_app_login`: the only role the server uses; cannot bypass RLS, delete, truncate or change tables |
| Owner isolation | Each row has an organisation and an owner; users reach only their own rows |
| Request context | Organisation, user and role claims the API sets at the start of each transaction |
| Immutable-version trigger | A trigger that refuses changes to a published record and keeps version chains linear |
| Migration ledger | `ark_meta.schema_migrations`: which SQL files ran, with their checksums |
| Helium | Replit's current PostgreSQL 16 database infrastructure |

## Part 9 — IP

The SQL, scripts and this PDD are Junglenomics work owned by the Principal. Replit, PostgreSQL, Drizzle and Clerk are third-party names used to describe the build environment; no affiliation is implied. The package depends on `pg` and `drizzle-orm` (open-source licences; check before redistribution).

## Part 10 — Security

- **Trust boundary.** The database trusts the context the API sets. Anyone holding `APP_DATABASE_URL` can claim any user. It lives only in Replit Secrets and is never sent to a browser.
- **Owner credentials.** `DATABASE_URL` is used only by the migrator at deploy time. Request code must not import it (gate G-Path).
- **Privilege.** No ARK role holds SUPERUSER or BYPASSRLS. Replit's own owner role may; record it (OD-RLS-02). Triggers stop superusers too, unless a superuser disables them, which the verifier then catches at the next start.
- **Logging.** The migrator sets a password with `ALTER ROLE`; if statement logging is on, that statement can appear in database logs. Keep statement logging off for the migrator or rotate after enabling it.
- **Scope.** This closes the missing-RLS finding for the IMPRIMA and SHORT SPRINTS schemas only. The rest of the Command Centre still lacks it.

## Part 11 — Regulatory

Nothing here claims compliance with any standard. The controls support, without proving, the access-control and audit-trail expectations common to GDPR (personal data of authors and approvers), the EU AI Act's record-keeping duties for AI-assisted documents, and ISO/IEC 27001 access control \[EXT-K\]. Conformity state for every row: Mapped. Not legal advice.

## Appendices

### A — Open decisions

- [ ] OD-RLS-01: What does Replit's publish-time schema sync do with policies, triggers and functions in non-public schemas? Answer from the first R2 deploy (RLS-DEP-003)
- [ ] OD-RLS-02: Is Replit's database owner role SUPERUSER or BYPASSRLS? Record from RLS-MIG-004
- [ ] OD-RLS-03: Where do the SQL test suites run: a throwaway Repl with psql, or CI outside Replit?
- [ ] OD-RLS-04: Approver ≠ publisher for IMPRIMA Final documents (depends on OD-IMP-05)
- [ ] OD-RLS-05: Approve migration 030 (route order) for R3
- [ ] OD-RLS-06: When to apply the same pattern to the rest of the Command Centre schemas
- [ ] OD-RLS-07: Confirm whether Replit keeps the previous deployment serving when a new deployment's run command exits

### B — Honesty Gate

| Claim | Status |
| --- | --- |
| The SQL enforces the controls described | Tested: 70 SQL checks, 4 failure-path tests and the verifier, on local PostgreSQL 16.15 |
| It installs as a non-superuser owner | Tested with a simulated owner (CREATEROLE, no BYPASSRLS); **not yet on Replit** |
| Replit carries or drops policies at publish | Unknown (OD-RLS-01); the design does not depend on it |
| The deployment `.replit` syntax is right | From the drafting model's knowledge \[EXT-K\]; confirm in R2 |
| `schemaFilter` keeps drizzle-kit out | From Drizzle's documented option \[EXT-K\]; confirm in RLS-DRZ-001 |
| Production ready | Not claimed. Tier 0; JCSE not asserted; no independent review |

### C — Version history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 17 October 2026 | First PDD. Packages ark\_rls v1.1 (no BYPASSRLS role, non-superuser install, pure-SQL migrations, ledgered runner, fail-closed verifier) for Replit; 28-prompt worksheet |
