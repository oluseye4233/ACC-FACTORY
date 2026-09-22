# BUGMXT triage notes — verified findings from past scans

These notes carry forward across scans. They are injected verbatim into the
BUGMXT prompt so known-good code is not re-flagged and accepted risks are not
re-litigated. Append a dated section after triaging each new report.

## 2026-07-03 — Guide media + GitHub auto-sync scan

- **Git `--name-status -z` parser in `scripts/src/sync-github.ts` is verified correct.**
  `git diff --name-status -z` emits non-empty status/path tokens only; the
  `filter(Boolean)` strips solely the single trailing empty string, so no index
  misalignment or dropped file is possible. Verified empirically (initial
  63-file sync transferred every file). Do NOT flag this parser again.
- **Connector identity pattern in `getGithubToken()` is canonical.** The
  `REPL_IDENTITY`/`WEB_REPL_RENEWAL` header construction is the standard Replit
  connector identity pattern (same as `api-server/src/lib/stripe.ts`). Not a bug.
- **Orphaned GitHub blobs after a partial sync are an accepted risk.** GitHub
  garbage-collects unreferenced blobs; re-runs are idempotent and correct.
- **Single login in the guide capture pipeline is an accepted risk.** One-off
  capture tool; the staff session outlives the ~3-minute run and outputs are
  visually verified.
- **GitHub error bodies do not echo bearer tokens**; connector-lookup error
  logs include the HTTP status only. Token-leak-via-error-body findings on
  `sync-github.ts` are theoretical.
