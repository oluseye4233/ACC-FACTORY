# ATLAS PDD — ATANDA Command Centre

> **Drafted with the F6 ATLAS PDD Drafter methodology** (the platform's own 4-Part
> ATLAS Project Definition Document format), `mode=FROM_SPC` against the live
> codebase as the source-of-truth "SPC". This document captures the present
> system state **plus the current ARK.ONECRAFT JST-import changes**.
>
> - **Schema:** `atlas-pdd-v1` · **Source:** present monorepo HEAD
> - **Parts:** Cheat Sheet · Exec Summary · Worksheet (ROYGBIV) · Implementation
> - Appendix A is the **ATLAS-J crystallised** typed view (phase rainbow, CLASS A/B/C).

---

## Part 1 — Cheat Sheet
*1-page distilled pitch. Audience: founders.*

**What we're building.** The ATANDA Command Centre — an authenticated subscription
portal in front of the **FORGE.BONSAI HARNESS**. The HARNESS is a *PDD-blueprint
application*: an ordered sequence of atomic prompts (the instruction layer for an
LLM), **not** an SPC. Per session a creator runs one coherent pipeline —
**F1 → F2 → F3 → F4 → F5 → F6 (+VIBE DJ) → F7**, with **F8 Code DJ** scaffolding a
runnable codebase from the certified spec. Side-step engines (**ATLAS J**, **PFP
drift detector**, **DE-SPC synthesiser**) and an onboarding spine (**Ascension
Protocol**, anchored to *The Atomic Prompt*) wrap the core.

**For whom.** Solo creators, practitioners, and architects who hold a raw idea and
want a deterministic path from prompt → SPC → PDD → SPARTAN-certified MVP-PDD →
runnable code. Teams buy per-seat subscriptions that confer elevated tiers.

**Why now.** The JST-displacement thesis (*Jobs · Skills · Talent*) is the wedge:
the platform meets a creator at their "number" and climbs them to a shipped,
verifiable system. The new **ARK.ONECRAFT integration** turns that number from a
self-reported estimate into an authoritative, externally-sourced score.

**Top 3 decisions.**
1. **Contract-first.** `lib/api-spec/openapi.yaml` is the single source of truth;
   Zod + React Query are generated (operationId-shaped).
2. **App-layer authorization, no RLS.** Every query is scoped by `req.localUser.id`
   / `req.effectiveTier`; Clerk (Replit-managed) is the identity bridge.
3. **Honest-failure integrations.** External integrations (Sphinx, ARK.ONECRAFT)
   are env-gated and return a typed `503 *_NOT_CONFIGURED` rather than fabricating
   data — the interim in-app path stays usable until creds are set.

**Success criteria (measurable).**
- A signed-in user completes F1→F7 and obtains a public verification URL.
- Runaway-spend is bounded: every engine route enforces a monthly USD cost cap.
- Cross-provider engine output is reproducible: 30-test fixture suite runs offline.
- ARK.ONECRAFT score, once connected, supersedes self-assessment with **zero code
  change** (newest JST row wins).

**Out of scope (this PDD).** Re-platforming away from Express/Drizzle/Clerk/Stripe;
the receiver-side ARK.ONECRAFT service implementation (we own only the client).

---

## Part 2 — Executive Summary
*Business-outcome story. Audience: investors / stakeholders.*

**Market context.** AI-assisted building is crowded with one-shot prompt tools, but
they stop at "generates something". The Command Centre productises *rigour*: a
graded pipeline that certifies an idea (JCSE scoring, SPARTAN certification, PFP
drift gating) before code is scaffolded. The output is auditable, not just plausible.

**Competitive frame.** Where "VIBE" tools (Cursor, Lovable, Bolt, v0) optimise the
*build* step, the HARNESS optimises everything *upstream* of it — and then
**recommends the right VIBE** (F6-VDJ) for the certified spec. The platform is
therefore complementary to, not competing with, the IDE/agent layer.

**Stakeholder map.**
- **Creators / Practitioners / Architects** — primary subscribers (tiered).
- **Teams / Institutions** — per-seat subscriptions (`team` → INSTITUTION,
  `team_lite` → ARCHITECT) with org tenancy, audit logs, weekly digests.
- **ARK.ONECRAFT** — sister platform; authoritative source of the JST score and the
  Sphinx Marketplace publish target.
- **Ops / Admin** — cost-cap overrides, scheduled cron ticks, deployment.

**Milestones (month markers).**
- **M0 — Core pipeline shipped.** F1–F8 + ATLAS J + PFP + DE-SPC live; portal shell,
  pricing, Stripe tiers, per-seat orgs, activity log, cost dashboard all in place.
- **M1 — Onboarding spine (Ascension Protocol).** JST primitive, reader track,
  13-rung book-anchored ladder composing real signals. *(merged)*
- **M2 — ARK.ONECRAFT JST import (current change).** `source`-tagged JST scores;
  env-gated import endpoint; front-end upload CTA framing self-assessment as interim.
- **M3 — Federation.** Broaden Sphinx + ARK.ONECRAFT into a two-way marketplace and
  identity federation (VIOLET phase, deferred).

**Investment ask (if relevant).** The remaining spend is integration go-live
(ARK.ONECRAFT receiver, Sphinx receiver) and the enterprise hardening already
scaffolded (SSO/RBAC/audit are in place; multi-region is deferred). No core rebuild
is required.

---

## Part 3 — Worksheet
*Phase-by-phase build plan using the canonical ATLAS phase rainbow. Each phase honours
its fixed thematic meaning. MVP ships RED→BLUE; INDIGO is largely shipped; VIOLET/WHITE
deferred.*

### 🔴 RED — Integration Foundation · **shipped**
*Duration: M0.* DB, auth, API proxies, secrets, base runtime.
- PostgreSQL + Drizzle ORM (one schema file per table, barrel re-export).
- Clerk (Replit-managed) proxy mounted **before** body parsers; auth bridge JITs a
  local user + subscriber row (`req.localUser`, `req.effectiveTier`).
- Stripe wired (raw webhook route mounted before JSON parser; idempotency via
  `stripe_webhook_events` PK).
- Anthropic via Replit AI Integrations proxy (Claude Sonnet 4).
- **Exit criterion:** `curl localhost:80/api/healthz` green; authed request resolves
  a subscriber; Stripe webhook replay returns `{ok:true, replay:true}`.

### 🟠 ORANGE — Portal Shell · **shipped**
*Duration: M0.* Dashboards, navigation, pricing UI, session shell.
- `command-centre` artifact serves `/` landing + `/pricing`; tiered Stripe checkout
  (Practitioner/Architect monthly+yearly, per-seat team + team-lite).
- Session shell + session-detail page driving each engine; TopNav with Costs,
  Quests, Ascension, Cartridge links.
- **Exit criterion:** a user can subscribe, land in the portal, and open a session.

### 🟡 YELLOW — Feature Workspaces · **shipped**
*Duration: M0–M2.* The productised engines operators actually use.
- **HARNESS engines F1–F8** with per-engine workspaces; F8 Code DJ (Architect-tier)
  emits a `CODEBASE_BUNDLE` (≤12 files + manifest).
- **ATLAS J** (engineId 10) crystallises an `ATLAS_PDD` into typed `ATLAS_PDD_JSON`.
- **PFP** (engineId 11) drift detector; F8 enforces a hard `DRIFT_GATE` (HTTP 409)
  unless `acknowledgeDrift:true`.
- **DE-SPC** evolve synthesiser.
- **Cartridge** ($499.99/project) + **Ingestion** (per-project credit) intake paths;
  cartridge context is an authoritative instruction layer prepended to every prompt.
- **Ascension Protocol** onboarding ladder + **JST primitive**.
- **ARK.ONECRAFT JST import (current change):** "UPLOAD JST SCORE FROM
  ARK.ONECRAFT" CTA on `/ascension`; `source`-tagged scores; newest row supersedes.
- **Exit criterion:** F1→F7 completes end-to-end and yields a verification URL;
  ARK import returns the typed not-configured signal in the absence of creds.

### 🟢 GREEN — CMS & Marketing · **shipped**
*Duration: M0.* Content seed, SEO, landing, verify pages.
- Public `/pricing`, exemplar library with "Fork to session" CTA, public SPARTAN
  verification URL per certified MVP-PDD.
- Email dispatch (Resend) with `[email:dry-run]` console fallback when unset.
- **Exit criterion:** verification URL renders publicly; pricing is live.

### 🔵 BLUE — QA & Security · **shipped**
*Duration: M0–M2.* E2E tests, audit, threat model, launch gate.
- Cross-provider engine suite (30 tests) replays cached LLM fixtures (~15s, offline);
  nightly `test:live` GitHub Action refreshes fixtures + opens a drift issue.
- **Activity / audit log** (own + org-scoped, CSV export, cross-org leak guard).
- **Runaway-spend guard:** `requireCostBudget` after `rateLimit` on every engine
  route; `402 COST_CAP_EXCEEDED`; live monthly SUM, fail-open on DB blip.
- SSRF-hardened external fetches (badge verifier; ARK import uses an env-driven host).
- **Exit criterion:** `pnpm run typecheck` + test suite green; cost cap enforced.

### 🟣 INDIGO — Enterprise · **largely shipped**
*Duration: M0–M1.* SSO, RBAC, org tenancy, audit logs.
- Organizations + members (`owner|admin|member`, last-owner-protected) + tokenised
  invites; per-seat subscriptions with `effectiveTier = max(personal, conferred)`.
- Notifications: weekly digest (cron), billing-failure alerts, high-cost alerts —
  all fire-and-forget so a Resend outage never breaks a webhook ack.
- **Exit criterion:** a team-seat holder transparently gets elevated F8 limits.

### 🟪 VIOLET — Federation · **deferred to v2**
Multi-region, partner integrations, marketplace.
- Sphinx Marketplace **publish** path is shipped (outbound); the two-way federated
  marketplace + ARK.ONECRAFT identity federation are deferred.

### ⬜ WHITE — Operating System · **deferred**
Open API, plugin ecosystem, white-label. Not in current scope.

---

## Part 4 — Implementation
*Technical implementation document. Audience: engineers.*

### Stack
- **Monorepo:** pnpm workspaces, Node.js 24, TypeScript 5.9 (composite libs via
  `tsc --build`; leaf artifacts `--noEmit`).
- **API:** Express 5 + Clerk (Replit-managed) + Stripe + pino.
- **DB:** PostgreSQL + Drizzle ORM. **No RLS** — authorization is app-layer via
  `req.localUser.id` / `req.effectiveTier`.
- **Validation:** Zod (`zod/v4`) + `drizzle-zod`. **API codegen:** Orval
  (operationId-shaped names — `CreateSessionBody`, not `SessionInput`).
- **Build:** esbuild (CJS). **LLM:** Claude Sonnet 4 via
  `@workspace/integrations-anthropic-ai`.
- **Frontend:** React + Vite, wouter, shadcn/ui, generated React Query hooks.

### Data schemas (current — including the ARK.ONECRAFT change)
```ts
// lib/db/src/schema/jst-assessments.ts  (current change in **bold** below)
export const JST_SOURCES = ["self_assessment", "ark_onecraft"] as const;
export type JstSource = (typeof JST_SOURCES)[number];

jst_assessments {
  id           uuid pk
  userId       text            // scoped owner
  jobsScore    integer 1..10
  skillsScore  integer 1..10
  talentScore  integer 1..10
  composite    numeric         // round(((sum-3)/27)*100, 2) → 0..100
  band         varchar         // SEEKER <40 · BUILDER <60 · OPERATOR <80 · ASCENDANT
  source       varchar(24)     // NEW — default 'self_assessment'
  notes        text?
  createdAt    timestamptz      // newest row drives band/rungs ⇒ ARK supersedes
}
```
Other notable tables: `harness_sessions` / `harness_artifacts` / `harness_engine_runs`
(cost ledger, `user_created_idx` powering the live cost SUM), `organizations` /
`organization_members` / `organization_invites`, `command_centre_subscribers`
(`monthly_cost_cap_usd_override`), `integration_credentials` (AES-256-GCM), the
cartridge + ingestion credit tables, badge tables, and `reader_onboarding`.

### API surface (the ARK.ONECRAFT change)
```
POST /me/jst/import-from-ark        operationId: importJstFromArk   tag: onboarding
  - requireAuth
  - env-gated: 503 { code: "ARK_NOT_CONFIGURED" } when ARK_ONECRAFT_BASE_URL
    or ARK_ONECRAFT_API_KEY is unset (mirrors the SPHINX precedent — never
    fabricates a score)
  - on connect: GET ${ARK_ONECRAFT_BASE_URL}/api/jst/score?externalUserId=<id>
    (Bearer ARK_ONECRAFT_API_KEY); 502 ARK_UNREACHABLE | ARK_REJECTED |
    ARK_INVALID_SCORE on failure paths
  - validates jobs/skills/talent as integers 1..10, re-scores SERVER-SIDE
    (scoreJst), inserts source='ark_onecraft', returns JstSummary
GET  /me/jst        getMyJst        // JstAssessment.source now a required enum field
POST /me/jst        submitMyJst     // self-assessment → source='self_assessment'
GET  /me/ascension  getMyAscension
POST /me/onboarding/reader-code  claimReaderCode
```

### Front-end (current change)
`artifacts/command-centre/src/pages/ascension.tsx` adds a primary **"UPLOAD JST
SCORE FROM ARK.ONECRAFT"** button above the self-assessment (reframed "OR
SELF-ASSESS (INTERIM)"). Uses the generated `useImportJstFromArk` hook. Not-connected
detection is robust — checks `ApiError.status === 503` and the body's
`data.code === "ARK_NOT_CONFIGURED"` (the generated client surfaces the response
body on `err.data`), and shows a non-destructive "ARK.ONECRAFT — coming soon" toast.
Imported scores show a "via ARK.ONECRAFT" source badge.

### Deployment topology
- Shared reverse proxy routes by path (`/api` → api-server, `/` → command-centre).
  **Never call service ports directly — always `localhost:80`.**
- Published over HTTPS on `$REPLIT_DOMAINS`. Scheduled Deployments drive two cron
  endpoints (`send-weekly-digest`, `reset-harness-limits`) via the `scripts` package.

### Observability & cost control
- pino structured logs (`req.log` in handlers, singleton `logger` elsewhere).
- Optional Sentry (`SENTRY_DSN` / `VITE_SENTRY_DSN`, no-op when unset).
- Monthly LLM cost cap enforced per engine route (`402 COST_CAP_EXCEEDED`); live SUM
  over `harness_engine_runs.cost_usd`, tier defaults + per-subscriber override.

### Testing strategy
- Offline cross-provider fixture replay (30 tests, ~15s); cache keys normalise UUIDs
  / ISO timestamps. `test:live` (`RECORD=1`) refreshes fixtures (~10 min) and runs
  nightly. JST scoring covered by `test/ascension-jst.test.ts`.

### Threat-model summary
- **AuthZ:** all reads/writes scoped to the authenticated user; org routes validate
  supplied `userIds` against org membership (anti cross-org fuzzing).
- **SSRF:** external fetches are env-driven (ARK host, Sphinx host); badge URL
  verification is SSRF-hardened. *Hardening backlog:* enforce `https://` + host
  allowlist on the ARK base URL.
- **Webhook integrity:** Stripe signature + idempotency PK; handler throw rolls back
  the idempotency row so Stripe can legitimately retry.
- **Secrets:** integration API keys stored AES-256-GCM (scrypt-derived from
  `SESSION_SECRET`); no plaintext at rest.
- **Drift:** PFP `counts`/`verdict` recomputed server-side; F8 `DRIFT_GATE`.

### Env (delta for this change)
`ARK_ONECRAFT_BASE_URL` + `ARK_ONECRAFT_API_KEY` (both required to activate the JST
import; absence → typed 503). Documented in `replit.md → Env → Integrations & ops`.

---

## Appendix A — ATLAS-J Crystallised View (typed)
*The `atlas-pdd-v1` JSON projection: per-phase prompts `P-<PHASE>-NNN`, CLASS A
(foundational) / B (feature) / C (enhancement).*

```json
{
  "schemaVersion": "atlas-pdd-v1",
  "title": "ATANDA Command Centre — full system + ARK.ONECRAFT JST import",
  "summary": "Authenticated portal over the FORGE.BONSAI HARNESS (F1-F8 + ATLAS J + PFP + DE-SPC), tiered Stripe billing, org seats, onboarding spine, and an env-gated ARK.ONECRAFT JST-score integration that supersedes self-assessment.",
  "prompts": [
    { "id": "P-RED-001", "phase": "RED", "title": "DB + Drizzle schema", "operation": "Provision Postgres, one-file-per-table schema, barrel export", "classification": "A", "dependencies": [], "sourceSection": "implementation" },
    { "id": "P-RED-002", "phase": "RED", "title": "Clerk auth bridge", "operation": "Mount Clerk proxy before body parsers; JIT local user + subscriber", "classification": "A", "dependencies": ["P-RED-001"], "sourceSection": "implementation" },
    { "id": "P-RED-003", "phase": "RED", "title": "Stripe + webhook idempotency", "operation": "Raw webhook route before JSON parser; PK idempotency net", "classification": "A", "dependencies": ["P-RED-001"], "sourceSection": "implementation" },
    { "id": "P-ORANGE-001", "phase": "ORANGE", "title": "Portal shell + pricing", "operation": "Landing, /pricing, tiered checkout, session shell", "classification": "A", "dependencies": ["P-RED-002", "P-RED-003"], "sourceSection": "worksheet" },
    { "id": "P-YELLOW-001", "phase": "YELLOW", "title": "HARNESS F1-F7 pipeline", "operation": "Ordered atomic-prompt engines → certified MVP-PDD + verification URL", "classification": "B", "dependencies": ["P-ORANGE-001"], "sourceSection": "worksheet" },
    { "id": "P-YELLOW-002", "phase": "YELLOW", "title": "F8 Code DJ + PFP drift gate", "operation": "Scaffold CODEBASE_BUNDLE; enforce DRIFT_GATE via PFP counts", "classification": "B", "dependencies": ["P-YELLOW-001"], "sourceSection": "implementation" },
    { "id": "P-YELLOW-003", "phase": "YELLOW", "title": "Ascension Protocol + JST", "operation": "Book-anchored 13-rung ladder seeded by JST self-assessment", "classification": "B", "dependencies": ["P-ORANGE-001"], "sourceSection": "worksheet" },
    { "id": "P-YELLOW-004", "phase": "YELLOW", "title": "ARK.ONECRAFT JST import", "operation": "Env-gated import endpoint + upload CTA; source-tagged score supersedes self-assessment", "classification": "C", "dependencies": ["P-YELLOW-003", "P-RED-001"], "sourceSection": "implementation" },
    { "id": "P-GREEN-001", "phase": "GREEN", "title": "Public verify + exemplars", "operation": "SPARTAN verification URL, exemplar fork-to-session, email dispatch", "classification": "B", "dependencies": ["P-YELLOW-001"], "sourceSection": "worksheet" },
    { "id": "P-BLUE-001", "phase": "BLUE", "title": "Cost cap + audit + offline tests", "operation": "requireCostBudget, activity log, 30-test fixture replay", "classification": "A", "dependencies": ["P-YELLOW-001"], "sourceSection": "implementation" },
    { "id": "P-INDIGO-001", "phase": "INDIGO", "title": "Orgs + per-seat tiers + notifications", "operation": "Org tenancy, effectiveTier, weekly digest / billing / high-cost alerts", "classification": "B", "dependencies": ["P-BLUE-001"], "sourceSection": "worksheet" },
    { "id": "P-VIOLET-001", "phase": "VIOLET", "title": "Sphinx + ARK federation (deferred)", "operation": "Two-way marketplace + identity federation", "classification": "C", "dependencies": ["P-YELLOW-004", "P-GREEN-001"], "sourceSection": "worksheet" }
  ],
  "stack": ["pnpm-monorepo", "Node.js 24", "TypeScript 5.9", "Express 5", "Clerk", "Stripe", "PostgreSQL", "Drizzle ORM", "Zod v4", "Orval", "React", "Vite", "Claude Sonnet 4"],
  "routes": ["/", "/pricing", "/ascension", "/cartridge", "/quests", "/me/costs", "/api/harness/f1..f8", "/api/harness/atlas-crystallise", "/api/harness/pfp", "/api/me/jst", "/api/me/jst/import-from-ark", "/api/me/ascension", "/api/orgs", "/api/integrations/sphinx"],
  "deployTarget": "express-replit (api-server) + react-vite-static (command-centre) behind the shared path-routing proxy, published over $REPLIT_DOMAINS"
}
```
