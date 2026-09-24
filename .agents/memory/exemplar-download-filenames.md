---
name: Exemplar Library download filenames
description: Stable, filesystem-safe naming rule for downloaded library artifacts
---

Use `TYPE.TITLE.ID.MM.DD.YY.H-MM-SSAM.ext` for Exemplar Library downloads. Use the item kind for `TYPE`, a sanitized readable title, and the stable library item ID so two records with the same title remain distinct. The timestamp is local download time, includes seconds and AM/PM, and uses a hyphen instead of a colon for filesystem compatibility. Use `.json` for structured JSON bodies and `.md` for Markdown text.

**Why:** Library items can share names, and a colon in the sample timestamp is not accepted by every filesystem. Including a stable ID and safe second-resolution time keeps exports distinguishable without changing library titles.

**How to apply:** Reuse this convention for any new Exemplar Library download surfaces; do not substitute source-session identifiers or overwrite the library title with the export name.