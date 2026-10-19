# Fix process checkpoint

## Scope and boundaries

This batch follows the agreed backlog order. It does not change production,
historical SQL migrations, the protected ARK migration package, authentication,
subscriber entitlements or the fail-closed deployment startup chain.

## GitHub push request size — implemented

- The exact GitHub codebase POST receives a bounded 16 MiB JSON transport
  allowance, allowing JSON escaping overhead for a 2,000,000-byte source bundle.
- Other endpoints retain Express's default JSON limit.
- Source content is measured in UTF-8 bytes, not UTF-16 code units.
- Transport overflow returns JSON HTTP 413; valid parsed bundles over the
  source ceiling retain the route's HTTP 400 `BUNDLE_TOO_LARGE` response.
- GitHub push and request-parser suites: 38 tests passed.
- Full workspace typecheck passed.

GitHub itself was mocked in the route tests; no repository was created or
changed by those tests. This is not evidence of a new production deployment.

## Fresh-install migration verification — implemented and replayed

CI now invokes a loopback-only, empty `workspace_test` migration replay rather
than relying on schema push. This is not a production installer and is not
connected to deployment startup.

The historical introspection baseline is fully commented. Following approval
to preserve history, `lib/db/fresh-install/baseline.json` defines a separate
fresh-install recipe pinned to the SHA-256 of that unchanged source. It corrects
five mismatched operator classes on UUID index columns without removing indexes,
uniqueness or foreign keys.

The initial PostgreSQL 16 throwaway-cluster run exposed:

```text
operator class "int4_ops" does not accept data type uuid
```

The offending index is in
`lib/db/migrations/0000_harsh_miss_america.sql`:

```sql
CREATE UNIQUE INDEX "harness_feature_state_session_feature_idx"
ON "harness_feature_state" USING btree
("session_id" int4_ops,"feature_id" int4_ops);
```

The separate fresh baseline now executes before all 53 unchanged incremental
migrations. Its ledger row records the hash of the SQL actually executed; a
separate provenance row records the source, manifest and executed hashes. It
does not substitute the original source checksum for different executed SQL.
Existing database ledger records are not changed.

The full replay passed on the isolated PostgreSQL 16 database, including a second
migration run with no new migrations. The runner refuses non-local, differently
named or non-empty targets and has no production/startup integration.
Three runner safety/source-integrity unit tests passed.

## Dependency remediation — substantially reduced, residuals retained

A fresh `pnpm audit --json` reported 0 critical, 41 high, 37 moderate and 9 low
advisory instances across the complete dependency graph. These are package-audit
counts, not demonstrated exploits or a production reachability assessment.
The count must not be substituted for the older October 16 report.

Compatible direct-parent updates and scoped patched transitive overrides reduce
the audit to **0 critical, 1 high, 2 moderate, 0 low**. The minimum-release-age
guard remains enabled; no exclusion was added to install a newly published
package. Vite and its test-runner peers remain on major 7; application Zod and
generator target contracts remain unchanged.

Residuals, not suppressed:

- `braces`: high, no published patched release. Dependency path is
  `http-proxy-middleware -> micromatch -> braces`. The inspected proxy uses the
  default literal path filter, not a caller-supplied glob. This narrows the
  observed exposure but is not a blanket exemption for future usage.
- `sprintf-js`: moderate, no published patched release. Dependency path is
  `mammoth -> argparse -> sprintf-js`; the inspected Mammoth CLI imports
  argparse, while the platform uses Mammoth as a library. No complete dataflow
  proof is claimed.
- `postcss-selector-parser`: moderate via `@tailwindcss/typography`'s version-6
  dependency. The available fix is version 7.1.6; forcing a transitive major
  upgrade was not treated as a compatible patch.

The existing React/Clerk peer warnings remain visible; the intentionally pinned
React version was not changed as an incidental dependency fix.

Credit recovery, preparation-file recovery, grouped user-journey checks and
accessibility work remain unfinished. No production activation or certification
is established by these local changes.

## Verification of the baseline/dependency batch

- Full workspace typecheck: passed.
- Full workspace tests against the isolated fresh-install PostgreSQL database:
  API 618 passed / 40 skipped; frontend 235 passed; scripts 35 passed.
  Total: 888 passed, 40 skipped, zero failures. Skipped tests are not counted
  as verified features.
- API bundled build and frontend production build: passed. Existing frontend
  sourcemap-location/chunk-size warnings remain non-fatal.
- Restarted development API health: HTTP 200.
- A 150 KB unauthenticated GitHub request reached authentication and returned
  JSON HTTP 401, rather than failing at the old 100 KB parser limit.
- Development sign-in page screenshot: renders successfully.
- Isolated fresh database: all five public workflow tables have RLS enabled
  and forced; both IMPRIMA immutability triggers are present. This is not
  evidence about production installation or the restricted production login.
- No historical migration file changed; the original baseline hash still
  matches the separate fresh-install manifest.
