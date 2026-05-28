# ARK Platform — LLM Usage Guardrail PDD

**Document:** Product Design Document — LLM Usage Guardrail
**Phase Anchor:** Phase O (Revenue Model Audit / MVCC-ECO-001)
**Status:** Active — flag-gated (`FEATURE_REVENUE_GUARDRAIL`), default OFF
**Audience:** Product, Engineering, Finance, Sales (Enterprise), Support
**Last updated:** 2026-05-28
**Owner:** Platform Economics WG

---

## 1. Purpose

This PDD captures the **operating constraints** that the Phase O Revenue Guardrail imposes on every future iteration of ARK, up to and including the full PDD roadmap. It is not a re-statement of Phase O's implementation — that lives in `replit.md → Stage 1 — MVP` and the codebase. This document tells future authors **what they cannot do, what they must remember to do, and where the sharp edges sit** when they design any new AI-touching surface.

The single business invariant this guardrail enforces:

> **The 10% Rule** — AI cost of goods sold (COGS) must not exceed **10% of subscription revenue** for any user tier, measured per billing period per seat.

Every constraint below exists in service of that invariant. If a future design would violate the 10% Rule, the design — not the guardrail — needs to change.

---

## 2. Architectural contract

### 2.1 The two-gate budget

Every AI call path **must** pass three gates in this exact order before invoking `getAnthropic().messages.create(...)`:

```
enforceBudget(userId, plan)         // token cap (V1 or V2 picker)
enforceCostBudget(userId, plan)     // cents cap — fires first under Sonnet-heavy traffic
assertModelAllowed(plan, model, kind) // per-tier model policy
```

Skipping any single one silently breaks the 10% Rule. **There is no compile-time enforcement of this ordering** — reviewers and the architect subagent are the safety net.

**Action item for the next phase:** wrap the three calls in a single `guardedClaudeCall({ userId, plan, model, kind, run })` helper so future call sites become physically incapable of forgetting a gate. This is the highest-leverage hardening the platform can do before Phase P ships any new AI surface.

### 2.2 Why cost-denominated, not just token-denominated

A single token cap was bypassable by Sonnet-output-heavy traffic. At Sonnet pricing (~$15 / Mtok-out vs Haiku ~$1.25 / Mtok-out), the same token budget translates to **~12× the COGS** depending on model mix. The cost cap fires independently and is the gate that actually defends the 10% Rule under pathological traffic.

The CI test `npm run test:revenue` proves on every build that the token cap × worst-case Sonnet-output cost ≥ the cost cap for every paid tier — i.e. the cost gate is *always* the binding constraint under adversarial traffic, never a vestigial check.

### 2.3 Tier-cap derivation

| Tier              | Token cap (V2) | Cost cap   | Derivation                       |
|-------------------|---------------:|-----------:|----------------------------------|
| INDIVIDUAL_FREE   | 20,000         | $0.30      | **Absolute floor** (price is $0) |
| SCHOOL_STUDENT    | 180,000        | $0.90      | round($9 × 10%)                  |
| INDIVIDUAL_PRO    | 580,000        | $2.90      | round($29 × 10%)                 |
| ENTERPRISE        | 2,000,000      | $20.00     | **Bespoke** ($0 sentinel price)  |

Only PRO and SCHOOL follow the literal `round(price × 10%)` formula. FREE and ENTERPRISE are exceptions and **must** be encoded explicitly in any new invariant test — do not loop them through the formula.

---

## 3. Constraints on future phases

These are the rules that bind every PDD section past Phase O. They are listed in roughly descending order of how much pain they save when respected up front.

### 3.1 FREE is permanently Haiku-only

Any future spec that says *"show free users a Claude-graded preview"*, *"give free trials a Sonnet narrative"*, or *"let the free demo speak in our voice"* is a **non-starter** without redesign.

- Design FREE-tier features around Haiku capabilities or pre-computed templates.
- The conversion story must be **"upgrade to unlock Sonnet"**, never **"here's a taste of Sonnet."**
- This applies to public demos (`/demo`), shared sessions, embedded widgets, and any future "AI assistant" UX — the moment a non-authenticated or FREE-tier path can reach Sonnet, the guardrail is meaningless.

### 3.2 PRO's token bonus is an explicit transfer from FREE

The +16% token headroom that PRO received in V2 (500k → 580k) was created by plugging the FREE `useClaude` leak. Reintroducing **any** FREE → Claude vector silently steals back from PRO.

**Hard contract:** treat the FREE 20k monthly + 1 KCSE/day caps as immovable. If a new feature needs FREE-tier AI, the design must propose **what to take away** from the FREE budget to fund it, not just add the capability.

### 3.3 Price changes are now coupled to the CI test

The day product changes any paid tier's price (e.g. PRO $29 → $39, new SCHOOL_TEAM tier, EDU discount), the following **must move in the same commit**:

1. `SUBSCRIPTION_PLANS[tier].price` in `shared/schema.ts`
2. `AI_TIER_COST_BUDGET_CENTS[tier]` (= `round(price × 10)`)
3. `AI_TIER_MONTHLY_TOKENS_V2[tier]` if the cost cap shift now allows more headroom
4. The CI test `server/__tests__/revenueGuardrail.test.ts` if the tier set changed

**Process action:** add this to the pricing-change PR template. Otherwise the build breaks at merge time and whoever is editing pricing will not understand why.

### 3.4 ENTERPRISE is per-seat, not per-org

Today the cost cap enforces $20/seat/month against `req.session.userId`. As soon as Sales negotiates an **org-level pooled budget** (10 seats × $20 shared, $200 burstable across the team), the cap shape has to change from per-user to per-`enterpriseAccountId`.

**Forward action for the Enterprise PDD section:** specify pool semantics now (per-seat, pooled, or hybrid with per-seat overflow) so engineering doesn't retrofit it under a customer escalation.

### 3.5 Two failure modes, two UX surfaces

Users can now hit *"out of tokens"* OR *"out of cost budget"* — and under Sonnet-heavy use, the cost cap fires **first**. The current `AiBudgetBanner` collapses both into a single composite `ratioPct`. This is fine for Stage 1 MVP but will fail PRO users on heavy-narrative days who hit the wall without understanding why.

**Future banner spec:**

- **80–99% utilization** → amber banner with the binding constraint named: *"Sonnet quota almost spent. Switch to Haiku for the rest of the period or upgrade."*
- **100% on cost cap, headroom on tokens** → crimson banner offering Haiku-only mode for the remainder of the period.
- **100% on both** → crimson banner with upgrade CTA only.

### 3.6 Cache and the cost cap must stay friends

`server/ai/spcAnalysis.ts` is the reference implementation: it does cache lookup **before** any gate call. **Every** new AI feature must preserve this ordering. Otherwise:

- Cached responses (which cost $0) artificially burn budget headroom in metrics.
- FREE users hit their 30¢ cap on identical re-queries that should have been free.
- Marketplace flows where many users read the same SPC produce N× the cost in the ledger for 1× the actual spend.

**Rule:** `cache.get` → return if hit → otherwise `enforceBudget` → `enforceCostBudget` → `assertModelAllowed` → call → `cache.set` → `logUsage`.

### 3.7 Flag-lift day is a breaking change, not a feature launch

When `FEATURE_REVENUE_GUARDRAIL=true` is flipped in production:

- SCHOOL_STUDENT loses 10% of monthly tokens (200k → 180k).
- FREE loses 80% of daily KCSE quota (5/day → 1/day).
- Any FREE user currently passing `useClaude:true` to `/api/ccge/sessions/:id/finish` immediately starts getting 402s.

**Required before flip:**

1. **Grandfather window**, ideally implemented as `GUARDRAIL_GRANDFATHER_UNTIL=YYYY-MM-DD` env var that keeps V1 caps for users whose `createdAt < flip date` until the grandfather date.
2. **Heads-up email** to active FREE and SCHOOL users at least 14 days prior.
3. **In-product notice** on `/dashboard` and `/play` for the same 14-day window.
4. **Support runbook** with copy for the three likely tickets ("why am I getting 402?", "where did my AI go?", "I was using more yesterday").

Skipping these turns flag-lift into what *looks like* a regression to the support team and users.

### 3.8 Marketplace + creator-side AI is the next gap

Phase O guards **consumption-side** AI (users requesting Claude). It does **not** guard **creator-side** AI flows that are likely in future SPHINX phases — e.g. *"auto-grade my listing"*, *"Claude-rewrite my SPC"*, *"AI-generate listing thumbnail"*.

If a future phase lets creators trigger AI and pays for it with **SPHINX credits**, that creates a **credit → Claude inference** conversion path that bypasses the per-tier cost cap entirely. A FREE creator with 1,000 earned credits could effectively buy unlimited Sonnet output.

**Required design for any creator-side AI phase:**

- Credits-to-AI conversion must convert to **cents at canon prices** and respect the same `enforceCostBudget` gate against either the creator's tier cap or a separate `CREATOR_AI_BUDGET_CENTS` pool.
- Auto-grade and Claude-rewrite flows must be **rate-limited per listing**, not just per user.

### 3.9 Streaming / live narratives are the trickiest fit

The cost cap reads post-completion `usage.input_tokens + usage.output_tokens` from the Anthropic SDK response. This works for request/response flows. It does **not** work cleanly for:

- **Server-sent events / streaming Claude responses** — usage is only available at stream end. A user who force-closes mid-stream at 99% completion pays nothing in budget but consumed real tokens.
- **Long-running agent loops** that issue many small Claude calls inside one user request — each call gates individually, so the user can be 50% over budget before the loop's next iteration checks.

**Required design pattern for streaming/agent phases:**

1. **Pre-charge an estimated cost** (`max_tokens` × Sonnet-output price) against the cost cap at request start.
2. **Refund the delta** (`estimated − actual`) on stream completion via a negative ledger entry.
3. **Hard timeout** any agent loop at a known max wall-clock so cost is bounded even on bug.
4. **Per-iteration recheck** of the cost cap inside any agent loop — never trust the entry-time gate for a multi-call flow.

If Phase J's live ARK identity narrative ever moves to streaming, this becomes mandatory.

### 3.10 Banner-driven conversion funnel

The `AiBudgetBanner` at 80% utilization is now an implicit **conversion driver**:

- FREE → PRO funnel: only FREE users who consume ≥ 80% of 20k tokens (~16k) will ever see the upgrade CTA. Low-engagement FREE users (the majority) never see it.
- SCHOOL → PRO funnel: same shape, harder threshold (180k tokens).
- PRO → ENTERPRISE funnel: doesn't exist today; the banner just says "you're out, come back next month."

**Forward action for the Growth PDD section:** model the 80% conversion funnel explicitly. If the conversion math requires more FREE → PRO traffic than 80%-utilizers will produce, the upgrade prompt needs an additional surface (e.g. an aspirational nudge at 50% with a different copy track).

---

## 4. Decision matrix for new AI features

Use this checklist when scoping any future phase that touches Claude:

| Question                                                                   | If YES                                                                                                      | If NO                                                                                |
|----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| Does this feature surface to FREE-tier users?                              | Haiku-only path. No Sonnet calls anywhere on this surface.                                                  | Free to choose model per business need.                                              |
| Does this feature stream responses?                                        | Implement pre-charge + delta-refund pattern (§3.9).                                                         | Standard 3-gate pattern is sufficient.                                               |
| Does this feature run an agent loop / multi-call?                          | Recheck the cost cap inside the loop. Set a hard wall-clock timeout.                                        | Single gate at entry is sufficient.                                                  |
| Does this feature let creators or sellers trigger inference?               | Add `CREATOR_AI_BUDGET_CENTS` pool **or** charge creator's own tier cap. Rate-limit per listing. (§3.8)     | Standard consumer-side pattern.                                                      |
| Does this feature cache outputs?                                           | Cache lookup MUST precede all gate calls. Log cache hits at `costCents=0`. (§3.6)                           | N/A.                                                                                 |
| Does this feature change a tier price or add a tier?                       | Update `AI_TIER_COST_BUDGET_CENTS` in the same commit. CI test will catch you. (§3.3)                       | N/A.                                                                                 |
| Does this feature give ENTERPRISE customers a pooled / shared experience?  | Specify pool semantics (per-seat, pooled, hybrid). Engineering must implement before first enterprise sale. | Per-seat default is fine.                                                            |

---

## 5. Glossary

- **10% Rule** — AI COGS ≤ 10% of subscription revenue per tier per period. The single business invariant this PDD defends.
- **Two-gate budget** — token cap (`enforceBudget`) + cost cap (`enforceCostBudget`), enforced as independent ceilings, whichever fires first wins.
- **Model policy** — per-tier allowed-model list + `useClaude` permit flag, enforced by `assertModelAllowed`.
- **V1 / V2 caps** — V1 = pre-Phase O legacy tables, V2 = rebalanced Phase O tables. Picker is flag-aware via `revenueGuardrail`.
- **AiKind** — usage taxonomy (`kcse`, `narrative`, `scenario_gen`) used by quota and policy lookups. SPC analysis intentionally maps to `narrative`.
- **Guardrail flag** — `FEATURE_REVENUE_GUARDRAIL` (env) / `revenueGuardrail` (code). Default `false`. Flipping it is a **breaking change**, not a feature launch (§3.7).
- **Grandfather window** — proposed `GUARDRAIL_GRANDFATHER_UNTIL` mechanism to soften the flag-lift impact for existing users.
- **Cost cap binding** — under Sonnet-heavy traffic the cost cap is always the binding constraint, proven by `npm run test:revenue`.

---

## 6. Non-goals

This PDD does **not** specify:

- The exact Anthropic SDK call shape, retry policy, or backoff — those live in `server/ai/client.ts`.
- Specific Claude prompt templates — those are per-feature concerns.
- Billing or invoicing logic — that lives in `server/billing.ts` and the Billing PDD section.
- The pricing strategy itself (why $29, why 10%) — that lives in the Revenue Model PDD section.

This PDD's scope is strictly the **operating constraints** on AI-touching code paths.

---

## 7. References

- Implementation source of truth: `replit.md → Stage 1 — MVP` (feature flag layering) and `replit.md → Current Phase — J` (live ARK identity surface).
- Schema constants: `shared/schema.ts → AI_TIER_*` block (~lines 859–948).
- Gate helpers: `server/ai/usage.ts`, `server/ai/client.ts`.
- Call sites: `server/ai/{kcse,narrative,scenarioGen,spcAnalysis,identity}.ts`.
- Route gate: `server/routes.ts → /api/ccge/sessions/:id/finish`.
- Status endpoint: `server/routes.ts → /api/ai/status`.
- Banner: `client/src/components/layout/AiBudgetBanner.tsx`.
- CI invariant: `server/__tests__/revenueGuardrail.test.ts` — run via `npm run test:revenue`.
- Memory note: `.agents/memory/revenue-guardrail.md`.
- Threat model: `threat_model.md → External/AI surfaces`.
