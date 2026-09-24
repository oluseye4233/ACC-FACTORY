---
name: Platform artifact download filenames
description: Shared naming rule and scope boundary for generated product artifacts
---

Generated project artifacts use `TYPE.TITLE.ID.MM.DD.YY.H-MM-SSAM.ext`: a safe artifact type, readable sanitized title, stable full artifact ID, local download timestamp with seconds and AM/PM, and the actual output extension. Keep ZIP exports as `.zip`, structured snapshots as `.json`, Markdown text as `.md`, and image downloads in their actual image format.

**Why:** Stage exports can have identical titles, while colons and other punctuation are not safe on every filesystem. A stable ID distinguishes artifacts without changing their displayed titles. Routine account/data exports, BI/activity reports, and static guide downloads are not generated project artifacts and remain outside this convention.

**How to apply:** Reuse the shared artifact filename formatter for new generated artifact download paths rather than creating another local convention. Preserve the artifact's stable ID and actual extension; do not rename files inside a ZIP unless their internal naming contract also changes.