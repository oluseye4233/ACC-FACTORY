# ATLAS PDD — ATANDA Command Centre (Current State + HOST DJ)

> **Drafted with the F6 ATLAS PDD methodology** — the platform's own **4-Part ATLAS
> Project Definition Document** format (Cheat Sheet · Executive Summary · Worksheet
> (ROYGBIV) · Implementation), `mode=FROM_SPC` with the **live monorepo HEAD** as the
> source-of-truth "SPC". This pass captures the present system **plus two deltas since
> the last PDD**: the **F8 delivery/handoff suite** (IDE export bundle + push-to-GitHub)
> and the **new role of HOST DJ**, recast as the **F8-HDJ** post-deployment
> instruction-layer engine.
>
> - **Document ID:** ATANDA-CC-PDD-CURRENT-2026-004
> - **Supersedes:** ATANDA-CC-PDD-CURRENT-2026-003 (`ATANDA_Command_Centre_PDD_Current_State.md`)
> - **Schema:** `atlas-pdd-v1` · **Source:** present monorepo HEAD · **Date:** May 2026
> - Appendix A is the **ATLAS-J crystallised** typed view (phase rainbow, CLASS A/B/C).

---

## Doctrine guard (read first)

The **HARNESS is a PDD-blueprint application**. Its engines are an ordered sequence of
**atomic prompts** that form the *instruction layer* driving the LLM — **they are never
SPCs**. The SPCs and PDDs are what the HARNESS *produces* on behalf of the user.

This has one direct consequence for HOST DJ. The attached
`HOST_DJ_SPC_v1_0` is authored as a marketplace **Super Prompt Card** ("SI Fusion
Class", Camelot Seat #7). **It is not adopted as a catalogue SPC.** Its capability is
absorbed into the HARNESS as a new instruction-layer engine — **F8-HDJ** — exactly as
F6-VDJ, ATLAS J, and PFP are side-step engines, not cards. Everywhere below, "HOST DJ"
refers to that **F8-HDJ engine role**, not to a published SPC.

Terminology also holds throughout: **IPDD = INPUT** (Ingestion Product Design Document,
what the user already has); **PWDD = OUTPUT** (the HARNESS-certified outcome of an
ingested session). Qualified output names (Micro PDD F4, ATLAS PDD F6, MVP PDD F7) are
untouched.

---

## Part 1 — Cheat Sheet
*1-page distilled pitch. Audience: founders.*

**What we're building.** The **ATANDA Command Centre** — an authenticated subscription
portal in front of the **FORGE.BONSAI HARNESS**. Per session a creator runs one coherent
pipeline of atomic-prompt engines: **F1 → F2 → F3 → F4 → F5 → F6 (+VIBE DJ) → F7**,
**F8 Code DJ** scaffolds a runnable codebase from the certified spec, then the **delivery
layer** hands that codebase off — **export-to-IDE bundle**, **push-to-GitHub**, and the
**new F8-HDJ (HOST DJ)** hosting-decision + deployment-journey engine. Side-step engines
(**ATLAS J**, **PFP** drift detector, **DE-SPC** synthesiser) and an onboarding spine
(**Ascension Protocol**, anchored to *The Atomic Prompt*) wrap the core.

**For whom.** Solo creators, practitioners, and architects who hold a raw idea and want a
deterministic path from **prompt → SPC → PDD → SPARTAN-certified MVP-PDD → runnable code
→ live deployment**. Teams buy per-seat subscriptions that confer elevated tiers.

**Why now.** Every other tool stops at "generates something." The Command Centre
productises **rigour**: a graded pipeline (JCSE scoring, SPARTAN certification, PFP drift
gating) that certifies an idea *before* code is scaffolded — and now carries that rigour
all the way to the host. Where VIBE tools optimise the *build*, the HARNESS optimises
everything upstream **and downstream** of it: F6-VDJ recommends the IDE; **F8-HDJ
recommends the host**.

**Top 3 decisions.**
1. **Contract-first.** `lib/api-spec/openapi.yaml` is the single source of truth; Zod +
   React Query are generated (operationId-shaped).
2. **App-layer authorization, no RLS.** Every query is scoped by `req.localUser.id` /
   `req.effectiveTier`; Clerk (Replit-managed) is the identity bridge.
3. **Engines are the instruction layer, not SPCs.** New capability (incl. HOST DJ) is
   absorbed as a HARNESS engine with the same guardrails (tier gate → rate limit →
   `requireCostBudget`), never published as a marketplace card.

**Success criteria (measurable).**
- A signed-in user completes F1→F7, obtains a public verification URL, scaffolds a
  codebase (F8), and **hands it off** to an IDE / GitHub repo.
- **F8-HDJ** returns a scored primary + fallback host and a phase-gated deployment journey
  for the certified spec, reconciled to the platforms F8 actually targets.
- Runaway-spend is bounded: **every** engine route (incl. F8-HDJ) enforces a monthly USD
  cost cap behind the rate limiter.
- Cross-provider engine output is reproducible: the cached-fixture suite runs offline.

**Out of scope (this PDD).** Re-platforming away from Express/Drizzle/Clerk/Stripe; a
two-way federated marketplace; and **executing** a deploy on the user's behalf (F8-HDJ
*plans and documents* the deployment; it never holds the user's cloud credentials).

---

## Part 2 — Executive Summary
*Business-outcome story. Audience: investors / stakeholders.*

**Market context.** AI-assisted building is crowded with one-shot prompt tools. The
Command Centre's wedge is an **auditable** pipeline: an idea is graded, certified, and
drift-checked before any code exists, then scaffolded, handed off, and — with F8-HDJ —
given a costed, compliance-aware path to production. The output is verifiable, not just
plausible.

**Competitive frame.** "VIBE" tools (Cursor, Lovable, Bolt, v0) optimise the build step.
The HARNESS is complementary: it owns everything around the build — and now closes the
last gap most tools leave open, *"where does this actually run?"*, via F8-HDJ.

**Stakeholder map.**
- **Creators / Practitioners / Architects** — primary subscribers (tiered).
- **Teams / Institutions** — per-seat subscriptions (`team` → INSTITUTION, `team_lite` →
  ARCHITECT) with org tenancy, audit logs, weekly digests.
- **ARK.ONECRAFT / Sphinx** — sister platforms; authoritative JST score source and the
  Sphinx Marketplace publish target.
- **Ops / Admin** — cost-cap overrides, scheduled cron ticks, deployment.

**Milestones (month markers).**
- **M0 — Core pipeline shipped.** F1–F8 + ATLAS J + PFP + DE-SPC; portal, pricing, Stripe
  tiers, per-seat orgs, activity log, cost dashboard.
- **M1 — Onboarding spine (Ascension Protocol).** JST primitive, reader track, 13-rung
  book-anchored ladder. *(merged)*
- **M2 — ARK.ONECRAFT JST import.** `source`-tagged scores; env-gated import; newest row
  supersedes self-assessment. *(merged)*
- **M3 — F8 delivery/handoff suite.** IDE export bundle (ZIP + `AGENTS.md`) and
  push-to-GitHub (per-user PAT/OAuth, repo picker, empty-repo seed, PR). *(merged)*
- **M4 — F8-HDJ (HOST DJ).** Hosting-decision + deployment-journey engine closing the
  prompt→production loop. *(new role — specified here; implementation is the next build.)*

**Investment ask (if relevant).** Remaining spend is integration go-live (ARK.ONECRAFT
/ Sphinx receivers) plus the F8-HDJ engine build. The core is shipped; no rebuild needed.

---

## Part 3 — Worksheet
*Phase-by-phase build plan using the canonical ATLAS phase rainbow. Each phase honours its
fixed thematic meaning. Status is marked against the present codebase.*

### 🔴 RED — Integration Foundation · **shipped**
DB, auth, API proxies, secrets, base runtime.
- PostgreSQL + Drizzle ORM (one schema file per table, barrel re-export).
- Clerk (Replit-managed) proxy mounted **before** body parsers; auth bridge JITs a local
  user + subscriber (`req.localUser`, `req.effectiveTier`).
- Stripe wired (raw webhook route before JSON parser; idempotency via
  `stripe_webhook_events` PK; handler throw rolls the idempotency row back).
- Anthropic via Replit AI Integrations proxy (Claude Sonnet 4) + provider switching.
- **Exit:** `curl localhost:80/api/healthz` green; authed request resolves a subscriber;
  webhook replay returns `{ok:true, replay:true}`.

### 🟠 ORANGE — Portal Shell · **shipped**
- `command-centre` serves `/` landing + `/pricing`; tiered Stripe checkout
  (Practitioner/Architect monthly+yearly, per-seat team + team-lite).
- Session shell + session-detail page driving each engine; TopNav (Costs, Quests,
  Ascension, Cartridge).
- **Exit:** a user can subscribe, land in the portal, and open a session.

### 🟡 YELLOW — Feature Workspaces (Engines) · **shipped, + F8-HDJ new**
- **HARNESS F1–F8** with per-engine workspaces; F8 Code DJ (Architect) emits a
  `CODEBASE_BUNDLE` (≤12 files + manifest) for `nextjs-vercel | react-vite-static |
  express-replit | expo-mobile | pnpm-monorepo`.
- **ATLAS J** (engineId 10) crystallises an `ATLAS_PDD` → typed `ATLAS_PDD_JSON`.
- **PFP** (engineId 11) drift detector; F8 enforces a hard `DRIFT_GATE` (HTTP 409) unless
  `acknowledgeDrift:true`; `counts`/`verdict` recomputed server-side from `findings`.
- **DE-SPC** evolve synthesiser (Practitioner + ASPE badge).
- **🆕 F8-HDJ (HOST DJ) — hosting decision & deployment journey.** *New engine role.* See
  Part 4 → "F8-HDJ" for the full spec. Architect-tier; runs after F8; consumes the
  certified MVP-PDD (F7) + the `CODEBASE_BUNDLE` (F8); emits a `HOSTING_PLAN` artifact.
- **Exit:** F1→F7 completes end-to-end and yields a verification URL; F8 scaffolds;
  **F8-HDJ returns a scored host + journey for that bundle.**

### 🟢 GREEN — Delivery, CMS & Marketing · **shipped**
Content seed, SEO, verify pages, **and the F8 handoff layer**.
- Public `/pricing`, exemplar library with "Fork to session" CTA, public SPARTAN
  verification URL per certified MVP-PDD.
- **🆕 F8 IDE export bundle** — `lib/codeDjExport.ts` builds a scaffold **ZIP** plus an
  `AGENTS.md` (doctrine, manifest, cert lineage, MVP-PDD summary, file↔spec traceability,
  PFP block) and per-IDE adapters; wired to "SEND TO IDE" in `F8CodeDj.tsx`.
- **🆕 F8 push-to-GitHub** — per-user PAT **or** one-click OAuth connect; a searchable
  repo picker (search / paginate / public-private filter / repo details); create / update
  / empty-repo seed / PR. Backend in `routes/integrations.ts` + `lib/github.ts`; frontend
  `PushToGitHubButton.tsx` + `GitHubConnect.tsx`.
- Email dispatch (Resend) with `[email:dry-run]` console fallback when unset.
- **Exit:** verification URL renders publicly; a certified bundle leaves the building via
  IDE export **and** GitHub.

### 🔵 BLUE — QA & Security · **shipped**
- Cross-provider engine suite replays cached LLM fixtures (offline, ~15s); nightly
  `test:live` GitHub Action refreshes fixtures + opens a `fixture-drift` issue.
- **Activity / audit log** (own + org-scoped, CSV export, cross-org leak guard).
- **Runaway-spend guard:** `requireCostBudget` after `rateLimit` on every engine route;
  `402 COST_CAP_EXCEEDED`; live monthly SUM; fail-open on DB blip.
- SSRF-hardened external fetches (badge verifier; env-driven ARK/Sphinx hosts).
- **Exit:** `pnpm run typecheck` + test suite green; cost cap enforced on all engines.

### 🟣 INDIGO — Enterprise · **largely shipped**
- Organizations + members (`owner|admin|member`, last-owner-protected) + tokenised
  invites; per-seat subs with `effectiveTier = max(personal, conferred)`.
- Notifications: weekly digest (cron), billing-failure + high-cost alerts — all
  fire-and-forget so a Resend outage never breaks a webhook ack.
- **Exit:** a team-seat holder transparently gets elevated F8 limits.

### 🟪 VIOLET — Federation · **deferred to v2**
- Sphinx Marketplace **publish** is shipped (outbound). Two-way federated marketplace +
  ARK.ONECRAFT identity federation deferred.

### ⬜ WHITE — Operating System · **deferred**
Open API, plugin ecosystem, white-label. Not in current scope.

---

## Part 4 — Implementation
*Technical implementation document. Audience: engineers.*

### Stack
- **Monorepo:** pnpm workspaces, Node.js 24, TypeScript 5.9 (composite libs via
  `tsc --build`; leaf artifacts `--noEmit`).
- **API:** Express 5 + Clerk (Replit-managed) + Stripe + pino. **DB:** PostgreSQL +
  Drizzle ORM, **no RLS** — authorization is app-layer via `req.localUser.id` /
  `req.effectiveTier`.
- **Validation:** Zod (`zod/v4`) + `drizzle-zod`. **Codegen:** Orval (operationId-shaped
  names — `CreateSessionBody`, not `SessionInput`). **Build:** esbuild (CJS).
- **LLM:** Claude Sonnet 4 via `@workspace/integrations-anthropic-ai`; provider switching
  across Anthropic (Claude) / OpenAI / Gemini (Explorers locked to Claude).
- **Frontend:** React + Vite, wouter, shadcn/ui, generated React Query hooks.

### Registered artifacts
| ID | Kind | Title | Directory |
| --- | --- | --- | --- |
| api-server | api | API Server | `artifacts/api-server` |
| command-centre | web | ATANDA Command Centre | `artifacts/command-centre` |
| mockup-sandbox | design | Canvas | `artifacts/mockup-sandbox` |

### Where things live
- API contract: `lib/api-spec/openapi.yaml`. Generated: `lib/api-zod`, `lib/api-client-react`.
- DB schema: `lib/db/src/schema/*.ts` (one table per file, barrel re-export).
- Express app + middleware order: `artifacts/api-server/src/app.ts`.
- Auth bridge: `src/lib/auth.ts`. Tier + rate-limit gates: `src/lib/tier.ts`.
- Engines: `src/engines/{f1..f7,f6vdj,f8codedj,atlas-crystallise,pfp}.ts` (+ **`f8hdj.ts`
  for the new HOST DJ role**). Routes registered via `routes/harness.ts#harnessRoute`.
- F8 delivery: `command-centre/src/lib/codeDjExport.ts`,
  `components/shared/{PushToGitHubButton,GitHubConnect}.tsx`; server
  `routes/integrations.ts` + `lib/github.ts`.

### Core pipeline (F1 → F7) — shipped
| # | Engine | Produces | Tier |
| --- | --- | --- | --- |
| F1 | Test Your Prompt | 7-pillar JCSE diagnostic | Explorer |
| F2 | Build Atomic Prompt | Atomic Prompt | Explorer |
| F3 | Build an MA | CELL Micro-Agent Birth Package (SSE) | Explorer |
| F4 | Convert to Micro PDD | CELL Micro PDD | Explorer |
| F5 | Build an SPC | Full Single Page Concept | Practitioner |
| F6 | Draft an ATLAS PDD | `ATLAS_PDD` (4-part) | Practitioner |
| F6-VDJ | VIBE recommendation | IDE/agent pick for the PDD | Practitioner |
| F7 | Compress to MVP PDD | SPARTAN-certified `MVP_PDD` + verify URL | Practitioner |

F6 output schema = `{cheatSheet, execSummary, worksheet, implementation}` →
`artifactType:"ATLAS_PDD"`. F7 streams the 7-step SPARTAN SCM
(`SCAN→PROFILE→ASSESS→REDUCE→TRANSFORM→ZPOS+5→PACKAGE`) and persists
`{sections, donut}` + a `spartanCert {certId, class, crP, issuedAt}` →
`artifactType:"MVP_PDD"`, emailing a cert-issued notice with a public `/verify` URL.

### Delivery / handoff layer — shipped (M3 delta)
1. **F8 Code DJ** (`/api/harness/f8`, Architect) consumes a certified MVP-PDD/PWDD and
   emits a `CODEBASE_BUNDLE` (≤12 files + manifest), gated by the PFP `DRIFT_GATE`.
2. **IDE export bundle** (`codeDjExport.ts`) — turns the bundle into a downloadable ZIP +
   an `AGENTS.md` carrying doctrine, manifest, cert lineage, MVP-PDD summary, file↔spec
   traceability, and the PFP block, plus per-IDE adapters. Surfaced as "SEND TO IDE".
3. **Push-to-GitHub** (`routes/integrations.ts`) — per-user credential
   (`integration_credentials`, AES-256-GCM, `getGitHubClientFromToken`) via pasted PAT or
   one-click OAuth; `GET /integrations/github/repos` lists push-eligible repos
   (search/page/visibility-filter); push handler does create / update / **empty-repo seed
   (parentless commit)** / optional PR. Architect-tier gated to match the F8 it feeds.

### 🆕 F8-HDJ — HOST DJ (Hosting Decision & Journey) · *new engine role*
**Status: ✅ SHIPPED.** Live as `engines/f8hdj.ts` (engineId 12) + `POST /api/harness/f8-hdj`
+ the HOST DJ card in `F8CodeDj.tsx`. This is the doctrinal re-casting of the attached
`HOST_DJ_SPC_v1_0` from a marketplace SPC into a HARNESS instruction-layer engine.

- **Endpoint / placement.** `POST /api/harness/f8-hdj` registered via
  `harnessRoute`; **Architect-tier** (mirrors F8). Middleware order is the standing rule:
  `requireTier → rateLimit → requireCostBudget` (gotcha #6 — a new engine route without
  `requireCostBudget` is a hole in the runaway-spend guard). New daily counter
  `f9_today`-style column **must** be added to the cron `reset-harness-limits` handler or
  the tier locks after 24h.
- **Inputs.** The certified `MVP_PDD` (F7) + the `CODEBASE_BUNDLE` (F8) for the same
  session, normalised into a **Hosting Requirements Profile (HRP)**: stack, DB fit,
  compliance (GDPR/HIPAA/SOC2/PCI), target region, traffic ceiling, budget.
- **Output.** A `HOSTING_PLAN` artifact (persisted via `persistArtifact`,
  `artifactType:"HOSTING_PLAN"`) with the SPC's six sections recast as JSON:
  `{ hse:{matrix[], weights}, primary:{platform, score, rationale, monthlyCostUsd},
  fallback:{...}, journey:{tier:"A|B|C", phases:[{name, steps:[]}]},
  sdf:{envTemplate, ciYaml, healthCheck, rollback}, jcse:{dimensions[]} }`.
- **HSE matrix.** The 8-criterion weighted evaluation is preserved (Stack Compatibility
  25%, Cost 20%, Deployment Simplicity 15%, Database Fit 15%, CI/CD 10%, Compliance 10%,
  Scalability 3%, Lock-in 2%).
- **Registry reconciliation (REQUIRED).** The SPC's 24-platform registry and its
  Vercel+Railway+Supabase defaults are **re-pointed to what the Command Centre actually
  ships and targets**: F8's five `platform` values **plus Replit Deployments** (Autoscale
  / Reserved VM / Scheduled) as a first-class Tier-5 entry. The HRP→platform map must not
  recommend a host F8 cannot scaffold for. The generic "Junglenomics defaults" table is
  replaced by Command-Centre defaults (Replit + Postgres + Clerk + Stripe).
- **Boundary (honest-failure).** F8-HDJ **plans and documents** a deployment; it never
  holds or transmits the user's cloud credentials and never executes a deploy. The SDF
  env template emits **keys only**, never values (matches the SPC's own constraint).
- **VIBE DJ analogue.** F6-VDJ recommends the *IDE*; F8-HDJ recommends the *host* — the
  symmetric bookends of the build step.

### Data schemas (current)
`harness_sessions` / `harness_artifacts` (`artifact_content` JSONB + `spartan_cert`) /
`harness_engine_runs` (cost ledger; `user_created_idx` powers the live cost SUM) /
`command_centre_subscribers` (`monthly_cost_cap_usd_override`, `f{1..8}_today`) /
`organizations` + `organization_members` + `organization_invites` /
`integration_credentials` (unique `(user_id, provider)`; providers `sphinx`, `github`;
AES-256-GCM) / cartridge + ingestion credit tables / badge tables / `jst_assessments`
(`source` enum) / `reader_onboarding` / `stripe_webhook_events` (PK `event_id`).

**F8-HDJ schema delta (new role):** a new `f9_today`-style counter on the subscriber row
+ its cron reset; `artifactType` gains `HOSTING_PLAN`; no new table required (the plan
lives in `harness_artifacts.artifact_content`).

### Deployment topology
- Shared reverse proxy routes by path (`/api` → api-server, `/` → command-centre).
  **Never call service ports directly — always `localhost:80`.**
- Published over HTTPS on `$REPLIT_DOMAINS`. Scheduled Deployments drive two cron
  endpoints (`send-weekly-digest`, `reset-harness-limits`) via `@workspace/scripts`.

### Observability & cost control
- pino structured logs (`req.log` / singleton `logger`). Optional Sentry (`*_DSN`).
- Monthly LLM cost cap per engine route (`402 COST_CAP_EXCEEDED`); live SUM over
  `harness_engine_runs.cost_usd`; tier defaults + per-subscriber override.

### Threat-model summary
- **AuthZ:** all reads/writes scoped to the authenticated user; org routes validate
  `userIds` against membership.
- **SSRF:** external fetches env-driven; badge URL verifier SSRF-hardened (rejects
  RFC1918, loopback, link-local, metadata, CGNAT, multicast, non-`https`).
- **Webhook integrity:** Stripe signature + idempotency PK; throw rolls back the row.
- **Secrets:** integration keys stored AES-256-GCM (scrypt from `SESSION_SECRET`); GitHub
  push uses the **user's own** token, never the repl owner's. F8-HDJ SDF emits keys only.
- **Drift:** PFP `counts`/`verdict` recomputed server-side; F8 `DRIFT_GATE`.

---

## Appendix A — ATLAS-J Crystallised View (typed)
*The `atlas-pdd-v1` JSON projection: per-phase prompts `P-<PHASE>-NNN`, CLASS A
(foundational) / B (feature) / C (enhancement).*

```json
{
  "schemaVersion": "atlas-pdd-v1",
  "title": "ATANDA Command Centre — current state + F8 handoff + F8-HDJ (HOST DJ)",
  "summary": "Authenticated portal over the FORGE.BONSAI HARNESS (F1-F8 + ATLAS J + PFP + DE-SPC), tiered Stripe billing, org seats, onboarding spine, a shipped F8 delivery layer (IDE export + GitHub push), and the new F8-HDJ hosting-decision engine that recasts the HOST DJ SPC as an instruction-layer engine.",
  "prompts": [
    { "id": "P-RED-001", "phase": "RED", "title": "DB + Drizzle schema", "operation": "Provision Postgres, one-file-per-table schema, barrel export", "classification": "A", "dependencies": [], "sourceSection": "implementation" },
    { "id": "P-RED-002", "phase": "RED", "title": "Clerk auth bridge", "operation": "Mount Clerk proxy before body parsers; JIT local user + subscriber", "classification": "A", "dependencies": ["P-RED-001"], "sourceSection": "implementation" },
    { "id": "P-RED-003", "phase": "RED", "title": "Stripe + webhook idempotency", "operation": "Raw webhook route before JSON parser; PK idempotency net", "classification": "A", "dependencies": ["P-RED-001"], "sourceSection": "implementation" },
    { "id": "P-ORANGE-001", "phase": "ORANGE", "title": "Portal shell + pricing", "operation": "Landing, /pricing, tiered checkout, session shell", "classification": "A", "dependencies": ["P-RED-002", "P-RED-003"], "sourceSection": "worksheet" },
    { "id": "P-YELLOW-001", "phase": "YELLOW", "title": "HARNESS F1-F7 pipeline", "operation": "Ordered atomic-prompt engines -> certified MVP-PDD + verification URL", "classification": "B", "dependencies": ["P-ORANGE-001"], "sourceSection": "worksheet" },
    { "id": "P-YELLOW-002", "phase": "YELLOW", "title": "F8 Code DJ + PFP drift gate", "operation": "Scaffold CODEBASE_BUNDLE; enforce DRIFT_GATE via PFP counts", "classification": "B", "dependencies": ["P-YELLOW-001"], "sourceSection": "implementation" },
    { "id": "P-YELLOW-003", "phase": "YELLOW", "title": "F8-HDJ hosting decision (HOST DJ)", "operation": "Recast HOST DJ SPC as an engine: HSE matrix -> primary/fallback host + DJG journey + SDF artifacts; registry reconciled to F8 platforms + Replit", "classification": "B", "dependencies": ["P-YELLOW-002"], "sourceSection": "implementation" },
    { "id": "P-GREEN-001", "phase": "GREEN", "title": "Public verify + exemplars", "operation": "SPARTAN verification URL, exemplar fork-to-session, email dispatch", "classification": "B", "dependencies": ["P-YELLOW-001"], "sourceSection": "worksheet" },
    { "id": "P-GREEN-002", "phase": "GREEN", "title": "F8 delivery: IDE export + GitHub push", "operation": "Bundle -> ZIP + AGENTS.md; per-user PAT/OAuth push with repo picker + empty-repo seed + PR", "classification": "B", "dependencies": ["P-YELLOW-002"], "sourceSection": "implementation" },
    { "id": "P-BLUE-001", "phase": "BLUE", "title": "Cost cap + audit + offline tests", "operation": "requireCostBudget after rateLimit, activity log, cached-fixture replay", "classification": "A", "dependencies": ["P-YELLOW-001"], "sourceSection": "implementation" },
    { "id": "P-INDIGO-001", "phase": "INDIGO", "title": "Orgs + per-seat tiers + notifications", "operation": "Org tenancy, effectiveTier, weekly digest / billing / high-cost alerts", "classification": "B", "dependencies": ["P-BLUE-001"], "sourceSection": "worksheet" },
    { "id": "P-VIOLET-001", "phase": "VIOLET", "title": "Sphinx + ARK federation (deferred)", "operation": "Two-way marketplace + identity federation", "classification": "C", "dependencies": ["P-GREEN-001"], "sourceSection": "worksheet" }
  ],
  "stack": ["pnpm-monorepo", "Node.js 24", "TypeScript 5.9", "Express 5", "Clerk", "Stripe", "PostgreSQL", "Drizzle ORM", "Zod v4", "Orval", "React", "Vite", "Claude Sonnet 4"],
  "routes": ["/", "/pricing", "/ascension", "/cartridge", "/quests", "/me/costs", "/api/harness/f1..f8", "/api/harness/f8-hdj", "/api/harness/atlas-crystallise", "/api/harness/pfp", "/api/integrations/github/repos", "/api/integrations/sphinx", "/api/me/jst", "/api/orgs"],
  "deployTarget": "express-replit (api-server) + react-vite-static (command-centre) behind the shared path-routing proxy, published over $REPLIT_DOMAINS; F8-HDJ recommends Replit Deployments (Autoscale) as the certified host for this codebase"
}
```
