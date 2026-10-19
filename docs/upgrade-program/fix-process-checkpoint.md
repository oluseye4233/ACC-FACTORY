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

## Fresh-install migration verification — blocked

CI now invokes a loopback-only, empty `workspace_test` migration replay rather
than relying on schema push. This is not a production installer and is not
connected to deployment startup.

The historical introspection baseline is fully commented. The isolated replay
executes its SQL payload before recording that baseline as executed, then would
apply incremental migrations and check a second migration run is a no-op.
It refuses a non-local, differently named or non-empty database.

An actual PostgreSQL 16 throwaway-cluster run failed in the baseline with:

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

`session_id` is UUID. The historical file and recorded checksums have not been
changed. The baseline transaction rolled back on the isolated cluster.
Incremental migration replay and the no-op check have NOT passed.
The new CI migration step is expected to fail until a reviewed baseline repair
or fresh-install baseline strategy is agreed; it must not fall back to push.

Two runner safety/format unit tests passed. These do not establish successful
migration replay.

## Dependency assessment — measured, not remediated

A fresh `pnpm audit --json` reported 0 critical, 41 high, 37 moderate and 9 low
advisory instances across the complete dependency graph. These are package-audit
counts, not demonstrated exploits or a production reachability assessment.
The count must not be substituted for the older October 16 report.

Updates have not been installed in this batch. Migration recovery is the current
blocker in the agreed sequence. Credit recovery, preparation-file recovery,
grouped user-journey checks and accessibility work remain unfinished.
