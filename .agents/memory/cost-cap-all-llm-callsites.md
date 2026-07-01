---
name: Global cost cap must cover every LLM call site
description: The runaway-spend guard is only complete if requireCostBudget gates ALL callLlmJson callers, not just engine routes.
---

# Global cost cap must cover every LLM call site

The monthly LLM cost cap (`requireCostBudget`, `lib/cost-budget.ts`) is the runaway-spend
guard. `replit.md` gotcha #6 says every **engine** route mounts it after `rateLimit` —
but engine routes are not the only `callLlmJson` callers.

**Why:** ingestion (`routes/ingest.ts`) and cartridge (`routes/cartridge.ts`) are
**pre-session** LLM calls (no `sessionId` yet) that were previously bounded only by the
per-tier credit gate. In internal-staff mode credits are unlimited, so they bypassed all
spend limits until `requireCostBudget` was added to them too.

**How to apply:**
- Any new route that calls the LLM (grep for `callLlmJson` / `callLlm`) must mount
  `requireCostBudget` after `requireAuth`, even if it is not an F-engine.
- Ledger recording is a separate concern: `harness_engine_runs.sessionId` is `NOT NULL`,
  so pre-session calls (ingest/cartridge) are gated by the cap but their spend is **not
  yet recorded** in the ledger. Recording them would need a schema change (nullable
  sessionId or a separate table) — deferred as disproportionate. The cap still reads the
  live SUM of recorded runs, so unrecorded pre-session spend is currently uncounted
  toward the cap.
