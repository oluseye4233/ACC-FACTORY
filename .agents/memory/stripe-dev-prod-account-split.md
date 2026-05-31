---
name: Stripe dev/prod account split
description: Why production billing can't be granted via a test-mode Stripe checkout, and how prod tier comps must be done instead.
---

# Stripe is a different account in prod vs dev

The Replit Stripe connector binds **different Stripe accounts per environment**:

- **development** → Stripe **TEST** mode (one account)
- **production** (published deployment) → Stripe **LIVE** mode (a *different* account)

This is why publishing demanded a "live account" and why a webhook/price created
for dev does not appear in prod (and vice-versa). The `STRIPE_PRICE_*` env vars are
shared-scope but their IDs belong to the **test** account, so they are invalid in the
live account — a live checkout would fail with "no such price" until live products
are created.

**Why:** Replit deployments use the live Stripe connection; dev uses test. They are
genuinely separate accounts (`acct_…` differ), not just different keys.

**How to apply:** You cannot grant a production subscriber tier with a test-mode
checkout (prod isn't in test mode → real charges, and prices/webhook aren't set up
in the live account). To comp/test an account on the LIVE deployment, use the
admin tier-grant path (`PATCH /api/admin/subscribers/:userId/tier`, admin-gated)
plus the `ADMIN_EMAILS` allowlist — NOT Stripe. A real subscription webhook will
later legitimately overwrite a comped tier.

Note: tier access is gated by TIER_RANK only (`lib/tier.ts requireTier`), not by
subscription `status` — so setting `tier` alone unlocks engines.
