---
name: ATLAS 360 PDD views
description: PLAN and SCAN are origin-aware document side-steps, not numbered stages
---

ATLAS 360 PLAN and the legacy F6/F7 SCAN are read-only, Practitioner-gated views over an existing
F6/F7 PDD. Manual and cartridge sessions default to PLAN; ingested sessions
default to SCAN. Explicit format selection may override the default.

**Why:** The governing PDD retired the proposed F10 product. Keeping these as
separate transformations preserves deterministic F6/F7 prompts and avoids
rerunning the production pipeline.

**How to apply:** Persist each generated view independently with source artifact
lineage. PLAN always carries the host framework certification-withheld
disclosure and Parts 10–11. SCAN starts with a Freeze Evidence Manifest and may
include same-session codebase/PFP evidence.

F5 additionally has a link-intake SCAN, independent of any existing F6/F7 PDD.
F6 drafting must consume a saved same-session F5 SPC or F5 SCAN, not a free-form
brief, imported SPC from another stage, or a legacy F6 SCAN view.

**Why:** The user requested website/repository/local-server intake at F5 and
an exclusively F5-sourced F6. Keeping F5 intake distinct avoids a circular
dependency with views that already require an F6/F7 PDD.

**How to apply:** Check artifact ownership, session, stage and supported type
at both draft endpoints. Private/local references remain unverified unless
reachable through a safe public HTTPS endpoint; no implied localhost access.