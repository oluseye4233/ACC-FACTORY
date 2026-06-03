---
name: Investor-PDD PDF theme
description: The shared pdfkit design system that keeps the ATANDA investor-grade PDDs visually uniform.
---

All investor-grade PDDs for the ATANDA Command Centre are rendered through one
shared pdfkit theme module: `scripts/src/lib/atlas-pdf-theme.mjs`.

**Rule:** any new investor/board-facing PDD generator must import
`createTheme(doc)` (and the exported palette / `PHASE_COLOURS`) from that module
rather than redefining helpers inline, so every document shares the same cover,
headings, bullets, code blocks, rainbow phase blocks, and tables.

**Why:** the deliverables are explicitly required to be visually uniform (e.g.
the 4-Part ATLAS PDD Investor Edition and the SPARTAN-certified MVP PDD). A
single source of design truth is the only way to guarantee that uniformity and
avoid drift when one doc is restyled.

**How to apply:**
- Generators run with plain `node` (`.mjs`), pdfkit is required via
  `createRequire(resolve(repoRoot, "lib/export/package.json"))`.
- `repoRoot` is resolved as `resolve(__dirname, "..", "..")` from `scripts/src/`.
- `createTheme(doc)` returns: `pageGuard, hr, partHeader, h1, h2, h3, p, lead,
  bullets, kv, code, phaseBlock, table` plus palette constants
  (`NAVY, ACCENT, GREY, SOFT, LIGHT, GOLD`) and `PHASE_COLOURS`.
- When refactoring an existing inline-helper generator onto the module, move the
  helpers verbatim — the ATLAS output stayed byte-stable (38935 vs 38936) which
  is the cheap regression signal that the extraction was faithful.
- npm scripts live in `scripts/package.json`
  (`build-atlas-investor-pdd`, `build-spartan-mvp-pdd`); outputs land in `docs/`
  and are copied to `exports/` for the Book.
