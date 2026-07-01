---
name: SUBSCRIPTIONS_ENABLED dormant-billing flag
description: How the reversible subscriptions flag behaves and what tests must do to exercise the dormant path.
---

# SUBSCRIPTIONS_ENABLED dormant-billing flag

Subscriptions/Stripe billing are a deferred B-level upgrade in internal-staff mode:
fully coded and tested but dormant behind `SUBSCRIPTIONS_ENABLED` (default `false`).
The Stripe webhook, `/billing/*`, `/pricing`, `f1000`, and org tier-elevation paths
early-return / no-op when the flag is off.

**Why:** the product pivoted to an internal staff tool with a shared access code; the
subscription SaaS must stay revivable with a single env flip, no code changes.

**How to apply:**
- The flag helper reads `process.env` at **call time**, not at import. A test that
  drives a billing/webhook/tier-elevation path must set
  `process.env.SUBSCRIPTIONS_ENABLED = "true"` at **module scope, before the app/router
  import** (same place tests set `STRIPE_PRICE_*`). Otherwise the path early-returns and
  assertions like "org becomes active after webhook" fail.
- Call-time reads also mean a single test file can flip the flag off then on across
  cases (e.g. `/pricing` 503-then-200) without re-importing — just restore the prior
  value in an `afterEach` so it doesn't leak to sibling suites.
- To re-activate the real subscription SaaS in prod: set the flag to `true` — no code
  changes required.
