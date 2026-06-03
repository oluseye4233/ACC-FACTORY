---
name: pnpm --filter runs scripts from the package dir
description: Relative file paths in @workspace/scripts resolve against the package dir, not the repo root.
---

`pnpm --filter @workspace/scripts run <script>` executes with CWD = `scripts/`, so any relative output path in the script (e.g. `artifacts/command-centre/public/x.png`) lands under `scripts/artifacts/...`, not the repo root.

**Why:** silently wrote generated assets to `scripts/artifacts/...` and `scripts/exports/...` instead of the real targets; the script logged success but the files weren't where expected.

**How to apply:** in any `@workspace/scripts` file that writes to repo-root-relative locations, resolve from the script's own location:
`const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")` then `resolve(REPO_ROOT, "artifacts/...")`. Don't rely on `process.cwd()`.
