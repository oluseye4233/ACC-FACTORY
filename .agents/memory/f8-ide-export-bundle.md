---
name: F8 CODE DJ → IDE export bundle
description: Durable decisions behind the F8 "send to IDE" handoff.
---

F8 (CODE DJ) hands off its generated codebase as a **ready-to-open project ZIP**,
not a flat JSON dump. Durable decisions worth keeping consistent:

- Ship a real folder tree of the scaffold files **plus** a universal `AGENTS.md`
  operating brief **plus** per-IDE adapter files (Cursor, Claude Code, Replit,
  Copilot, Windsurf each auto-read a different instruction file, so all are
  shipped and each points back to AGENTS.md). This makes one bundle work in any
  IDE with no backend/auth.
  **Why:** different AI IDEs auto-load different project-level instruction files.

- AGENTS.md must carry *spec traceability*, not just metadata: a certified
  MVP-PDD summary (from the F7 artifact's `sections` + `donut`) and a one-row-
  per-file → PDD-section table. The file→section map is best-effort, derived from
  PFP code↔spec findings; files with no resolved section are flagged "trace in
  your IDE" rather than fabricated.
  **Why:** a code review rejected an earlier version that shipped only manifest +
  cert metadata — the doctrine requires every scaffold file to trace to the spec.

- Doctrine wording is load-bearing: HARNESS engines are an instruction layer,
  never SPCs; IPDD=input, PWDD=output. Keep it correct in every generated file.

**How to apply:** any future delivery channel (GitHub push, one-click Replit
import) should reuse the same export generator so the doctrine and traceability
stay identical across channels rather than being re-derived per channel.
