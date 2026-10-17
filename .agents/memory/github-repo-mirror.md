---
name: GitHub repo mirror
description: How this workspace's code auto-syncs to the owner's GitHub repo, and the constraints that shaped the design.
---

**Rule:** The workspace mirrors to the owner's GitHub repo via an incremental GitHub Data API snapshot (one remote commit per sync, `Replit-Commit: <local sha>` trailer on the remote head marks the resume point). Never switch this to plain `git push`.

**Why:** The Replit GitHub connector OAuth token lacks the `workflow` scope, so any push containing `.github/workflows/*` changes is rejected wholesale; the API path can simply exclude those files. Connector tokens also expire (~1h), so the token must be re-fetched from the connectors API on every run — never embedded in a git remote URL.

**How to apply:** Sync is automatic (post-merge hook + a looping console workflow). If the remote head loses the trailer (manual commits on GitHub), one recovery run with `--base=<local sha matching remote tree>` re-anchors it. If local history was rewritten and no matching base exists, use the one-time `--snapshot` recovery, which reconciles the complete non-workflow tree and removes remote-only paths. Remote-only files otherwise survive because syncs use `base_tree` and touch only locally-changed paths — but local changes always win on conflict since there is no merge.

**Operational note:** Restart the long-running GitHub Sync workflow after changing the sync script; an already-running shell can retain the previous checkout state until restarted.

**Large snapshot recovery:** If GitHub accepts the blobs but times out creating the combined tree, reuse those blob SHAs and build successive trees in small batches (40 entries worked), each based on the preceding tree. Verify the final recursive tree against local blob hashes and modes before creating one commit and advancing the branch without force.

**Why:** GitHub can return HTTP 422 “input was too large to process” during tree assembly even after every blob uploaded successfully; re-uploading all blobs does not resolve that failure.

**How to apply:** Keep the branch unchanged until assembly and verification finish, recheck the remote head before committing, and preserve excluded workflow paths. For non-ASCII filenames, parse local tree output with NUL delimiters or disable core.quotePath for the existing snapshot script.
