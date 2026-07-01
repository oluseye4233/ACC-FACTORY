---
name: Deferring a billing feature (project credits)
description: What to gate when putting a per-project credit feature dormant behind the subscription flag
---

Deferring a per-project credit feature (Cartridge, Ingestion) behind the
subscription flag is NOT just hiding the "buy" button. Four surfaces must move
together or staff get blocked while billing is off:

1. **Enforcement** (server route that consumes a credit) — bypass when off.
2. **Purchase checkout** (server) — already gated via requireSubscriptionsEnabled.
3. **Balance summary endpoint** (GET *-credits) — short-circuit to a dormant
   zeroed summary `{available:0,consumed:0,total:0}` when `!subscriptionsEnabled()`,
   rather than returning the raw ledger.
4. **Frontend** — hide the credit card, disable the balance fetch
   (`query.enabled = BILLING_ENABLED`), AND relax any action gate keyed on
   `available` (e.g. the cartridge build button/`handleSubmit` block on
   `available < 1` → `BILLING_ENABLED && available < 1`).

**Why:** #4 is the trap. If you hide the card but leave `available < 1` gating
the action, the build/ingest button stays disabled even though the server no
longer charges — staff can't work. The server flag is `subscriptionsEnabled()`
(SUBSCRIPTIONS_ENABLED); the frontend mirror is `BILLING_ENABLED` in
`command-centre/src/lib/billing-flag.ts`.

**How to apply:** any new per-project paid feature added while the product is in
internal-staff mode must repeat all four gates, and re-activate in lockstep when
the flags flip on.

**Gotcha:** the generated orval `useQuery` options type here requires `queryKey`
alongside `enabled`; pass `queryKey: getGet<Name>QueryKey()` or it fails
typecheck (TS2741).
