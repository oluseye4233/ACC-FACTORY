---
name: HOST DJ is an engine (F8-HDJ), never a marketplace SPC
description: Doctrinal decision for how the HOST DJ capability is an instruction-layer engine, plus the side-step wiring it actually shipped with.
---

# HOST DJ → F8-HDJ engine recast (SHIPPED)

The HOST DJ capability (authored elsewhere as a marketplace Super Prompt Card) is
absorbed as the instruction-layer engine **F8-HDJ**, a post-F8 advisory side-step
(like F6-VDJ / ATLAS J / PFP). It is **never** a catalogue SPC.

**Why:** core product doctrine (replit.md "Product" + Top-5 gotchas). HARNESS engines are
the instruction layer and are NEVER SPCs; the HARNESS *produces* SPCs/PDDs. Mislabeling an
engine as an SPC, or publishing HOST DJ as a card, breaks the doctrine the product rests on.

**How it shipped (current-state doctrine):**
- It is an **advisory side-step**, so it is tier+cost gated only — **no per-day rate-limit
  counter** (featureId `null`, ARCHITECT tier). This means **no new daily counter and no
  `routes/cron.ts` change** were needed. (Earlier planning assumed an `f9_today` counter +
  cron reset — that was wrong for a side-step; side-steps mirror f6-vdj/pfp which have none.)
- Server-side recompute discipline (gotcha #5): the model returns only per-criterion HSE
  scores; weighted totals, ranking, primary/fallback, and jcse are recomputed server-side.
  The model's own ordering is never trusted.
- Advisory only: never holds cloud creds, never executes a deploy. The SDF env template is
  **names only** — both the `key` and the `description` are sanitised server-side
  (strip assignments/URLs/long tokens) so a model cannot smuggle a secret value through.
- Refuses to plan hosting for an uncertified MVP PDD (409 if `!spartanCert`).

# Authoring ATLAS/SPARTAN current-state docs

When a "current state" PDD/MVP doc folds in a role, mark **shipped vs planned explicitly**
in every ledger and the cert block. A SPARTAN "FFS 100%" is build-plan fidelity (features
survive compression), NOT proof the features are live — state that, or a reviewer reads it
as over-claiming shipped scope.
