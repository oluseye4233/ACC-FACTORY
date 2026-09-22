#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Sync the development DB by APPLYING committed migrations, never `push`.
# `drizzle-kit push` prompts to TRUNCATE when a `.unique()`/NOT NULL is added to
# a populated table; stdin is closed here, so it would fail (or drift) on EOF.
# `migrate` applies pending migrations non-interactively and never truncates.
pnpm --filter @workspace/db run migrate
# Prove the DB actually matches the committed journal: prints
# "X/Y migrations applied" and exits non-zero if anything is still PENDING,
# so drift fails the post-merge step loudly instead of 500ing a feature later.
pnpm --filter @workspace/scripts run migration-status
# Sweep stale test fixtures (@example.test users >60min old) so orphaned
# harness_engine_runs cost rows never inflate the dev spend meter. Best-effort:
# a janitor failure must never fail the merge itself (hence the || guard —
# `set -e` is active above).
pnpm --filter @workspace/scripts run cleanup-test-cost-data \
  || echo "[post-merge] warning: cleanup-test-cost-data failed (continuing; run it manually if needed)"
