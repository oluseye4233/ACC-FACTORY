---
name: Headless capture pipeline
description: How to capture authenticated app screenshots/GIFs in this workspace, and the background-process kill trap.
---

**Rule:** Long-running shell work (headless-browser captures, batch jobs) must be resumable (skip-existing outputs) and run in foreground chunks — `nohup ... &` children are killed when the bash tool invocation ends, so background runs silently stall partway.

**Why:** A capture run backgrounded with nohup died between polls with no log file; only the resumable-skip design allowed finishing in a second foreground run.

**How to apply:** For any script expected to exceed the ~2-min bash timeout: make each output idempotent/skippable, then run `timeout 110 ...` foreground passes until done. For authenticated UI captures: system `chromium` (nix) + `puppeteer-core` works; log in by `page.evaluate(fetch('/api/auth/login', ...))` with the secret read from `process.env` (never interpolated into logs or files), then navigate via `localhost:80`.
