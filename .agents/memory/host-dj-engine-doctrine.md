---
name: HOST DJ is an engine (F8-HDJ), never a marketplace SPC
description: Doctrinal decision for how the HOST DJ SPC asset is absorbed into the HARNESS, and how PDD/MVP docs must mark shipped vs planned.
---

# HOST DJ → F8-HDJ engine recast

The attached `attached_assets/HOST_DJ_SPC_v1_0_*.md` is authored as a marketplace
Super Prompt Card ("SI Fusion Class", Camelot Seat #7). **Do not adopt it as a
catalogue SPC.** HARNESS engines are the instruction layer and are NEVER SPCs; the
HARNESS *produces* SPCs/PDDs. So HOST DJ's capability is absorbed as a new
instruction-layer engine **F8-HDJ** (a post-F8 side-step, like F6-VDJ / ATLAS J / PFP).

**Why:** core product doctrine (see replit.md "Product" + Top-5 gotchas). Mislabeling an
engine as an SPC, or publishing HOST DJ as a card, breaks the doctrine the whole product
rests on.

**How to apply (when building F8-HDJ for real):**
- Route `POST /api/harness/f8-hdj`, Architect tier, middleware order
  `requireTier → rateLimit → requireCostBudget` (gotcha #6 — missing requireCostBudget = a
  runaway-spend hole). Add a new daily counter (e.g. `f9_today`) AND zero it in
  `routes/cron.ts reset-harness-limits` (today it only resets f1Today..f8Today) or the tier
  locks after 24h.
- Reconcile the SPC's 24-platform HSE registry to what F8 can actually scaffold
  (`nextjs-vercel | react-vite-static | express-replit | expo-mobile | pnpm-monorepo`) +
  Replit Deployments. Never recommend a host F8 can't target.
- Advisory only: never hold cloud creds, never execute a deploy, SDF env template emits
  keys-only (no values).
- LLM providers are claude/openai/gemini (NOT openrouter); Explorers locked to claude.

# Authoring ATLAS/SPARTAN current-state docs

When a "current state" PDD/MVP doc folds in a not-yet-built role, mark **shipped vs
planned explicitly** in every ledger and the cert block. A SPARTAN "FFS 100%" is
build-plan fidelity (features survive compression), NOT proof the features are live —
state that, or a reviewer reads it as over-claiming shipped scope.
