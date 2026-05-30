---
name: F8 CODE DJ → GitHub push channel
description: Durable decisions behind the F8 "push codebase to GitHub / Open in Replit" live handoff.
---

The F8 CODE DJ live handoff pushes a generated codebase to a new GitHub repo
(and surfaces an "Open in Replit" import URL `https://replit.com/github/<owner>/<repo>`).

- **Reuse the client-side export generator, don't rebuild on the server.** The
  frontend calls `buildExportFiles(bundle, source, pfp)` (same fn the ZIP uses)
  and POSTs the resulting `Record<path,content>` map to
  `POST /api/integrations/github/push-codebase`. The server pushes those bytes
  verbatim via Octokit (createTree → createCommit → createRef on a fresh
  no-auto-init repo).
  **Why:** the doctrine/traceability must stay byte-identical across delivery
  channels (ZIP, GitHub). Re-deriving the file set server-side risks drift —
  the export generator is the single source of the file set.

- **GitHub push is now PER-USER (pasted PAT), not the repl-level connection.**
  Each subscriber pastes a GitHub personal access token in Account → Connected
  Services; it is stored encrypted in `integration_credentials`
  (`provider:"github"`, `label`=resolved login, `key_prefix`=token scheme like
  `ghp_`/`github_pat_` — never any secret body) and decrypted only at push time.
  The push route loads the *requesting user's* token (404/503 `GITHUB_NOT_CONNECTED`
  if absent), so repos land in their own account. Connect/disconnect mirrors the
  Sphinx UX. The old repl-level helper (`getUncachableGitHubClient`,
  connectors proxy) still exists in `lib/github.ts` but is no longer used by the
  push path. Still `requireTier("ARCHITECT")` like F8.
  **Why:** the repl-level connector token is the Repl owner's account, so in a
  multi-tenant deploy every user's push landed in the owner's GitHub.

- **Token validation on connect:** POST `/integrations/github` calls
  `users.getAuthenticated()` with the pasted token to verify it and capture the
  login before storing. 401 → `GITHUB_BAD_TOKEN` (UI tells them to reconnect).
  GET status does NOT re-validate (mirrors Sphinx GET) — it just reads the row.

- **PATs need the `repo` scope** to create/push repos. The repl-level connector
  scopes were `read:org read:project read:user repo user:email` (no
  `delete_repo`); a user-pasted PAT's scopes are whatever they granted.

- Integration endpoints live alongside Sphinx in `routes/integrations.ts` and
  use inline Zod + the thin `@/lib/api` wrapper (NOT the OpenAPI codegen) —
  that is the established convention for the integrations surface here.

- **Update mode has two channels: direct commit vs. pull request.** Body field
  `pullRequest: boolean` (only honored when `mode==="update"`). PR path commits
  the fresh tree onto a new `code-dj-update-<ts>` branch off HEAD, then
  `gh.rest.pulls.create({head, base})`; response surfaces `pullRequestUrl`.
  **Why:** a force-style regeneration onto `main` is surprising for users who
  treat the repo as a working project; PR mode lets them review the diff
  (including files dropped between runs — the tree omits `base_tree`) first.
  PR creation needs only the existing `repo` scope (no extra grant).
