---
name: Proxy 120s request timeout → stream heavy engine calls
description: Why heavy single-shot HARNESS engine finalize calls must use SSE, and which ones are at risk.
---

The Replit proxy/gateway aborts any request that sends no bytes for ~120000ms (120s).
This is infrastructure, NOT in app code — it cannot be raised. A heavy single LLM
call that runs longer than 120s with no intermediate output surfaces to the user as
an HTTP 502 "We couldn't reach this app" page (no app-level error, no logs beyond the
aborted request at responseTime:120000).

**Rule:** any HARNESS engine step whose LLM call can run long (large MAX_TOKENS full
synthesis — F5 FORGE.COMMIT SPC synthesis, and structurally F6/F7/F8 finalize) must
be an SSE endpoint that flushes `start`/`step` progress events immediately so the
proxy sees bytes well within 120s, then sends `complete`. Q&A turns (2–5s) can stay
on plain JSON.

**Why:** F5 finalize (`MAX_TOKENS=16384`) intermittently exceeded 120s and 502'd in
production. Cheap turns never hit it, so it looks flaky/intermittent.

**How to apply:** mirror the F3/F7 SSE pattern — kick the LLM promise off in parallel
with a deterministic step-progress loop, persist the artifact regardless of client
disconnect (`req.on("close")` flag), emit typed `error` events with codes. Keep the
gate stack via `harnessRoute({featureId, tier, handler})` so `requireCostBudget` still
mounts (gotcha #6). Client uses `streamSse()` with an AbortController; abort on unmount
and on reset to avoid a late `complete` overwriting cleared state.
