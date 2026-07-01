---
name: Global cost cap must cover every LLM call site
description: The runaway-spend guard is only complete if every callLlmJson caller is both gated by requireCostBudget AND records its spend to the ledger.
---

# Global cost cap must cover every LLM call site

The monthly LLM cost cap reads a live SUM over `harness_engine_runs.cost_usd`. For it to
be a real ceiling, every LLM call must be **both** (1) gated by `requireCostBudget` on the
route and (2) recorded as a run row, or the cap under-counts and lets spend slip past.

**Why:** ingestion and cartridge normalisation are **pre-session** LLM calls — they run
before any harness session exists. They were originally gated only by the per-tier credit
gate (unlimited in internal-staff mode) and, worse, could not even be recorded because the
runs table required a session. Both holes had to close for the cap to actually bound them.

**How to apply:**
- Any new route that calls the LLM (grep `callLlmJson` / `callLlm`) mounts
  `requireCostBudget` after `requireAuth`, even if it is not an F-engine.
- The runs row **must** be written for the spend to count. Pre-session calls record with
  a null `sessionId` (the FK column is nullable) plus a sentinel engine id (ingestion=20,
  cartridge=21) so the same SUM tallies them.
- The SUM predicate keys on user + month only — never on `sessionId` — so null-session
  rows are counted like any other. Do not add a `sessionId IS NOT NULL` filter to the cost
  queries; it would silently re-open the pre-session hole.
- Any code touching a run row must treat `sessionId` as nullable end-to-end (schema, the
  `RunContext`/serializer types, and the cost-summary `RecentRun` response type).
