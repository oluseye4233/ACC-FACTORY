# Features — implementation notes

Deep notes on each shipped feature surface. The slim `replit.md` index points here.

## HARNESS engines

Located at `artifacts/api-server/src/engines/{prompts,shared,f1,f2,f3,f4,f5,f6,f6vdj,f7,f8codedj,atlas-crystallise,pfp}.ts`. System prompts at v2 (anchored rubrics, calibrated escalation, deterministic FORGE script, audit-grade SPARTAN math).

**F8 "Code DJ"** (`/api/harness/f8`) is Architect-tier-only, consumes a SPARTAN-certified MVP-PDD/PWDD, and emits a `CODEBASE_BUNDLE` artifact (≤12 files + manifest) scaffolded against a chosen platform (`nextjs-vercel | react-vite-static | express-replit | expo-mobile | pnpm-monorepo`).

## ATLAS J — JSON Crystallisation

`/api/harness/atlas-crystallise`, Practitioner tier, engineId=10. Side-step engine that converts an existing `ATLAS_PDD` markdown bundle into a typed JSON view (`ATLAS_PDD_JSON` artifact, schemaVersion `atlas-pdd-v1`) with stable per-phase promptIds of the form `P-<PHASE>-<NNN>` (RED→WHITE rainbow), CLASS A/B/C classification, dependency edges, stack, routes, deployTarget. Deliberately kept as a separate endpoint (not folded into F6) so the F6 system prompt — and therefore the cached LLM fixture hashes used by the cross-provider test suite — stay byte-identical. Surfaced as the 5th "ATLAS J" tab in `F6DraftPdd.tsx`.

## PFP — PDD Fidelity Protocol / BUGMXT Layer 4

`/api/harness/pfp`, Practitioner tier, engineId=11. Drift detector that cross-references a SPARTAN-certified `MVP_PDD` against a `CODEBASE_BUNDLE` and emits a `PFP_REPORT` with the fixed 7-code taxonomy (`SPEC_DRIFT`, `PDD_ORPHAN`, `UNAUTHORIZED_EXTENSION`, `CIRCULAR_DEPENDENCY`, `SEMANTIC_DRIFT`, `OVER_SPECIFICATION`, `AMBIGUOUS_OUTPUT`), 4-rung severity ladder, FCI (Feature Coverage Index 0–100), and verdict `pass | pass_with_notes | fail`.

**`counts` and `verdict` are recomputed server-side from `findings` before persisting** — never trust the model's self-reported numbers, otherwise contradictory output silently bypasses the F8 gate.

F8 Code DJ enforces a hard drift gate: if `latestPfpForMvp(sessionId, userId, mvpPddArtifactId)` returns a report with `counts.critical > 0`, F8 refuses with HTTP 409 + `code: "DRIFT_GATE"` + the pfp metadata unless the request body carries `acknowledgeDrift: true`. The lookup filters by JSON path (`artifact_content->>'sourceMvpPddArtifactId'`) with `LIMIT 1`, so a busy session cannot push the relevant report past a row-window and silently bypass the gate. Frontend surfaces both the run button + findings table and the override checkbox on `F8CodeDj.tsx`.

## Organizations / team-seat subscriptions

Tables: `organizations` (Stripe customer/sub/price/seatsPurchased/status/plan), `organization_members` (role enum `owner|admin|member`), `organization_invites` (token + email + role + 14-day expiry + acceptedAt/revokedAt). `harness_sessions` gains nullable `org_id` + `org_visible` (the dedicated `PATCH /api/sessions/:id/org-visibility` endpoint in `routes/orgs.ts` writes both; no OpenAPI declaration).

Routes in `routes/orgs.ts`: CRUD on orgs, members (last-owner-protected via `ownerCount()`), invites (`POST /api/orgs/:id/invites` → `sendOrgInvite` email + tokenised acceptance via `POST /api/invites/:token/accept` with strict email match), and `/billing/{checkout,portal}` (Stripe checkout uses `mode=subscription`, `quantity=seats`, metadata `kind=team_subscription` + `orgId`).

**Webhook routes team-seat events to the org row, not the personal subscriber** — `applyTeamSeatSubscription()` is invoked when `metadata.kind === "team_subscription"` (on `checkout.session.completed`) OR the sub's price id is in `TEAM_SEAT_PRICE_IDS()` (on `customer.subscription.{created,updated,deleted}`). The same idempotency net (`stripe_webhook_events` PK) covers team-seat events identically.

### Effective-tier rule

`lib/orgs.ts#effectiveTier(personalTier, memberships)` returns `max(personalTier, best-of(conferred-tiers-from-active-memberships))` where each active membership confers a tier based on `organizations.plan`:

- `'team' → INSTITUTION` (unlimited everything incl. F8)
- `'team_lite' → ARCHITECT` (unlimited F1–F7, F8 capped at 2/day)

"Active" = org sub status in `{active, trialing}`. `requireAuth` calls `loadMembershipsForUser` after `ensureSubscriber` and attaches `req.effectiveTier` + `req.memberships`; on lookup failure it logs a warn and falls back to the personal tier so a transient DB blip cannot lock the portal. `requireTier` and `rateLimit` both read `req.effectiveTier ?? sub.tier` so a TEAM member transparently gets unlimited F8 (`RATE_LIMITS.INSTITUTION[8] = -1`) while a TEAM LITE member gets the 2 F8/day ARCHITECT cap. Daily rate-limit counters (`f{1..8}_today`) still live on the **personal** subscriber row even for elevated users — there is no per-org counter, but the limit check itself uses the elevated tier so unlimited tiers (INSTITUTION) bypass the column entirely.

### Org plan column

`organizations.plan` is a `text NOT NULL DEFAULT 'team'` column constrained at the app layer to `('team' | 'team_lite')` (see `ORG_PLANS` in `lib/db/src/schema/organizations.ts`). The webhook writes it from the Stripe price-id lookup on every team-seat sub event, so seat plan stays in lockstep with the Stripe price. `POST /api/orgs/:id/billing/checkout` accepts an optional `plan` body field (default `'team'`) and routes to the matching `STRIPE_PRICE_TEAM[_LITE]_SEAT_{MONTHLY,YEARLY}` env; missing env → 503 with the env-key name in the error so ops can see exactly which key to set.

## Notifications

`routes/notifications.ts` exposes `GET/PATCH /api/me/notification-preferences` (optional `orgId` for org-scope) plus a public token-gated `GET /api/notifications/unsubscribe/:token` that flips all three flags off in one shot. Rows live in `notification_preferences` keyed uniquely on `(user_id, organization_id)` (NULL org = personal scope) with a fresh 24-byte `unsubscribe_token` minted on first read.

Three dispatch paths in `lib/notification-dispatch.ts`:

1. **`runWeeklyDigest()`** driven by `POST /api/cron/send-weekly-digest` (cron-secret gated) — 7-day rollup per org of engine runs (org-visible sessions only, grouped by engine + member with cost totals) plus billing events for the org's Stripe customer; per-recipient `lastDigestSentAt` guard refuses re-send within 6 days so an extra tick can't double-mail.
2. **`dispatchBillingFailureForCustomer`** fires from the `invoice.payment_failed` webhook branch to every org owner/admin with `billingAlertsEnabled` (the personal-tier `sendPaymentFailed` to the paying user is unchanged).
3. **`maybeDispatchHighCostAlerts`** fires from `engines/shared.ts#recordRun` whenever a logged run's USD cost crosses a recipient's `highCostThresholdUsd` (default $1.00, off by default) — gated by `session.orgVisible && session.orgId` so personal runs never leak.

All three paths are fire-and-forget via `safeFire`, so a Resend outage never breaks a webhook ack or an engine response.

## Sphinx Marketplace integration

Per-user outbound publish from F5 SPC artifacts to the user's other Ark.Onecraft Sphinx Marketplace via bearer-token API key.

Table `integration_credentials` (unique on `(user_id, provider)`, provider currently only `sphinx`) stores `key_prefix` (first 16 chars verbatim, for UI masking) + `key_encrypted` (AES-256-GCM ciphertext `enc:<iv>:<ct>:<tag>` where the key is derived via scrypt from `SESSION_SECRET` — no new secret env required). Helper: `lib/integration-crypto.ts`.

Routes in `routes/integrations.ts`:

- `GET/POST/DELETE /api/integrations/sphinx` — status / paste / disconnect. Key regex `^sphinx_(live|test)_[A-Za-z0-9]{16,}$`, upsert on conflict so re-paste rotates.
- `POST /api/integrations/sphinx/publish` — validates SPC ownership + type, decrypts key on demand, POSTs to `${SPHINX_BASE_URL}/api/marketplace/listings` with `{source, externalId=artifact.id, title, spcKind:"F5_FULL_SPC", spcMarkdown, spcStructured, jcseScore, certTier, spartanCert, verificationUrl, license, visibility, author}`, persists `sphinxListing={listingId,listingUrl,publishedAt,license,visibility}` onto `artifact_content`, touches `last_used_at`.

Error codes: `SPHINX_NOT_CONNECTED|SPHINX_WRONG_TYPE|SPHINX_NOT_CONFIGURED|SPHINX_KEY_UNREADABLE|SPHINX_UNREACHABLE|SPHINX_BAD_KEY|SPHINX_REJECTED`.

Frontend: `SphinxConnect` card on Account → CONNECTED SERVICES; `PublishToSphinxButton` mounted next to EXPORT in `F5BuildSpc.tsx` — flips to a "View on Sphinx" link + RE-PUBLISH ghost button after first publish. Receiver-side code (api_keys table, bearer middleware, `/marketplace/listings` endpoint with idempotency on `(source, externalId, owner)`) is documented in `docs/integrations/sphinx-receiver.md` for paste into the Sphinx repo.

## Activity / audit log

`routes/activity.ts` exposes `GET /api/me/activity` (own data) and `GET /api/orgs/:id/activity` (owner/admin only — members get 403). Returns a UNION-CTE view of `harness_engine_runs` + `stripe_webhook_events` (joined to `command_centre_subscribers` by `stripe_customer_id`), with `from/to/engineId/sessionId/source/status/userIds/limit/offset` filters and `format=csv` export. The org route validates supplied `userIds` against `memberUserIdsForOrgs([orgId])` so a compromised admin cannot leak cross-org data by URL fuzzing.

## Advanced Cartridge — $499.99 / project

Premium standalone SKU for projects arriving with multi-document context, prior SPCs, and/or a live codebase / database link.

Tables: `cartridge_packages`, `cartridge_credits` (Stripe-session-id-unique, `available | consumed`), `cartridge_documents`, `cartridge_spcs`, `cartridge_links` (`kind ∈ {git, database}`, descriptor only — no credentials). `harness_sessions.cartridgeId` is FK-nullable; `origin='cartridge'` added to `SESSION_ORIGINS`.

Wizard at `/cartridge`: **Step 1 = Define Project Scope (REQUIRED, hard-validated server-side with code `SCOPE_REQUIRED`, min 80 chars scope + 12 chars outcome + non-empty projectName)** → Step 2 = optional files / SPCs / links.

`POST /api/cartridge` (multipart, manual parse — not declared in OpenAPI because Orval emits `Blob` refs that break api-zod tsconfig) atomically claims one credit (`lib/cartridge-credits.ts#claimCartridgeCredit`, `UPDATE ... FOR UPDATE SKIP LOCKED`), summarises each doc via the user's preferred provider, persists `cartridge_packages` + children in a single transaction, links the credit, then `POST /api/cartridge/:id/start-session` creates a session and unlocks F1–F7 as `AVAILABLE` in one shot.

**Cartridge context is the protected instruction layer** — `lib/cartridge-context.ts#loadCartridgeContext` is called once per request from `engines/shared.ts#callLlm` via `ctx.sessionId` (60-second LRU-by-mtime cache, max 24,000 bytes) and **prepended to every system prompt with the scope first, then assets, fenced as `=== CARTRIDGE CONTEXT (authoritative · do not contradict) ===`**.

Webhook handler in `routes/stripe-webhook.ts` checks `metadata.kind=cartridge_credit` **before** `ingestion_credit` (order matters; matches the same idempotency net). F8 Code DJ remains gated by Architect tier — it is not auto-run from cartridge start. Pricing card + TopNav link present. Drift: the orchestrator does not background-run F1→F7; the operator drives each engine from the session-detail page exactly like manual / ingested sessions, with the cartridge context auto-injected on every call.

## Ingestion — per-project billing

Ingestion is billed **per project, not by subscription tier**. Gating is **NOT** by tier — any signed-in user (Explorer included) can use it once they hold an ingestion credit.

`POST /api/billing/ingestion/checkout` opens a one-time Stripe Checkout (`mode=payment`, line item = `STRIPE_PRICE_INGESTION_PROJECT`, metadata `kind=ingestion_credit`). On `checkout.session.completed` the webhook inserts a row into `ingestion_credits` (`status='available'`) keyed by Stripe checkout session id (unique → idempotency net).

`POST /api/ingest` atomically claims one available credit at the start of the request via `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` (in `lib/ingestion-credits.ts#claimIngestionCredit`); on any error path the credit is released back to `available` so a fluke doesn't burn the purchase; on success it's linked to the resulting `ingestion_documents.id`. `start-session` is **not** charged again — the credit pays for the full document → PWDD session. `GET /api/ingestion-credits` returns `{available, consumed, total}`.

## Per-user LLM cost dashboard + monthly cap

Runaway-spend guard sitting in front of every HARNESS engine. Two pieces — a passive dashboard at `/me/costs` and an active middleware (`requireCostBudget`) on every engine route.

**Cap source of truth.** `MONTHLY_COST_CAP_USD` in `artifacts/api-server/src/lib/tier.ts` defines tier defaults (EXPLORER $2, PRACTITIONER $50, ARCHITECT $250, INSTITUTION $2000). Each row in `command_centre_subscribers` has a nullable `monthly_cost_cap_usd_override numeric(12,2)` column; non-null wins. `effectiveCostCapUsd(sub, effectiveTier)` in `lib/cost-budget.ts` resolves the pair. Tier read is always the **effective** tier (personal max'd against active team-seat orgs) so a Team Lite seat-holder uses the ARCHITECT cap even when their personal subscriber row says EXPLORER.

**Live SUM, no cached counter.** `currentMonthCostForUser(userId)` runs `SUM(cost_usd) FROM harness_engine_runs WHERE user_id = $1 AND created_at >= date_trunc('month', now() at time zone 'utc')`. Backed by the `harness_engine_runs_user_created_idx` composite index — adds ~3–5 ms per engine call, no drift risk vs. a cached counter, and no monthly-reset cron job to maintain. The cap window is the calendar month UTC; reset is implicit (the SUM filter rolls forward).

**Middleware placement.** `requireCostBudget` is mounted AFTER `rateLimit` on every harness route (F1–F8 + ATLAS J + PFP + DE-SPC `evolve`) so the rate-limit ledger does not tick for a request we're about to refuse. Refuses with HTTP 402 `{code:'COST_CAP_EXCEEDED', usedUsd, capUsd, tierDefaultUsd, overrideUsd, detail}`. **DB blip fallback is fail-open** — if the SUM query throws, the request is allowed through (logged as warn) so a transient DB issue doesn't lock every paying user out; the personal rate-limit gates still apply.

**Endpoints.** `GET /api/me/cost-summary` returns the caller's `{tier, effectiveTier, monthToDate:{usedUsd,capUsd,percentUsed,overCap,tierDefaultUsd,overrideUsd}, dailyBreakdown:[{date,costUsd,runs}*30], byEngine:[{engineId,costUsd,runs}], recentRuns:[{...}*20]}`. `PATCH /api/admin/subscribers/:userId/cost-cap` (admin-only) sets or clears the override with body `{monthlyCostCapUsdOverride: number|null}` — `null` returns the user to the tier default. Both routes are out-of-spec (precedent: orgs/activity/cartridge).

**Frontend.** `/me/costs` (signed-in nav link "Costs") shows the cap meter (green → amber at 80% → red at 100%), a 30-day daily-cost bar chart, a per-engine month-to-date table, and the most recent 20 runs with session deep-links. Auto-refreshes every 60s.

**Out of scope (V1).** No 80%-threshold cross email — relies on the existing per-run `highCostThresholdUsd` notification path for spike alerts and on the dashboard for trend awareness. Add `notification-dispatch.ts#maybeDispatchCostCapWarning` if monthly threshold-cross alerts become needed.

## Senior badges + Context Craft mini-quests

**Senior badges (Advanced Systems).** Two reputational top-end badges sit above the ASPE/AISA/AISE trio on `/quests`. Stored ids are deliberately disambiguated from the legacy trio:

- `AISA_PWDD` = "Advanced Intelligence Systems Architect" (live-computed, no DB row, eligible when the user has ≥ 3 PWDD-stage projects — counted as `count(DISTINCT harness_artifacts.session_id WHERE artifact_type='MVP_PDD' AND spartan_cert IS NOT NULL)` and applies to manual + ingested + cartridge-origin sessions alike).
- `AISE_BUILD` = "Advanced Intelligent Systems Engineer" (stored; `POST /api/me/badges/engineer` accepts `{url, evidenceNote (≤500), sessionId?}`, runs the URL through the same `lib/badges.ts#headOk` SSRF-hardened verifier as AISE, then upserts a `command_centre_badges` row with `badgeId='AISE_BUILD'`, `status='CLAIMED'`).

Never collapse the stored ids back to bare `AISA`/`AISE` — that overwrites the legacy rows. Display names stay the full prose titles; the underlying ids are the disambiguator.

**Context Craft Mini-Quest Badges** (7 pillars: S / R / I / D / F / E / C) are persistent and auto-awarded. `lib/badges.ts#maybeAwardContextCraftBadges` runs (fire-and-forget) from `persistArtifact` whenever an artifact carries a `jcse` pillar breakdown (F1, F2). Threshold = pillar sub-score ≥ 6 (precise band). Rows live in `context_craft_badges` (unique on `(user_id, pillar)`), upserted with `GREATEST(bestScore, new)`. Listed at `GET /api/me/context-craft-badges`; rendered as triangle badges with the pillar letter on `/quests`. Failures in the awarder are swallowed — never break an engine response.
