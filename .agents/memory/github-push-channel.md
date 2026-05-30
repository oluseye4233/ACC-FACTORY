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

- **One-click OAuth connect is the friendlier alternative to pasting a PAT, but
  lands in the SAME `integration_credentials` row.** `GET /oauth/start`
  (auth'd) redirects to github.com with a short-lived HMAC-signed `state`
  (signed with SESSION_SECRET, carries the userId + expiry); `GET /oauth/callback`
  has NO Clerk session — it trusts the verified state instead, so a forged
  callback can't attach someone else's GitHub. Both legs redirect back to the
  FRONT-END (`<base>/account?github=connected|denied|error|oauth_unavailable`),
  not JSON — the SPA toasts on the query param then strips it. Needs a registered
  GitHub OAuth app (`GITHUB_OAUTH_CLIENT_ID`/`_SECRET`); when unset, GET status
  returns `oauthAvailable:false` and the UI shows the PAT paste fallback.
  Disconnect best-effort revokes the grant (DELETE `/applications/{id}/token`)
  before clearing the row. The pasted-PAT path is kept as the fallback.
  **Why:** the downstream push channel already keys off the per-user
  `integration_credentials` row, so OAuth only needed to change HOW the token is
  obtained, not where it's stored — keeping the push path untouched.

- **PATs need the `repo` scope** to create/push repos. The repl-level connector
  scopes were `read:org read:project read:user repo user:email` (no
  `delete_repo`); a user-pasted PAT's scopes are whatever they granted.

- Integration endpoints live alongside Sphinx in `routes/integrations.ts` and
  use inline Zod + the thin `@/lib/api` wrapper (NOT the OpenAPI codegen) —
  that is the established convention for the integrations surface here.

- **Three push modes: `create` | `update` | `existing`.** A fine-grained token
  scoped to only selected repos CANNOT create repos but CAN push to ones already
  in its selection — so `existing` (body `targetRepo:"owner/repo"`) resolves the
  repo via `repos.get` (authorizes the token + reads the real default branch),
  then reuses the same commit-onto-existing-repo path as `update`, generalised
  over `owner/repo` so org-owned repos work too.
  **Why:** a narrowly-scoped fine-grained token can't hit the `create` path at
  all, so "push onto a repo I already made" is the only channel that works for it.

- **Update mode has two channels: direct commit vs. pull request.** Body field
  `pullRequest: boolean` (honored for `mode==="update"`/`"existing"`). PR path commits
  the fresh tree onto a new `code-dj-update-<ts>` branch off HEAD, then
  `gh.rest.pulls.create({head, base})`; response surfaces `pullRequestUrl`.
  **Why:** a force-style regeneration onto `main` is surprising for users who
  treat the repo as a working project; PR mode lets them review the diff
  (including files dropped between runs — the tree omits `base_tree`) first.
  PR creation needs only the existing `repo` scope (no extra grant).
