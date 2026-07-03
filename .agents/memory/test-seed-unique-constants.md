---
name: Test seeds must not share fixed unique-column values
description: Why per-seed minted values (SKUs, codes) are required in DB-backed tests against the shared dev DB
---

Rule: any test seed inserting into a column with a UNIQUE index (e.g. `harness_artifacts.sku`) must mint a fresh per-seed value, never a shared file-level constant.

**Why:** tests run against the shared dev database with cleanup in `finally`. A killed run (SIGKILL, timed-out shell, aborted CI) never reaches cleanup and leaves the seeded row behind; the next run — or a concurrent run of the same file — then fails every subsequent seed with a duplicate-key error. This bit the F0 honesty-gate suite during task validation: a fixed `ARTIFACT_SKU` constant made 7 tests fail after an earlier aborted run left state behind.

**How to apply:** generate the value inside the seed function (random hex/timestamp in the real format, e.g. `ARK-SPC-GEN-<6 hex>-0001-V1`) and return it in the fixtures so assertions compare against `fx.sku`, not a constant. If a suite starts failing with duplicate-key errors on seed, also check the dev DB for orphaned `*@example.test` users from aborted runs and delete them.
