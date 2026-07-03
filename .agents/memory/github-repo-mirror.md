---
name: GitHub repo mirror
description: How this workspace's code auto-syncs to the owner's GitHub repo, and the constraints that shaped the design.
---

**Rule:** The workspace mirrors to the owner's GitHub repo via an incremental GitHub Data API snapshot (one remote commit per sync, `Replit-Commit: <local sha>` trailer on the remote head marks the resume point). Never switch this to plain `git push`.

**Why:** The Replit GitHub connector OAuth token lacks the `workflow` scope, so any push containing `.github/workflows/*` changes is rejected wholesale; the API path can simply exclude those files. Connector tokens also expire (~1h), so the token must be re-fetched from the connectors API on every run — never embedded in a git remote URL.

**How to apply:** Sync is automatic (post-merge hook + a looping console workflow). If the remote head loses the trailer (manual commits on GitHub), one recovery run with `--base=<local sha matching remote tree>` re-anchors it. Remote-only files (e.g. a GitHub-side README edit) survive because syncs use `base_tree` and touch only locally-changed paths — but local changes always win on conflict since there is no merge.
