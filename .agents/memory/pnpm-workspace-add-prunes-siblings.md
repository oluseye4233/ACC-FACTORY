---
name: pnpm add into one workspace member can break a sibling's deps
description: Why a sibling package's tests suddenly fail with MODULE_NOT_FOUND after a scoped pnpm add.
---

Running `pnpm --filter @workspace/<pkg> add -D <dep>` can leave a *different*
workspace package's symlink dangling. Observed: after adding `vitest` to
`command-centre`, `api-server`'s `node_modules/vitest` symlink pointed at a
pruned `.pnpm` store variant, so `pnpm run test` failed with
`Cannot find module '.../api-server/node_modules/vitest/vitest.mjs'`.

**Why:** a scoped add re-resolves the dependency graph and can prune/replace the
peer-hashed `.pnpm` variant another package was linked to, without relinking it.

**How to apply:** after any scoped `pnpm add`/`pnpm remove` in this monorepo, run
a plain `pnpm install` at the root to relink everything, then re-run the full
`pnpm run test` (not just the package you touched) before trusting green.
