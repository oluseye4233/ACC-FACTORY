---
name: LLM prompt determinism in HARNESS engines
description: Why HARNESS engine prompts must be assembled in a deterministic order, and how nondeterminism breaks the replay-fixture test rig.
---

# HARNESS engine prompts must be deterministic

Any HARNESS engine that builds an LLM prompt from a *collection* of DB rows must
impose an explicit, stable order on those rows before serialising them into the
prompt. Drizzle `inArray(...)` (and any `select()` without `orderBy`) gives **no
row-order guarantee** — Postgres can return rows in different orders across
identical runs.

**Why this matters here (three blast radii):**
1. The prompt text changes → the LLM request is nondeterministic for identical inputs.
2. `harness_engine_runs` telemetry / cost accounting becomes irreproducible.
3. The cross-provider replay test rig (`test/setup.ts` + `test/llm-cache.ts`) keys
   its fixtures on a sha256 of the request payload (UUIDs and ISO timestamps are
   normalised, but **row order is not**). A nondeterministic prompt produces a
   different cache key each run → intermittent `MissingFixtureError` /
   `502 ... No cached fixture`, and accumulates multiple orphan fixtures for the
   same logical test recorded under different orders.

**How to apply:** when fetching rows by a caller-supplied id list, re-order the
fetched rows to follow the caller's requested order (build a `Map(id -> row)` then
`requestedIds.map(...)`), or add a deterministic `orderBy`. Don't fuse rows in raw
DB order. The DE-SPC engine (`engines/de.ts handleEvolve`) hit exactly this bug.

**Fixing it also requires re-recording fixtures:** identify the affected engine's
fixtures (grep the fixture JSON for a field unique to that engine's response, e.g.
`orchestrationPattern` for DE-SPC), delete the orphans, then re-record one per
provider with `RECORD=1 vitest run -t "<engine>"`. All three AI providers
(claude/openai/gemini) are reachable via the `AI_INTEGRATIONS_*` proxy env vars.

## Intentional prompt edits also invalidate replay fixtures

Changing an engine's system prompt or user prompt changes the replay-cache key,
even when the response schema change is optional. Offline provider tests then
fail closed with `MissingFixtureError`; this is a stale-fixture signal, not
evidence that the engine route itself is broken.

**Why:** fixture lookup hashes the provider request payload, including prompt
text, so behavioral prompt changes require matching fixture updates.

**How to apply:** identify the full provider/engine fixture matrix before changing
prompt text. Re-record fixtures only when provider calls are intended; otherwise
preserve the current prompt contract and test the new fallback/serialization path
with deterministic fixtures.
