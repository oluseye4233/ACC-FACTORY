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
