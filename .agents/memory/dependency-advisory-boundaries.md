---
name: Unpatched dependency advisory boundaries
description: Keep upstream dependency risks visible instead of replacing authentication or ingestion blindly.
---

When a dependency advisory has no compatible upstream fix, distinguish an
installed-package finding from a verified application reachability boundary.
Never hide the advisory or call a boundary test a vulnerability fix.

**Why:** The proxy and document converter bring optional glob/CLI dependencies
into the lockfile even when the platform uses literal proxy paths and the library
extraction API. Replacing authentication or ingestion to clear an audit count can
introduce more consequential regressions.

**How to apply:** Recheck the registry first; retain visible unresolved findings.
Reassess reachability before introducing user-controlled globs, CLI conversion
or format strings. Existing boundary tests are evidence only for their exercised
paths, not a blanket security guarantee.
