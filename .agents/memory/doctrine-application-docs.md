---
name: Doctrine-application documents (SPARTAN / CODE DJ / BUGMXT self-audit)
description: How to write analysis docs that apply the HARNESS's own doctrines to the platform without overclaiming engine behavior.
---

When authoring documents that apply the platform's own doctrines (SPARTAN/F7,
CODE DJ/F8, BUGMXT/PFP) to the ATANDA Command Centre itself, do NOT attribute
enforcement logic to the engines that the engine code does not actually contain.

**Rule:** SPARTAN's collapse-fidelity gates (FFS / CIS / AVS / UIS) and CODE DJ's
coverage/orphan/unauthorized-extension checks are **SPC doctrine** from the
reference cards — they are real concepts, but the live engines do NOT enforce them
in code. Frame them as *analyst scoring overlays*, not runtime engine gates.

**What the engines actually do (verify before claiming otherwise):**
- `engines/f7.ts` (SPARTAN): persists the LLM's `sections` / `donut{a,b,c}` /
  `crP` / `class` and issues a cert. No FFS/CIS/AVS/UIS gate logic.
- `engines/f8codedj.ts` (CODE DJ): enforces ONLY body validation, session +
  `MVP_PDD` type, SPARTAN-cert presence, the PFP critical-drift gate (409
  `DRIFT_GATE` unless `acknowledgeDrift:true` when latest PFP `counts.critical>0`),
  platform pinning, and `files.max(12)`. No intrinsic coverage/orphan analysis.
- `engines/pfp.ts` (Layer 4): counts + verdict are recomputed server-side from
  `findings`. Verdict rule: `fail` if `critical>0 || high>3 || fci<90`; else
  `pass_with_notes` if any `high`/`medium`; else `pass`. Any doc stating a verdict
  must show counts that satisfy this exact derivation.

**Why:** A code-review architect pass failed an earlier draft for attributing
non-existent FFS/CIS/AVS/UIS enforcement to F7 and intrinsic fidelity checks to
F8. Mislabeling doctrine as engine behavior is doctrinal overreach.

**How to apply:** Add an explicit "analyst scoring overlay" / "analyst overlay"
scope note next to any doctrine gate or fidelity check in such docs, and keep the
real engine pre-flight checks separate and accurate.
