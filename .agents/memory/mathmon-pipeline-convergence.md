---
name: MATHMON F0→F9 convergence
description: Where MATHMON actually touches the HARNESS pipeline and how to test the FORGE VERIFIED gate end-to-end
---

MATHMON is a cross-cutting layer but only *touches* three pipeline points:
- **F0.5** writes `mathmon_intakes`.
- **MAP** recomputes the three sub-scores server-side, writes `mathmon_maps`, and appends the disclaimer to the `economic_projections` section only.
- **F7** is the CONVERGENCE POINT / gate: reads the latest MAP (`loadLatestMap`) + the session's max JCSE (`sessionMaxJcse`), recomputes the composite, applies the ABSOLUTE gate `forgeVerified = (jcse ≥ 45 AND mathmon ≥ 70)`, and stamps `forgeVerified`/`mathmonScore`/disclaimer onto the certified MVP_PDD. F1–F6/F8/F9 do NOT touch MATHMON tables — they only carry the F7 result forward.

**Why:** "prove MATHMON threads the whole pipeline" reduces to testing the F7 gate (the only place upstream signals converge and can regress) + the pure gate arithmetic; there is no per-engine MATHMON hook to test in F1–F6/F8/F9.

**How to apply (driving F7 in a test):** seed user/subscriber/session, an `ATLAS_PDD` artifact (F7's required input, artifactType must be exactly `ATLAS_PDD`), a `mathmon_maps` row, and a JCSE-scored artifact (any artifact with `jcseScore`; gate uses the MAX across the session). Build the F7 replay fixture from the DB-round-tripped `artifactContent` (jsonb reorders keys) with prompt `Compress this ATLAS PDD via the 7-step SPARTAN SCM:\n${JSON.stringify(content, null, 2)}`. Mount `handleF7Stream` directly (no rateLimit needed — the handler doesn't check feature state). Disclaimer is only on the cert/complete event when `forgeVerified` is true; a null mathmonScore (no MAP) can never pass. See `artifacts/api-server/test/mathmon-pipeline.test.ts`.
