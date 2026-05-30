---
name: F8 CODE DJ → IDE export bundle
description: How the F8 "send to IDE" handoff is structured and where to extend it.
---

F8 (CODE DJ) exports its generated codebase as a **ready-to-open project ZIP**,
not a flat JSON. The handoff convention:

- The scaffold `files[]` are written at their real `path`s (genuine folder tree).
- A universal **`AGENTS.md`** carries the CODE DJ operating brief: doctrine note,
  build manifest, scaffold file table, SPARTAN cert lineage, PFP/BUGMXT fidelity
  (verdict/FCI/counts + findings when a drift check ran), and fidelity rules.
- Per-IDE adapter files mirror/point to AGENTS.md, each in that IDE's expected
  format: Cursor `.cursor/rules/code-dj.mdc`, Claude Code `CLAUDE.md`, Replit
  `replit.md`, Copilot `.github/copilot-instructions.md`, Windsurf `.windsurfrules`.
- The raw bundle is retained at `.code-dj/bundle.json` for lineage.

**Why:** different AI IDEs auto-read different project-level instruction files;
shipping all of them makes one bundle work everywhere with no backend/auth.

**How to apply:** the generator lives in
`artifacts/command-centre/src/lib/codeDjExport.ts` and zips via the shared
`src/lib/zipExport.ts` `downloadZip` helper (jszip + file-saver, already deps).
Any future GitHub-push / one-click-Replit-import handoff should reuse
`buildExportFiles()` / `buildAgentsMd()` rather than re-deriving the file set, so
the doctrine stays identical across delivery channels. Keep doctrine wording
correct: HARNESS engines are an instruction layer, never SPCs; IPDD=input,
PWDD=output.
