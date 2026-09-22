---
name: ATLAS 360 PDD views
description: PLAN and SCAN are origin-aware document side-steps, not numbered stages
---

ATLAS 360 PLAN and SCAN are read-only, Practitioner-gated views over an existing
F6/F7 PDD. Manual and cartridge sessions default to PLAN; ingested sessions
default to SCAN. Explicit format selection may override the default.

**Why:** The governing PDD retired the proposed F10 product. Keeping these as
separate transformations preserves deterministic F6/F7 prompts and avoids
rerunning the production pipeline.

**How to apply:** Persist each generated view independently with source artifact
lineage. PLAN always carries the host framework certification-withheld
disclosure and Parts 10–11. SCAN starts with a Freeze Evidence Manifest and may
include same-session codebase/PFP evidence.