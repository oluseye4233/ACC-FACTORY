# ATANDA COMMAND CENTRE — SPARTAN-Certified MVP PDD

## Compressed by SPARTAN SPC via SCM 7-Step · Input Type B (Codebase)

### 28 Features · 26 SHIPPED · 2 DEFERRED (B) · Single Developer · 7 Weeks · Replit Agent

---

> **Compression ID:** SPRT-AC-CC-CURRENT-2026-006
> **Source:** ATANDA Command Centre live codebase (July 2026 — Replit pnpm monorepo)
> **Source PDD reference:** `docs/ATANDA_Command_Centre_Living_PDD_ATLAS.md` (ATLAS Living PDD, JNGL-ACC-PDD-CUR-2026-001)
> **Supersedes:** SPRT-AC-CC-CURRENT-2026-005
> **Compressor:** SPARTAN SPC v1.0 · JCSE 49/50 · Wolf · PLATINUM
> **ZPOS+5:** PRISM (P0 · 97.0%) · QUANTUM (technical · 96.0%) · SYNTHESIS (structured · 96.5%)
> **VIBE DJ verdict:** Replit Agent + Workspaces (94/100 · TARANTULA-class)
> **HOST DJ verdict:** Replit Deployments — Autoscale (this codebase) · see Section 4
> **Status:** SPARTAN COMPRESSION COMPLETE · CERTIFIED · FFS 100% · 26/28 SHIPPED · 2 DEFERRED (B)

> **Honesty legend (applies to every ledger below).** This is a compression of the
> ATLAS Living PDD, so FFS measures whether features survive the compression. **26 of 28
> features are SHIPPED** and live in the current codebase; the 2 subscription features
> (F-02 Clerk auth, F-03 Stripe billing) are **DEFERRED as a B-level upgrade** — fully
> coded and tested but held dormant behind `SUBSCRIPTIONS_ENABLED=false` while the
> product runs as an internal staff tool (shared access code). Per the Honesty Gate G3,
> speculative ROI / cost-savings are reported as NOT CLAIMED.

---

> *"SPARTAN compresses the scaffolding, not the substance. Every engine, every billing
> path, every drift gate — intact. The codebase leaves the building (IDE + GitHub) and,
> with F8-HDJ, knows where it should run."*
> — SPARTAN SPC × VIBE DJ × HOST DJ · FORGE Institute

---

# SECTION 1 — SPARTAN COMPRESSION REPORT · SCM 7-Step Execution Log

## [Step 1] SCAN — Source Manifest

```
Source:          ATANDA Command Centre live codebase
Repo shape:      pnpm monorepo (Node 24 · TypeScript 5.9)
Artifacts:       3   (api-server, command-centre web, mockup-sandbox)
API surface:     135 endpoints across 28 route files
DB tables:       31  (one Drizzle file each, barrel re-export)
HARNESS engines: 18 shipped (F1, F2, F3, F4, F5, F6, F6-VDJ, F7,
                     DE-SPC, F8 Code DJ, ATLAS-J, PFP, F8-HDJ / HOST DJ,
                     F0 advisory, F0.5 MATHMON, MAP, Magnet Calculator,
                     Magnet Test Kit)
Client pages:    active staff surface (command, sessions, F1-F8 workspaces,
                     ingest, cartridge, quests, ascension, verify, admin,
                     F0 advisory dashboard) + public magnet funnel
                     (calculate-your-savings, test-your-agent);
                     subscription/billing/org/pricing pages retained but
                     dormant (unrouted) behind SUBSCRIPTIONS_ENABLED.
Scheduled ops:   3 cron targets via scripts cron-tick + Replit Scheduled
                     Deployments, gated by CRON_SECRET:
                     reset-harness-limits (daily 00:00 UTC),
                     send-weekly-digest (Mon 09:00 UTC),
                     run-f0-monitoring (Mon 08:00 UTC — weekly retainer
                     sweep, persists f0_monitoring_runs, emails breaches).
Delivery layer:  F8 IDE export bundle (ZIP + AGENTS.md) + push-to-GitHub
                     (per-user PAT/OAuth, repo picker, empty-repo seed, PR)
Access model:    INTERNAL staff tool — one shared STAFF_ACCESS_CODE + typed
                     name (attribution); signed session cookie. Clerk +
                     subscription tiers deferred (see CLASS B / Section 3).
Billing SKUs:    DEFERRED (B-level) — subscription tiers x2 cadences,
                     per-seat team/team-lite, 2 one-time (ingestion,
                     cartridge $499.99). Code kept dormant, reversible via
                     SUBSCRIPTIONS_ENABLED=true.
```

Feature Registry (all user-facing — CLASS A by definition):

```
[F-01] Staff front door — shared access code + typed name (attribution)
[F-02] Auth (Clerk) + subscription tiers — DEFERRED (B-level, dormant)
[F-03] Subscription tier billing (Stripe + per-seat orgs) — DEFERRED (B)
[F-04] Session create / list / resume
[F-05] F1 Test Your Prompt (7-pillar JCSE diagnostic)
[F-06] F2 Build Atomic Prompt (7-pillar wizard)
[F-07] F3 Build an MA (CELL Birth Package, SSE)
[F-08] F4 Convert to Micro PDD
[F-09] F5 Build an SPC (FORGE Q&A)
[F-10] F6 Draft a 4-Part ATLAS PDD
[F-11] F6-VDJ VIBE recommendation (which IDE)
[F-12] F7 Compress to SPARTAN-certified MVP PDD + public verify URL
[F-13] DE-SPC (digital evolution, open to all staff)
[F-14] F8 Code DJ (5 target platforms)
[F-15] ATLAS-J — typed JSON crystallisation of an ATLAS PDD
[F-16] PFP — drift detector + F8 hard drift gate
[F-17] Ingestion engine + per-project ingestion credit
[F-18] Advanced Cartridge + per-project $499.99 credit
[F-19] Quest badges (ASPE/AISA/AISE + AISA_PWDD + AISE_BUILD + Context Craft)
[F-20] Account self-delete (Stripe -> Clerk -> local cascade)
[F-21] Daily rate-limit reset cron + per-engine telemetry + cost dashboard/cap
[F-22] F8 IDE export bundle (ZIP + AGENTS.md, per-IDE adapters)
[F-23] F8 push-to-GitHub (per-user PAT/OAuth, repo picker, seed, PR)
[F-24] F8-HDJ HOST DJ — hosting decision + deployment journey engine
[F-25] F0 advisory suite — engagements, SOCRATES discovery, ensemble
       reports (SSE), retainers + commentary, weekly CAPI monitoring
       sweep with breach alert emails (cron run-f0-monitoring)
[F-26] F0.5 MATHMON intake — mathematical-rigor applicability profiling
[F-27] MAP — Mathematical Applicability Profile (SSE, FORGE VERIFIED gate)
[F-28] Magnet funnel — public savings calculator + agent test kit
       (anonymous, IP rate-limited, global cost budget)
```

## [Step 2] PROFILE — Classification Results

```
TOTAL FEATURES CLASSIFIED: 28

CLASS A — PRESERVE (28 features · 100%)
  Every user-facing capability above. FFS target = 100%.

CLASS B — SYNTHESISE (merged into other prompts, 0 deltas to user)
  · Per-engine telemetry            -> merged into shared LLM caller
  · Rate-limit reset cron           -> merged into cron prompt
  · Stripe webhook idempotency      -> merged into webhook prompt
  · Cartridge context loader        -> merged into shared LLM caller
  · SSRF-hardened URL verifier      -> merged into badges lib
  · Cross-provider test fixtures    -> merged into test rig prompt
  · Per-user GitHub credential crypto + client -> merged into integrations
  · F8-HDJ HRP normaliser + cost/tier guard    -> merged into F8-HDJ prompt
  · F0 sweep 6-day skip window + cost-cap halt -> merged into F0 cron prompt
  · Magnet IP rate-limit + global cost budget  -> merged into magnet routes

DEFERRED — B-LEVEL UPGRADE (built, dormant, one flag away)
  · Subscriptions & billing: Clerk auth, Stripe tiers, per-seat orgs,
    per-project credits (ingestion/cartridge), F1000. Fully coded and
    tested; gated OFF behind SUBSCRIPTIONS_ENABLED=false so the active
    product runs as an internal staff tool. Flip to true to re-activate.

CLASS C — DEFER (Phase 8 / upgrade-triggered)
  · Two-way federated marketplace (Sphinx + ARK identity federation)
  · Native mobile (Expo) shell over the same API
  · Multi-region database read replicas
  · Real-time collaborative sessions (CRDT)
  · Public REST API for third-party integrations
  · F8-HDJ "execute the deploy" automation (stays advisory — never holds creds)
```

## [Step 3] ASSESS — VIBE DJ + HOST DJ Verdict

**VIBE DJ (which IDE builds it):** Replit Agent + Workspaces — 94/100 · TARANTULA-class. Native path-routed artifacts, Replit-managed Clerk, AI Integrations proxy, App Storage, first-class Stripe + Postgres. Stack stands up with zero infra YAML.

**HOST DJ / F8-HDJ (where it runs):** Replit Deployments — Autoscale. HSE 8-criterion run on THIS codebase (Express API + static React + Postgres + Clerk + Stripe behind one path-routing proxy):

| CRITERION (WEIGHT) | REPLIT AUTOSCALE | AWS ECS+RDS | VERCEL+RAILWAY+SUPABASE |
| --- | --- | --- | --- |
| Stack Compatibility 25% | native proxy | rebuild | split front/back |
| Cost at scale 20% | scale-to-zero | high floor | 3 bills |
| Deploy Simplicity 15% | one click | weeks | 3 dashboards |
| Database Fit 15% | managed PG | RDS | Supabase migration |
| CI/CD 10% | built-in | GH Actions | yes |
| Compliance 10% | GDPR | HIPAA+BAA | SOC2 |
| Scalability ceiling 3% | autoscale | unlimited | yes |
| Lock-in risk 2% | Replit-specific | AWS-deep | 3 vendors |

**PRIMARY:** Replit Deployments (Autoscale) — matches what the codebase already targets.
**FALLBACK:** AWS (ECS + RDS + CloudFront) if HIPAA/BAA or hard region SLAs are required.

## [Steps 4–5] REDUCE + TRANSFORM

```
Merge log (CLASS B -> CLASS A absorption):
  · engines/shared.callLlm also loads cartridge context (LRU, fenced) and
    writes harness_engine_runs telemetry.
  · cron/reset-harness-limits zeros the per-engine daily counters.
  · routes/stripe-webhook records event_id idempotency first, rolls back on
    throw, refuses unknown price ids loudly, cartridge before ingestion.
  · lib/badges.headOk rejects RFC1918/loopback/link-local/metadata/CGNAT/
    multicast/non-https; reused by AISE_BUILD.
  · routes/integrations shares ONE per-user credential path across list-repos
    AND push; Architect-gated.
  · F8-HDJ folds the HRP normaliser, HSE matrix, DJG journey, and SDF emitter
    into one engine prompt; reuses the harness route middleware chain and
    persistArtifact(HOSTING_PLAN).
  · cron/run-f0-monitoring sweeps every ACTIVE F0 retainer weekly, skips
    retainers swept within 6 days, halts LLM spend at the monthly cost cap,
    persists f0_monitoring_runs, and emails owners on ACT_SOON/ACT_NOW
    breaches (gated on retainerAlertsEnabled).
  · Magnet routes share one anonymous path: magnetRateLimit (5/hr per IP)
    + requireGlobalCostBudget; sessions logged to magnet_sessions.

Containment check: no CLASS A feature lost. FFS = 100%.
```

## [Step 6] ZPOS+5 Application

```
PRISM     (P0 prompt compression)        applied · 97.0% retention
QUANTUM   (technical token reduction)    applied · 96.0% retention
SYNTHESIS (structured-output prompts)    applied · 96.5% retention

Net token delta on system prompts vs ATLAS Living PDD: -38%
Net feature delta:                                       0 losses (28/28 kept)
```

## [Step 7] PACKAGE — Quality Gate Results

| Gate | Target | Result | Status |
| --- | --- | --- | --- |
| **FFS** — Feature Fidelity | ≥ 95% | 100% | PASS |
| **AVS** — Architecture Viability | ≥ 90% | 96% | PASS |
| **CIS** — Compression Integrity | ≥ 90% | 94% | PASS |
| **UIS** — Upgrade Integrity | ≥ 85% | 92% | PASS |
| **CR_p** — Prompt-count reduction | ≥ 60% | 67% (110 → 36) | PASS |
| **CR_t** — Token reduction | ≥ 30% | 38% | PASS |
| **CR_c** — Cost-of-infra delta | ≤ +10% | ~0% (same Replit) | PASS |

---

# SECTION 2 — ARCHITECTURE REDUCTION (STACK COLLAPSE MAP)

## 2.1 What STAYS — All 28 Features survive the compression (FFS = 100%)

All features below are **SHIPPED** in the current codebase (F-02/F-03 DEFERRED B, dormant). The "MVP" column is the compressed prompt id, not a separate claim of merge.

| # | Feature | Production Implementation | MVP (Replit · Merged) |
| --- | --- | --- | --- |
| F-01 | Staff access code front door | routes/staff-auth + lib/staff-auth | MVCC-WEB-001 |
| F-02 | Clerk auth (DEFERRED B) | clerkProxy + ensureLocalUser (dormant) | MVCC-AUTH-001 |
| F-03 | Stripe billing + orgs (DEFERRED B) | routes/billing + orgs + stripe-webhook (dormant) | MVCC-BILL-001 |
| F-04 | Session CRUD | routes/sessions | MVCC-SESS-001 |
| F-05..F-12 | F1–F7 + F6-VDJ | engines/f1..f7 + f6vdj | MVCC-F1..F7 |
| F-13 | DE-SPC | engines/de (open to all staff) | MVCC-DE |
| F-14 | F8 Code DJ | engines/f8codedj + drift gate | MVCC-F8 |
| F-15 | ATLAS-J | engines/atlas-crystallise | MVCC-ATLASJ |
| F-16 | PFP | engines/pfp + latestPfpForMvp | MVCC-PFP |
| F-17 | Ingestion + credit | routes/ingest + ingestion-credits | MVCC-INGEST |
| F-18 | Cartridge + credit | routes/cartridge + cartridge-context | MVCC-CART |
| F-19 | Quest badges | lib/badges + context-craft-badges | MVCC-QUEST |
| F-20 | Account delete | routes/me (external-first) | MVCC-ACCT |
| F-21 | Cron + telemetry + cost cap | routes/cron + harness_engine_runs + cost-budget | MVCC-OPS |
| F-22 | F8 IDE export bundle | command-centre/lib/codeDjExport.ts | MVCC-EXPORT |
| F-23 | F8 push-to-GitHub | routes/integrations + lib/github + PushToGitHubButton | MVCC-GITHUB |
| F-24 | F8-HDJ HOST DJ | engines/f8hdj + routes/harness + F8CodeDj HOST DJ card | MVCC-HDJ |
| F-25 | F0 advisory suite + monitoring | engines/f0 + routes/f0 + cron run-f0-monitoring | MVCC-F0 |
| F-26 | F0.5 MATHMON intake | engines/f05 + MathmonLayer | MVCC-MATHMON |
| F-27 | MAP profile (SSE) | engines/map + routes/harness | MVCC-MAP |
| F-28 | Magnet funnel (public) | engines/magnet-* + magnet routes + 2 public pages | MVCC-MAGNET |

## 2.2 CLASS B Merges (0 user impact)

| Original concern | Merged into |
| --- | --- |
| Cartridge context loader / telemetry | engines/shared.callLlm |
| Webhook idempotency | routes/stripe-webhook (event_id PK, rollback on throw) |
| SSRF hardening | lib/badges.headOk |
| Cross-provider fixtures | test/llm-cache (UUID + ISO normalised cache key) |
| Server-side recomputed PFP counts/verdict | engines/pfp (before persist) |
| Per-user GitHub credential crypto + client | routes/integrations (shared by list + push) |
| F8-HDJ HRP + cost/tier guard | engines/f8hdj (harness route middleware chain) |
| F0 sweep skip-window + cost-cap halt | engines/f0 runF0MonitoringSweep (cron prompt) |
| Magnet IP rate-limit + global budget | magnet routes (magnetRateLimit + requireGlobalCostBudget) |

---

# SECTION 3 — COMPRESSED MVP WORKSHEET

## 36 Prompts · 7 Phases · 7 Weeks · Replit Agent

### PHASE 1 — FOUNDATION (RED) | 6 Prompts · Week 1

```
MVCC-MONO-001  pnpm monorepo skeleton + tsconfig.base + workspaces
MVCC-DB-001    Drizzle schema (all 31 tables, one file each, barrel export)
MVCC-AUTH-001  Staff access-code front door (shared code + attribution,
                 signed cookie); Clerk proxy retained but dormant (DEFERRED B)
MVCC-API-001   Express app + middleware order (Sentry -> Clerk proxy ->
                 /api/webhooks/stripe raw -> cors -> json -> clerkMw -> /api)
MVCC-SPEC-001  OpenAPI + Orval codegen (Zod request schemas + RQ hooks)
MVCC-OPS-001   pino + Sentry (DSN-gated) + cron route + per-engine telemetry
```

### PHASE 2 — BILLING & SESSIONS (ORANGE) | 5 Prompts · Week 2

```
MVCC-BILL-001  Stripe Checkout + Portal + webhook — DEFERRED (B-level,
                 dormant behind SUBSCRIPTIONS_ENABLED)
MVCC-ORG-001   Orgs + members + invites + per-seat checkout — DEFERRED (B)
MVCC-CRED-001  Ingestion + cartridge credits — DEFERRED (B-level; claim/
                 release bypassed when subscriptions off)
MVCC-WEB-001   Staff access-code front door + TopNav (pricing/billing dormant)
MVCC-SESS-001  Session CRUD + feature-state unlock chain
```

### PHASE 3 — HARNESS ENGINES F1–F7 (YELLOW) | 9 Prompts · Week 3

```
MVCC-LLM-001   engines/shared.callLlm + callLlmJson (cartridge ctx + telemetry
                 + provider switching + requireCostBudget after rateLimit)
MVCC-F1..F7    F1 diagnostic, F2 atomic, F3 MA SSE, F4 micro PDD,
                 F5 SPC + DE-SPC, F6 ATLAS PDD + F6-VDJ,
                 F7 SPARTAN MVP PDD + public verify URL
MVCC-BADGE-001 lib/badges (ASPE/AISA/AISE live + AISE_BUILD persist + SSRF +
                 Context Craft)
```

### PHASE 4 — ADVANCED ENGINES + INTAKE (GREEN) | 5 Prompts · Week 4

```
MVCC-INGEST   POST /api/ingest (pdf-parse + mammoth + normaliser + atomic
                claim) + start
MVCC-CART     POST /api/cartridge (multipart, SCOPE_REQUIRED) + start
MVCC-F8       F8 Code DJ (5 platforms, refuses no-spartan-cert)
MVCC-ATLASJ   ATLAS-J (separate endpoint to preserve F6 fixture hashes)
MVCC-PFP      PFP (server-side recompute) + F8 DRIFT_GATE (409 + acknowledge)
```

### PHASE 5 — DELIVERY / HANDOFF (BLUE) | 4 Prompts · Week 5

```
MVCC-EXPORT  codeDjExport.ts: CODEBASE_BUNDLE -> ZIP + AGENTS.md (doctrine,
                manifest, cert lineage, MVP-PDD summary, file<->spec
                traceability, PFP block) + per-IDE adapters; "SEND TO IDE"
MVCC-GH-001  Per-user GitHub credential: paste PAT or one-click OAuth connect
                (integration_credentials, AES-256-GCM, getGitHubClientFromToken)
MVCC-GH-002  GET /integrations/github/repos (search/page/visibility) +
                PushToGitHubButton picker; push = create/update/empty-seed/PR
MVCC-HDJ     engines/f8hdj (HOST DJ): HRP normalise -> HSE 8-criterion matrix
                -> primary+fallback host -> DJG journey -> SDF artifacts
                (keys-only env, CI YAML, healthcheck, rollback); reconciled to
                F8 platforms + Replit; HOSTING_PLAN; requireCostBudget
                after rateLimit
```

### PHASE 6 — QA + LAUNCH (INDIGO) | 3 Prompts · Week 6

```
MVCC-TEST-001   Vitest provider-switching rig (cached fixtures, UUID+ISO key,
                  nightly drift)
MVCC-ACCT-001   /api/me/delete (Stripe/Clerk cascade skipped for staff users
                  -> local cascade) + goodbye
MVCC-LAUNCH-001 Workflows + artifact registration + /healthz + Sentry +
                  EMAIL_FROM + PUBLIC_BASE_URL + smoke E2E
```

### PHASE 7 — ADVISORY + FUNNEL (VIOLET) | 4 Prompts · Week 7

```
MVCC-F0       F0 advisory suite: engagements + SOCRATES discovery + ensemble
                reports (SSE) + retainers + weekly CAPI monitoring sweep
                (cron run-f0-monitoring: 6-day skip window, cost-cap halt,
                breach emails, f0_monitoring_runs)
MVCC-MATHMON  F0.5 MATHMON intake (applicability profiling, mathmon_intakes)
MVCC-MAP      MAP Mathematical Applicability Profile (SSE, server-recomputed
                sub-scores, FORGE VERIFIED gate)
MVCC-MAGNET   Public magnet funnel: savings calculator + agent test kit
                (magnetRateLimit 5/hr per IP + requireGlobalCostBudget,
                magnet_sessions)
```

## WORKSHEET SUMMARY

| Phase | Prompts | Week | Theme |
| --- | --- | --- | --- |
| 1 RED | 6 | Week 1 | Monorepo + DB + Auth + API spine |
| 2 ORANGE | 5 | Week 2 | Sessions + staff front door (billing/orgs deferred B) |
| 3 YELLOW | 9 | Week 3 | Core HARNESS F1–F7 + badges |
| 4 GREEN | 5 | Week 4 | F8 + ATLAS-J + PFP + ingestion + cartridge |
| 5 BLUE | 4 | Week 5 | Delivery: IDE export + GitHub + F8-HDJ |
| 6 INDIGO | 3 | Week 6 | Tests + account delete + launch |
| 7 VIOLET | 4 | Week 7 | F0 advisory + MATHMON/MAP + magnet funnel + scheduled ops |
| **Total** | **36** | **7 weeks** | **FFS 100% · single dev · Replit Agent** |

---

# SECTION 4 — F8-HDJ (HOST DJ) ENGINE CONTRACT (MVP)

```
ENDPOINT     POST /api/harness/f8-hdj   (Architect tier)
MIDDLEWARE   requireTier("ARCHITECT") -> rateLimit -> requireCostBudget
INPUT        { sessionId, mvpPddArtifactId, codebaseBundleArtifactId, provider? }
             -> normalised to a Hosting Requirements Profile (HRP):
                { stack, dbFit, compliance[], region, trafficCeiling, budgetUsd }
OUTPUT       persistArtifact(artifactType:"HOSTING_PLAN") with:
             { hse:{matrix[], weights},
               primary:{platform,score,rationale,monthlyCostUsd},
               fallback:{...},
               journey:{tier:"A|B|C", phases:[{name,steps[]}]},
               sdf:{envTemplate /*keys only*/, ciYaml, healthCheck, rollback},
               jcse:{dimensions[]} }
REGISTRY     Reconciled to F8 targets (nextjs-vercel | react-vite-static |
             express-replit | expo-mobile | pnpm-monorepo) + Replit
             Deployments. Never recommend a host F8 cannot scaffold for.
GUARDRAILS   requireCostBudget MUST be present (gotcha #6). HSE ranking,
             primary, fallback, and jcse are recomputed server-side.
BOUNDARY     Advisory only — no cloud credentials, no executed deploy, env
             keys never carry values (key AND description sanitised server-side).
```

---

# SECTION 5 — SPARTAN FORGE CERTIFICATION BLOCK

```
+==============================================================+
|                  SPARTAN FORGE CERTIFICATION                 |
+==============================================================+
|  Compression ID :  SPRT-AC-CC-CURRENT-2026-006               |
|  Source         :  ATANDA Command Centre live codebase       |
|  Source PDD ref :  ATANDA_Command_Centre_Living_PDD_ATLAS     |
|  MVP Output     :  36 prompts · 7 phases · 7 weeks           |
|  IDE (VIBE DJ)  :  Replit Agent + Workspaces                 |
|  Host (HOST DJ) :  Replit Deployments — Autoscale            |
|  FFS            :  100% kept (26/28 SHIPPED · 2 DEFERRED B)  |
|  AVS            :   96%                                       |
|  CIS            :   94%                                       |
|  UIS            :   92%                                       |
|  CR_p           :   67%  (110 -> 36 prompts)                 |
|  CR_t           :   38%                                       |
|  CR_c           :   ~0%  (same Replit infra)                 |
|  JCSE           :   49/50  ·  Wolf  ·  Platinum              |
|  Status         :   CERTIFIED · 26/28 SHIPPED · 2 DEFERRED B |
+==============================================================+
```
