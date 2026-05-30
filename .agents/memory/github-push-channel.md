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

- **GitHub is a Replit-managed, REPL-LEVEL connection, not per-end-user.** The
  token comes from the connectors proxy
  (`/api/v2/connection?include_secrets=true&connector_names=github`) and is the
  Repl owner's account. So in a multi-tenant deploy every user pushes into the
  *owner's* GitHub. Mitigated by gating the route behind `requireTier("ARCHITECT")`
  (matches F8). A true multi-tenant fix would need per-user GitHub OAuth.

- **Connector quirks:** the connection `settings.expires_at` can be `undefined`
  → don't rely on it for token caching (refetch each call is fine). Granted
  scopes are `read:org read:project read:user repo user:email` — **no
  `delete_repo`**, so do not create throwaway test repos you can't clean up.

- Integration endpoints live alongside Sphinx in `routes/integrations.ts` and
  use inline Zod + the thin `@/lib/api` wrapper (NOT the OpenAPI codegen) —
  that is the established convention for the integrations surface here.
