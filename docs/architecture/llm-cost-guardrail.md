# ATANDA Command Centre — LLM Usage Guardrail Policy

**Document:** Operating constraints for AI-touching surfaces
**Status:** Active — runaway-spend ceiling shipped; 10% Rule caps proposed, not yet enforced
**Audience:** Engineering, Product, Finance, Support
**Last updated:** 2026-05-28
**Owner:** Platform Economics

---

## 1. Purpose

This document captures the **operating constraints** every future feature that touches an LLM must respect. It does not re-state the current implementation — that lives in `replit.md` and `docs/architecture/features.md → Per-user LLM cost dashboard + monthly cap`. This tells future authors **what they cannot do, what they must remember to do, and where the sharp edges sit** when they add or change any HARNESS engine or any other LLM-fronted surface.

Two business invariants. The first is already shipped; the second is the next target.

> **Invariant 1 (live).** **Runaway-spend ceiling.** No single user — paid or not — can burn more than a hard monthly cap of LLM spend before being refused. The cap defends Replit AI Integrations / Anthropic spend against a stuck loop, a compromised account, or a malicious automation.

> **Invariant 2 (target).** **The 10% Rule.** AI cost of goods sold should not exceed **10% of subscription revenue** for any paying tier, measured per billing period per subscriber. Today's runaway-spend caps are **5–10× looser than this rule** — they are a kill-switch, not a margin defender. Tightening them is a deliberate product decision (§3.2).

If a future design would violate either invariant, the design — not the guardrail — needs to change.

---

## 2. Architectural contract

### 2.1 The two-and-a-half-gate budget (today)

Every HARNESS route in `artifacts/api-server/src/routes/harness.ts` **must** pass these middlewares, in this exact order, before any LLM call:

```ts
router.post(
  "/harness/<engine>",
  requireAuth,            // 1. Clerk session → req.localUser, req.subscriber, req.effectiveTier
  rateLimit(featureId),   // 2. Per-day, per-engine cap. Resets at 00:00 UTC.
  requireCostBudget,      // 3. Live monthly SUM vs MONTHLY_COST_CAP_USD[effectiveTier].
  handleEngine,           // … then the engine fires.
);
```

The "and-a-half" is the provider gate in `routes/sessions.ts`: choosing a non-Claude provider returns `403 PROVIDER_REQUIRES_TIER` for EXPLORER. Once chosen, the session sticks to that provider for the duration, so the cost cap covers it regardless of model.

**There is no compile-time enforcement of this ordering.** The architect subagent and the always-on Top-5 gotcha in `replit.md` are the safety net. Skipping any one middleware silently breaks at least one of the invariants — `rateLimit` without `requireCostBudget` lets a power user burn cash; `requireCostBudget` without `rateLimit` lets a single user dominate the day's LLM throughput.

**Hardening (live).** Every engine route now goes through the `harnessRoute({ featureId, tier?, extra?, handler })` factory in `routes/harness.ts`. The factory composes the canonical stack — `requireAuth → requireTier? → rateLimit(featureId)? → ...extra? → requireCostBudget → handler` — so a future engine route physically cannot drop `requireCostBudget` or get the order wrong. New engines must register through it; do not hand-roll the middleware list on a `router.post` call.

### 2.2 Why cost-denominated, not just rate-denominated

`rateLimit` counts *requests per day*. A power user with `unlimited` (`-1`) on every engine can issue thousands of F7 streams in a day; F7 in particular fans out four sub-prompts and can run >$0.50 per call on long inputs. The same daily-call cap translates to wildly different real cost depending on input length and the chosen provider.

`requireCostBudget` reads the actual logged `cost_usd` from `harness_engine_runs` (the same value the dashboard sums) so the cap binds against dollars actually spent at canon Anthropic prices, not against a proxy. Under "Sonnet-heavy / long-input" traffic the cost cap is the binding constraint; under "many cheap calls" the rate-limit is. The combination defends both adversarial shapes.

### 2.3 Tier-cap derivation

| Tier              | Personal price (mo) | Current cap (live) | 10% Rule cap (target) | Notes                                           |
|-------------------|--------------------:|-------------------:|----------------------:|-------------------------------------------------|
| EXPLORER          |              $0     |             $2.00  |          $0.30 (floor) | F8 disabled; F1–F7 throttled in `RATE_LIMITS`.  |
| PRACTITIONER      |             $49     |            $50.00  |          $4.90        | Daily caps on F5–F7; F8 disabled.               |
| ARCHITECT         |            $199     |           $250.00  |         $19.90        | Unlimited F1–F7; F8 = 2/day.                    |
| INSTITUTION       |            ~$149/seat |        $2000.00  |     ~$14.90/seat      | Team seat (per-seat). Unlimited F8.             |
| INSTITUTION (Team Lite) |        ~$99/seat |         $250.00  |      ~$9.90/seat      | Elevates personal tier to ARCHITECT; 2 F8/day.  |

Only PRACTITIONER and ARCHITECT follow the literal `round(price × 10%)` formula. EXPLORER and INSTITUTION-per-seat are **exceptions** and must be encoded explicitly in any future invariant test — do not loop them through the formula.

The gap between "current cap" and "10% Rule cap" is intentional. Today's caps are a **runaway-spend ceiling** sized at 5–10× a power user's expected month. Tightening to 10% is a deliberate switch (see §3.2 — flag-lift is a breaking change, not a release).

---

## 3. Constraints on future phases

Listed in roughly descending order of how much pain they save when respected up front.

### 3.1 EXPLORER stays gated; never an "AI taste" path

Any future spec that says *"give EXPLORERs a Claude-graded preview"*, *"let the free demo speak in our voice"*, or *"show un-throttled F7 output on `/demo`"* is a **non-starter** without redesign.

- Design EXPLORER-tier and demo surfaces around **cached / pre-computed exemplars** (the existing `/exemplars` library is the canonical pattern) or the strictly throttled `RATE_LIMITS.EXPLORER` quota.
- The conversion story must be **"upgrade to unlock unlimited F1–F7 and F8 Code DJ"**, never **"here's a taste of unlimited."**
- This applies to public demos, shared sessions, embedded widgets, and any future "AI assistant" UX — the moment a non-authenticated or EXPLORER path can reach an un-rate-limited engine, the guardrail is meaningless.

### 3.2 The cap-tightening day is a breaking change, not a release

The day Finance decides to enforce the literal 10% Rule (move PRACTITIONER from $50 → $4.90, ARCHITECT from $250 → $19.90, etc.), the following **must move in the same release**:

1. `MONTHLY_COST_CAP_USD` in `artifacts/api-server/src/lib/tier.ts`.
2. An invariant test that asserts `MONTHLY_COST_CAP_USD[tier] === round(price_usd * 0.10)` for PRACTITIONER and ARCHITECT, with explicit exceptions for EXPLORER (floor) and INSTITUTION (per-seat).
3. A **grandfather window** (live mechanism). Three env vars cooperate, all UTC: `COST_CAP_GRANDFATHER_UNTIL=YYYY-MM-DD` (the day grandfathered users lose the legacy cap), `COST_CAP_LEGACY_CUTOFF=YYYY-MM-DD` (only subscribers created strictly before this date are grandfathered), and per-tier `MONTHLY_COST_CAP_LEGACY_<TIER>` (USD, the value the grandfathered user keeps). All three must be set for a user to receive a legacy cap; any missing/malformed value falls back to the live `MONTHLY_COST_CAP_USD` (fail-strict toward the new cap, never accidentally elevate). See `lib/cost-budget.ts#resolveTierDefaultCapUsd`. Per-subscriber overrides still win regardless of grandfather state.
4. **Heads-up email** to active paying users at least 14 days prior, naming the new cap and the date.
5. **In-product notice** on `/me/costs` and the dashboard for the same 14 days.
6. **Support runbook copy** for the predictable tickets ("why am I getting 402 today when I was fine yesterday?", "where did my AI budget go?").

Skipping these turns the cutover into what looks to support like a regression and to users like a silent downgrade.

### 3.3 Price changes are coupled to the cap

The day product changes any paid tier's price (PRACTITIONER $49 → $59, new INDIVIDUAL_PLUS tier, EDU discount), the following must move in the **same commit**:

1. The Stripe price id in env (`STRIPE_PRICE_*`).
2. `MONTHLY_COST_CAP_USD[tier]` in `lib/tier.ts` (= `round(new_price_usd * 0.10)` once §3.2 is live).
3. `RATE_LIMITS[tier]` if the new headroom warrants it.
4. The invariant test from §3.2.

Add this to any pricing-change PR checklist.

### 3.4 INSTITUTION is per-seat, NOT per-org

Today `requireCostBudget` sums `harness_engine_runs.user_id` and caps against the elevated tier's per-seat cap. That is the right shape for the **current** Team product — every seat gets its own envelope.

The moment Sales negotiates a **pooled org budget** ("10 seats × $20 shared, $200 burstable across the team"), the cap shape has to change from per-`user_id` to per-`organization_id`. Specify pool semantics in the same release that introduces the SKU (per-seat / pooled / hybrid-with-per-seat-overflow) so engineering does not retrofit it under a customer escalation.

### 3.5 Two failure modes, distinct UX

Users can now hit two distinct walls:

- `429 RATE_LIMIT_EXCEEDED` from `rateLimit` — "you've hit today's F7 cap, retry in N hours."
- `402 COST_CAP_EXCEEDED` from `requireCostBudget` — "you've hit this month's spend cap, retry in N days or contact admin."

`/me/costs` covers the cost-cap surface (amber at 80%, red at 100%). The rate-limit error currently surfaces inline at each engine UI. **Do not** collapse the two into a single composite "you're throttled" banner — they have completely different remediation (wait hours vs. wait weeks / upgrade tier / request admin override).

**Future banner spec (when monthly thresholds become email events):**

- **80–99% utilization on cost cap** → amber dashboard nudge + one email per period.
- **100% on cost cap, headroom on rate-limits** → crimson dashboard banner, blocking modal at engine invocation, upgrade CTA.
- **100% on both** → crimson dashboard banner, upgrade CTA only.

### 3.6 Cache and the cost cap must stay friends

This codebase does not (yet) cache LLM completions in production. The provider-switching test suite caches by request fingerprint into `test/__fixtures__/llm/<provider>/*.json` — that is a **test-only** path and must never become a production short-circuit.

**Rule for any future production cache** (e.g. memoising F1 diagnose for identical raw prompts, sharing F5 SPC across an org): `cache.get` → return if hit → otherwise `rateLimit` → `requireCostBudget` → call → `cache.set` → `logHarnessRun(cost_usd=0)`. Cached responses must log `cost_usd = 0` (or a small fixed cache-serve cost) so they neither burn budget headroom nor inflate the dashboard.

Skipping this order turns a "popular shared SPC" into N× billing for 1× real spend.

### 3.7 Marketplace + creator-side AI is the next gap

The current guardrail protects **consumption-side** AI — a user requesting their own engine run. It does **not** yet protect **creator-side** flows that are likely in future Sphinx Marketplace phases — *"auto-grade my listing"*, *"Claude-rewrite my SPC for clarity"*, *"AI-generate exemplar metadata"*.

If a future phase lets creators trigger AI and pays for it with Sphinx credits, that creates a **credit → LLM inference** conversion path that bypasses the per-tier cost cap entirely. An EXPLORER creator with 10,000 earned credits could effectively buy unlimited Sonnet.

**Required design for any creator-side AI feature:**

- Credits-to-AI conversion must convert to **USD at canon prices** and respect `requireCostBudget` against either the creator's personal tier cap **or** a separate `CREATOR_AI_BUDGET_CENTS` pool that is independently sized.
- Auto-grade and AI-rewrite flows must be **rate-limited per listing** (not just per user) so one creator does not blanket-grade their entire catalogue overnight.

### 3.8 Streaming engines (F3, F7) need a pre-charge pattern before going long

`handleF3Stream` (CELL Birth Package) and `handleF7Stream` (SPARTAN MVP PDD compression) are both SSE. They read `usage.input_tokens + usage.output_tokens` **at stream end** and log to `harness_engine_runs` only then. This works fine for the current ~30–90s streams.

It breaks the moment we add:

- **A longer multi-stage stream** — a user who force-closes mid-stream at 99% completion pays nothing in the ledger but consumed real tokens.
- **A multi-call agent loop inside one HTTP request** — each sub-call hits the LLM but only the outer request hits `requireCostBudget`; the user can be 50% over cap before the loop's next iteration checks.

**Required design pattern for any streaming feature longer than ~2 minutes or any agentic multi-call engine:**

1. **Pre-charge an estimated cost** (`max_tokens × Sonnet-output canon price`) against the cost cap at request start (insert a `harness_engine_runs` row with `status='pending'` and the estimate as `cost_usd`).
2. **Reconcile** on stream completion: update the row's `cost_usd` to the actual value (refund headroom if estimate > actual; warn-log if actual > estimate by a fixed multiple).
3. **Hard wall-clock timeout** on any agent loop so cost is bounded even on bug.
4. **Per-iteration recheck** of `currentMonthCostForUser` inside any agent loop — never trust the entry-time gate for a multi-call flow.

Until this lands, no streaming engine should advertise a max duration > 3 minutes or be implemented as an agent loop.

### 3.9 One-time products (Ingestion $199.99, Cartridge $499.99) are pre-paid budget, not bypass tickets

The ingestion and cartridge SKUs are one-time purchases that grant the buyer a single full session each. They **do** count against the buyer's monthly cost cap — there is no carve-out in `requireCostBudget`. This is intentional:

- A $199.99 ingestion credit on an EXPLORER who cannot otherwise reach $2/mo will instantly trip the cap unless an admin override or a temporary tier elevation is in place.
- The current handling is: an EXPLORER who buys Ingestion or Cartridge automatically has their effective cap raised by a credit-tied bonus envelope (admin-set override or per-credit envelope — TODO before either SKU goes GA to EXPLORERs).

**Required design for any new one-time-paid AI session SKU:**

- Either set `monthlyCostCapUsdOverride` on the buyer's subscriber row for the calendar month of the purchase (operationally simple, mixes with regular spend), **or** introduce a separate `oneOffCreditBudgets` table that `requireCostBudget` checks alongside the monthly cap (cleaner, requires schema work).
- Document the choice in the SKU's PDD; never ship a "this purchase bypasses the cap" path without one of the above.

### 3.10 Banner-driven conversion funnel

The `/me/costs` amber band at 80% is now an implicit **conversion driver**:

- EXPLORER → PRACTITIONER funnel: only EXPLORERs who reach 80% of $2 (~$1.60) ever see the upgrade nudge organically. Most don't.
- PRACTITIONER → ARCHITECT funnel: same shape, higher threshold ($40).
- ARCHITECT → INSTITUTION funnel: doesn't exist yet — the cap message just says "wait until next month."

If conversion targets call for more upgrade traffic than 80%-utilizers will produce, the upgrade prompt needs a second surface (an aspirational nudge at 50% with different copy: "you're using N% of the cheapest tier, here's what unlocks at the next one"). Spec this in the Growth section of any future PDD that depends on conversion lift.

---

## 4. Decision matrix for new AI features

Use this when scoping any future phase that touches an LLM.

| Question                                                              | If YES                                                                                                  | If NO                                              |
|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| Does this feature surface to EXPLORER or unauthenticated users?       | Cached exemplars or strict `RATE_LIMITS.EXPLORER` quota only. No un-throttled engine reachable. (§3.1)  | Standard per-tier policy applies.                  |
| Does this feature stream responses for > 2 minutes?                   | Implement pre-charge + reconcile pattern. (§3.8)                                                        | Standard 3-gate pattern is sufficient.             |
| Does this feature run an agent loop / multi-call?                     | Per-iteration cost-cap recheck + hard wall-clock timeout. (§3.8)                                        | Single entry-time gate is sufficient.              |
| Does this feature let creators / sellers trigger inference?           | `CREATOR_AI_BUDGET_CENTS` pool **or** charge creator's tier cap, **plus** per-listing rate limit. (§3.7) | Standard consumer-side pattern.                    |
| Does this feature cache outputs?                                      | Cache lookup MUST precede gates; cache hits log `cost_usd=0`. (§3.6)                                    | N/A.                                               |
| Does this feature change a tier price or add a tier?                  | Update `MONTHLY_COST_CAP_USD`, `RATE_LIMITS`, and the invariant test in the same commit. (§3.3)         | N/A.                                               |
| Does this feature give INSTITUTION a pooled / shared experience?      | Specify pool semantics (per-seat / pooled / hybrid). Implement before first pooled sale. (§3.4)         | Per-seat default is correct.                       |
| Does this feature add a new HARNESS engine route?                     | Mount `requireAuth` → `rateLimit(id)` → `requireCostBudget` → handler. No exceptions. (§2.1)            | N/A.                                               |
| Does this feature add a one-time-paid AI session SKU?                 | Either set `monthlyCostCapUsdOverride` for the buyer's month, or introduce a `oneOffCreditBudgets` table. (§3.9) | N/A.                                       |

---

## 5. Glossary

- **Runaway-spend ceiling** — current `MONTHLY_COST_CAP_USD` values: $2 / $50 / $250 / $2000. Defensive kill-switch, not a margin defender.
- **10% Rule** — target invariant: AI COGS ≤ 10% of subscription revenue per tier per period. Not yet enforced (see §3.2).
- **Effective tier** — the larger of the user's personal subscriber tier and any active team-org seat tier. Computed by `lib/orgs.ts#effectiveTierFor` and stamped on `req.effectiveTier` by `requireAuth`. Every gate must use the effective tier, never the raw personal one.
- **Engine route** — any route under `/api/harness/*`. Every one must carry the 3-gate stack (§2.1).
- **Live SUM cap** — `requireCostBudget` reads `SUM(cost_usd) FROM harness_engine_runs WHERE user_id = $1 AND created_at >= date_trunc('month', now() at time zone 'utc')`. No cached counter, no monthly-reset cron.
- **Admin override** — `subscribers.monthly_cost_cap_usd_override numeric(12,2)`. Non-null wins over the tier default. Set via `PATCH /api/admin/subscribers/:userId/cost-cap`.
- **Fail-open** — when the SUM query throws, `requireCostBudget` allows the request through (logged warn). Deliberate. Rate-limit gates still apply.

---

## 6. Non-goals

This document does **not** specify:

- The Anthropic SDK / Replit AI Integrations call shape, retry policy, or backoff — those live in `lib/integrations-anthropic-ai`.
- Specific engine prompt templates — `artifacts/api-server/src/engines/prompts.ts`.
- Stripe billing logic — `artifacts/api-server/src/routes/stripe-webhook.ts`.
- The pricing strategy itself (why $49 / $199, why 10%) — that belongs in a Revenue Model PDD.

This document's scope is strictly the **operating constraints** on LLM-touching code paths.

---

## 7. References

- Always-on gotcha: `replit.md → Top-5 gotchas → #6 requireCostBudget`.
- Architecture: `docs/architecture/features.md → Per-user LLM cost dashboard + monthly cap`.
- Hazards: `docs/architecture/gotchas.md → Cost cap`.
- Tier-cap source of truth: `artifacts/api-server/src/lib/tier.ts → MONTHLY_COST_CAP_USD`, `RATE_LIMITS`.
- Effective-tier resolver: `artifacts/api-server/src/lib/orgs.ts`.
- Gate implementation: `artifacts/api-server/src/lib/cost-budget.ts`.
- Engine route stack: `artifacts/api-server/src/routes/harness.ts`.
- Dashboard: `artifacts/command-centre/src/pages/me-costs.tsx`.
- Admin override endpoint: `artifacts/api-server/src/routes/cost.ts → PATCH /api/admin/subscribers/:userId/cost-cap`.
- Provider tier gate: `artifacts/api-server/src/routes/sessions.ts → PROVIDER_REQUIRES_TIER`.
- Unit test (cap resolver): `artifacts/api-server/test/cost-budget.test.ts`.
