---
name: SUBSCRIPTIONS_ENABLED dormant-billing flag
description: How the reversible subscriptions flag behaves and what tests must do to exercise the dormant path.
---

# SUBSCRIPTIONS_ENABLED dormant-billing flag

Subscriptions/Stripe billing remain a deferred B-level upgrade in controlled-access mode:
coded but dormant behind `SUBSCRIPTIONS_ENABLED` (default `false`).
The Stripe webhook, API billing/pricing, `f1000`, and org tier-elevation paths
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
- Real paid activation requires coordinated server and frontend flag review, current
  provider pricing/checkout validation and an authorized launch decision; do not
  assume changing one server flag activates the whole subscription journey.

Restoring public marketing and original plan visibility is separate from enabling
charges. Keep paid plans request-access while billing is dormant, and keep FORGE
FIELD ENGINEER free and invite-only rather than treating it as a paid plan.

**Why:** The user requested the landing page and original subscriptions back with
current features; the existing private-access/billing deferral was not an instruction
to charge customers or remove protected-workflow gates.

**How to apply:** Public feature copy must distinguish usable internal lanes from
conditional external verification/release, and must not promise unsupported
certification, unlimited capacity or unreviewed enterprise terms.
