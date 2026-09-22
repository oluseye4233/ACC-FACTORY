# ATANDA Command Centre — ATLAS 360 Living PDD

> Product, Project & Program synthesis of the current codebase
>
> Production ID: `JNGL-ACC-PDD-CUR-2026-002`
>
> Version: `2.0.0-draft`
>
> Snapshot: `2026-09-03T13:11:24-05:00` (America/Chicago)
>
> Source method: ATLAS 360 PLAN v3.0.0, Living PDD Engine
>
> Supersedes: `JNGL-ACC-PDD-CUR-2026-001` (30 May 2026)

## Part 0 — Title, Contents, Provenance & Honesty Gate

### 0.1 Document identity

| Field | Current value |
| --- | --- |
| Human principal | Oluseye Shay Amusa |
| Document title | ATANDA Command Centre — ATLAS 360 Living PDD |
| Production ID | `JNGL-ACC-PDD-CUR-2026-002` |
| Date/time stamp | `2026-09-03T13:11:24-05:00` |
| Mode | ATLAS 360 PLAN — Living PDD Engine |
| Path | Path A (traced), followed by re-baselining because the earlier PDD is materially stale |
| GRO mode | LIFE MODE |
| Honesty tier | Tier 2 — implemented and internally test-verified; current public-production health was not re-certified in this pass |
| Certification | Draft architecture-of-record; no new JCSE, HIVE, MATHMON, SOLVA or FORGE certification claimed |
| Review cadence | Refresh after any merged capability, access-model, integration, schema, engine or deployment change |

### 0.2 Contents

0. Title, Contents, Provenance & Honesty Gate
1. Statement of Requirements
2. Business Case, Financial Position, Demographics & Validation
3. SPC Roster, Skills & Contributory Roles
4. Platform Specifics
5. Atomic Task Worksheet
6. DJ Implementation & Operations Plan
7. Summary of Sources
8. Definition of Terms
9. IP Pre-Registration Screening

### 0.3 What this document claims

- It reverse-translates the repository and running development workflows as they existed at the snapshot time.
- It distinguishes active behavior from dormant code and design-intent.
- Its implementation counts are code-derived: 22 distinct frontend paths, 139 Express route declarations, 33 Drizzle table declarations, 25 mounted route modules, and 15 POST-based HARNESS execution paths plus the escalation stream.
- It records the latest automated evidence available in the workspace: full TypeScript typecheck passed; API tests passed 270/270; web tests passed 94/94; all 11 committed database migrations were applied in development.

### 0.4 What this document does not claim

- It does not claim that implemented subscription, marketplace, IP-search or external-service seams are commercially live.
- It does not claim revenue, ROI, valuation, market size, adoption or user-demographic facts that cannot be derived from code.
- It does not claim that a passing development test suite proves the latest published deployment is healthy.
- It does not claim legal, regulatory, security or IP clearance.
- It does not reclassify HARNESS engines as SPCs. Engines are the instruction layer; the artifacts they produce may be SPCs or PDDs.

### 0.5 OSIRIS drift finding

The superseded PDD described an active public subscription portal with 101 endpoints, 20 tables and 13 engines. The current product is an internal staff operations platform, while Clerk/Stripe subscription behavior is dormant behind `SUBSCRIPTIONS_ENABLED`. The current repository has 139 route declarations and 33 table declarations, plus new F0/F0.5/MAP, acquisition magnets, cost-cap operations and cron-recovery capabilities.

**Drift band: RED.** Route growth is approximately 38%, table growth is 65%, and the active access/commercial posture changed. Under ATLAS 360 PLAN §11, the prior baseline is therefore superseded rather than presented as current or FORGE-verified. This document establishes the new baseline.

---

## Part 1 — Statement of Requirements

### 1.1 Systems diagnosis

The present system solves an operational translation problem: staff need one controlled workspace for taking an idea or existing specification through a repeatable PromptWare production pipeline, preserving evidence, costs, audit history and exportable outputs.

The architecture must support two postures without rebuilding:

1. **Active posture — internal staff operations.** A shared access code gates the app; typed names/initials provide attribution; authenticated staff receive ADMIN/INSTITUTION-equivalent access.
2. **Dormant posture — subscription SaaS.** Clerk identity, Stripe subscriptions, organizations, seats, per-project credits and F1000 remain implemented and tested, but are disabled by default with `SUBSCRIPTIONS_ENABLED=false`.

### 1.2 Current functional requirements

| ID | Priority | Requirement | Status |
| --- | --- | --- | --- |
| ACC-001 | MUST | Run the product as a pnpm/TypeScript monorepo with separately routable web and API artifacts | PRESENT |
| ACC-002 | MUST | Authenticate active staff with the shared access code and a signed session cookie | PRESENT |
| ACC-003 | MUST | Attribute staff actions to a provisioned local user without exposing the shared code | PRESENT |
| ACC-004 | MUST | Preserve dormant Clerk/Stripe SaaS code behind one reversible feature flag | PRESENT |
| ACC-010 | MUST | Move a session through the F1→F7 PromptWare sequence and persist each artifact | PRESENT |
| ACC-011 | MUST | Require a SPARTAN-certified MVP-PDD/PWDD before F8 Code DJ generates a code bundle | PRESENT |
| ACC-012 | MUST | Provide F0 advisory/retainer management and monitoring outside the core F1→F8 path | PRESENT |
| ACC-013 | MUST | Support F0.5 diagnostic intake and MAP/Mathmon structured analysis paths | PRESENT |
| ACC-014 | SHOULD | Provide ATLAS-J crystallisation, DE-SPC synthesis, VIBE DJ, HOST DJ and PFP drift analysis as side-steps | PRESENT |
| ACC-020 | MUST | Treat OpenAPI as the primary API contract and generate client hooks/Zod schemas where supported | PRESENT WITH DISCLOSED EXCEPTIONS |
| ACC-021 | MUST | Authorize user-owned data at the application layer on every query | PRESENT |
| ACC-022 | MUST | Gate every LLM execution path with the active company-wide monthly cost budget | PRESENT |
| ACC-023 | MUST | Record provider, token and USD telemetry for LLM runs, including pre-session work | PRESENT |
| ACC-024 | MUST | Stream long-running engine finalization that can exceed proxy request limits | PRESENT |
| ACC-030 | SHOULD | Accept manual sessions, ingested IPDDs and Advanced Cartridge project context | PRESENT |
| ACC-031 | SHOULD | Export certified work as files, IDE bundles and GitHub-ready repositories | PRESENT |
| ACC-032 | SHOULD | Provide public certificate verification and acquisition magnet tools | PRESENT |
| ACC-033 | SHOULD | Compute badges and Ascension progress from persisted evidence rather than self-report | PRESENT |
| ACC-040 | MUST | Apply committed database migrations without destructive schema pushes | PRESENT |
| ACC-041 | MUST | Keep Stripe webhook processing raw-body-first and idempotent when subscriptions are enabled | PRESENT, DORMANT |
| ACC-042 | MUST | Send operational email safely, escape dynamic HTML and never stamp failed sends as delivered | PRESENT |
| ACC-043 | MUST | Monitor scheduled jobs for stale, flaky and recovered states | PRESENT |
| ACC-044 | SHOULD | Expose staff cost, activity and operations-health dashboards | PRESENT |
| ACC-045 | SHOULD | Mirror local changes to GitHub without force-pushing or requiring workflow scope | PRESENT, CURRENTLY NEEDS BASE RECONCILIATION |

### 1.3 Non-functional requirements

- **Security:** signed sessions, no secret values in outputs, SSRF controls on URL evidence, app-layer ownership checks, sanitized email HTML and server-recomputed safety gates.
- **Reliability:** Stripe replay protection, exactly-once alert stamps where chosen, migration-status startup checks, cron heartbeat history and recovery notification.
- **Cost control:** every LLM callsite must be budget-gated and recorded; no silent unmetered pre-session calls.
- **Portability:** certified artifacts can be exported as Markdown/PDF/ZIP/IDE/GitHub bundles.
- **Maintainability:** OpenAPI-first where practical, generated clients, one schema module per domain, committed migrations and workspace-wide typecheck/tests.
- **Observability:** structured API logging, engine run ledger, cost views, activity views, cron status and optional Sentry.

### 1.4 Known requirement tensions

- Contract-first is the default, but org/activity/cartridge and other specialist routes use hand-written validation because multipart/OpenAPI codegen has known limitations.
- Application-layer authorization has no PostgreSQL RLS safety net; every query must retain explicit ownership filters.
- Staff mode intentionally bypasses subscription tier and badge gates, while keeping those systems in the codebase.
- Cartridge injects authoritative context into every call, but the operator still manually drives F1→F7.
- Marketplace and external Ark/Sphinx seams fail explicitly when not configured; they are not mocked as live.

---

## Part 2 — Business Case, Financial Position, Demographics & Validation

> **ATLAS 360 Path A honesty rule:** business rationale not provable from code is marked `[INFERRED]`. No SOLVA GAUNTLET was run for this draft.

### 2.1 Business case

`[INFERRED]` ATANDA Command Centre productizes a repeatable method for turning ideas and source documents into structured PromptWare deliverables, reducing dependence on untracked one-off prompting. The current staff posture supports internal production and quality control before any broader subscription relaunch.

### 2.2 Value already embodied in the code

| Capability | Operational value | Evidence class |
| --- | --- | --- |
| Persistent F1→F8 session pipeline | Reproducible work with a traceable artifact chain | VERIFIED-INTERNAL |
| PFP and server-recomputed verdicts | Prevents a model from self-approving contradictory drift results | VERIFIED-INTERNAL |
| Company-wide LLM cap and run ledger | Makes spend visible and mechanically bounded | VERIFIED-INTERNAL |
| F8 ZIP/IDE/GitHub delivery | Converts a certified specification into a portable build handoff | VERIFIED-INTERNAL |
| IPDD ingestion and Cartridge | Brings existing project material into the same controlled pipeline | VERIFIED-INTERNAL |
| F0 retainers and monitoring | Supports ongoing advisory operations around the core build flow | VERIFIED-INTERNAL |
| Scheduled-job health and recovery email | Makes silent cron failures and recoveries visible to operators | VERIFIED-INTERNAL |

### 2.3 Financial position

- Real LLM cost is recorded per run and summarized by user, engine and month.
- The active staff guardrail is `STAFF_MONTHLY_COST_CAP_USD`.
- Stripe subscription, seat and one-time purchase code is implemented but dormant.
- No revenue, margin, payback-period, valuation or savings claim is made in this document.
- Any future financial forecast requires EVE modelling and a SOLVA GAUNTLET verdict before publication.

### 2.4 Users and stakeholders

| Group | Present interaction |
| --- | --- |
| Staff operator | Creates sessions, runs engines, ingests context, exports outputs and reviews personal cost/activity |
| Staff administrator | Reviews operational health, badges, cost alerts and scheduled-job history |
| Advisory operator | Manages F0 engagements, retainers, reports, tasks and monitoring alerts |
| Public verifier | Checks a certificate without entering the authenticated portal |
| Acquisition visitor | Uses the agent-test and savings-calculator magnets |
| Future subscriber/org member | Code exists but the experience is dormant until subscriptions are enabled |

No demographic distribution or adoption count is asserted.

### 2.5 Validation status

| Check | Snapshot result |
| --- | --- |
| Workspace TypeScript typecheck | PASS |
| API automated tests | 270/270 PASS |
| Command Centre automated tests | 94/94 PASS |
| Development API startup | PASS; server listening on port 8080 |
| Development web startup | PASS; Vite listening on port 21731 |
| Database migration status | 11/11 committed migrations applied in development |
| Published production health | NOT RE-CERTIFIED IN THIS PASS |
| GitHub mirror | DEGRADED; last sync base is not an ancestor of current HEAD and needs explicit base reconciliation |

---

## Part 3 — SPC Roster, Skills & Contributory Roles

These are methodology overlays for this document. They are not runtime agents and do not reclassify HARNESS engines.

| Contributor | Role in this Living PDD | Status applied here |
| --- | --- | --- |
| ATLAS 360 PLAN | Host structure: product, project and program synthesis | Reference specification supplied by the principal |
| KONSTRUCT | Requirements diagnosis before implementation description | Applied analytically |
| KLARITY | Plain-language and audience separation | Applied analytically |
| OSIRIS | Baseline comparison and GREEN/AMBER/RED drift ruling | Applied analytically |
| CODE DJ | Reverse-engineering code into platform and atomic-task descriptions | Applied analytically |
| BUGMXT | Code/PDD fidelity and defect-risk framing | Applied analytically |
| SKRIBE | Living document consistency and readable tables | Applied analytically |
| CARTER | Terminology normalization | Applied analytically; no persistent terminology-store write claimed |
| SOLVA | Business-case adjudication | NOT RUN; Part 2 remains inferred |
| EVE | Financial modelling | NOT RUN |
| KONSA | External evidence retrieval | NOT RUN; Part 7 uses internal primary sources |
| ALBERT | IP candidate extraction and open-register screening | Candidate extraction only; no register search run |

### Runtime PromptWare roster

The implemented instruction layer consists of:

- Core path: F1, F2, F3, F4, F5, F6, F7 and F8 Code DJ.
- Advisory/diagnostic paths: F0, F0.5 and MAP.
- Side-steps: F6 VIBE DJ, F8 HOST DJ, DE-SPC evolve, ATLAS-J crystallisation and PFP.
- Public acquisition engines: agent test kit and savings calculator.

The source directory also contains shared prompt, routing and utility modules; file count is not used as an engine count.

---

## Part 4 — Platform Specifics

### 4.1 Product topology

| Layer | Present implementation |
| --- | --- |
| Web artifact | React + Vite + Wouter; 22 distinct route paths; public and authenticated route sets |
| API artifact | Express 5; 25 mounted route modules; 139 route declarations |
| Data | PostgreSQL + Drizzle; 33 `pgTable` declarations; 11 committed migrations |
| API contract | `lib/api-spec/openapi.yaml` with Orval-generated Zod and React Query packages |
| AI providers | Provider-switching integration packages for Anthropic, OpenAI and Gemini; prompts use recorded provider/model metadata |
| Documents | Markdown/PDF/export helpers plus IDE and repository bundles |
| Replit services | Static web artifact, runnable API artifact and isolated mockup-sandbox design artifact |

### 4.2 Active navigation and user journeys

Public paths:

- `/verify`
- `/test-your-agent`
- `/calculate-your-savings`

Authenticated paths:

- `/command`, `/guide`, `/sessions`, `/session/new`, `/session/:id`
- `/ingest`, `/cartridge`, `/f0`, `/prompts`
- `/quests`, `/ascension`, `/account`
- `/admin/badges`, `/admin/ops`
- `/me/activity`, `/me/costs`
- `/exemplars`, `/exemplars/:id`

### 4.3 Core session lifecycle

1. Create or seed a session manually, from an IPDD, from an exemplar, or from Cartridge context.
2. F1 diagnoses the raw prompt against Context Craft dimensions.
3. F2 produces an Atomic Prompt.
4. F3 produces a CELL Micro Agent birth package.
5. F4 produces a Micro PDD.
6. F5 produces a full SPC.
7. F6 produces an ATLAS PDD and may invoke VIBE DJ.
8. F7 compresses and certifies an MVP-PDD/PWDD and exposes a verification path.
9. F8 Code DJ produces a bounded codebase bundle; GitHub/IDE export uses that same generated file set.
10. HOST DJ may provide advisory hosting ranking and deployment journey; it does not deploy.

### 4.4 Supporting domains

- **F0 operations:** engagements, reports, report codes, retainers, retainer tasks and monitoring runs.
- **Prompt quality:** F0.5 intake, MAP/Mathmon, DE-SPC, ATLAS-J and PFP.
- **Context intake:** ingestion credits/documents and Cartridge packages/documents/SPCs/links.
- **Progression:** badges, revocation history, Context Craft pillars, JST assessments, reader onboarding and Ascension.
- **Commercial layer:** subscribers, pricing content, F1000 invitations, organizations/members/invites and Stripe event ledger; dormant in staff mode.
- **Operations:** cost notifications, cron tick status/events, stale/flaky/recovery episodes, email preferences and integration credentials.
- **Growth:** exemplars, public verification and magnet sessions.

### 4.5 Data and authorization

- Drizzle schema modules are the database source; migrations are generated and committed.
- The app uses explicit user/org filters rather than RLS.
- Stripe webhook event IDs provide replay idempotency when billing is active.
- Staff sessions provision local user/subscriber records for attribution.
- Integration credentials are encrypted at rest where applicable; raw values are not returned to clients.

### 4.6 LLM execution and cost controls

- `harnessRoute` centralizes authentication, optional tier/rate gates, extra middleware, cost-budget enforcement and the engine handler.
- In active staff mode, the company-wide monthly cap supersedes personal tier caps.
- Every LLM run must create a run-ledger row; pre-session work uses nullable session IDs and explicit sentinel engine IDs where required.
- Large finalization flows use streaming to avoid the proxy’s single-request timeout.
- Tests use deterministic provider fixtures rather than live network calls by default.

### 4.7 Notifications and scheduled operations

Scheduled targets:

- Weekly activity digest
- Daily rate-limit reset
- Weekly F0 monitoring
- Cost-cap alert sweep every 15 minutes

Cron handlers record heartbeats. The monitor detects stale schedules, degraded/flaky frequency, and recovery. Exactly-once stamps are used to avoid alert floods. Email templates escape dynamic HTML, URL bases are restricted to HTTP(S), and callers check the email result before recording delivery where retryability matters.

### 4.8 Present limitations and design debt

- Some API routes intentionally remain outside OpenAPI codegen.
- No RLS fallback exists beneath application authorization.
- Subscription and organization billing journeys are not active in staff mode.
- Sphinx and Ark integration behavior depends on external services and configuration.
- GitHub mirror workflow currently needs a one-time explicit base reconciliation after history divergence.
- Public-production health is not declared current by this document.
- ALBERT register access and a live Part 9 search are not implemented as part of this repository.

---

## Part 5 — Atomic Task Worksheet

The chain is **Feature → Atomic Task → Atomic Prompt**. Existing IDs are preserved; new rows extend rather than renumber the prior living PDD.

| Feature | Task ID | Atomic prompt | Input | Verifiable output |
| --- | --- | --- | --- | --- |
| Foundation | ACC-001 | Start the API with migration status checked | env + schema | listening API or explicit startup failure |
| Foundation | ACC-002 | Authenticate a staff operator | access code + display name | signed staff session |
| Foundation | ACC-003 | Resolve the staff session to a local user | signed cookie | `req.localUser` |
| HARNESS | ACC-010 | Diagnose one raw prompt | session + prompt | persisted F1 artifact |
| HARNESS | ACC-011 | Build one Atomic Prompt | F1 artifact | persisted F2 artifact |
| HARNESS | ACC-012 | Build one CELL package | F2 artifact | persisted F3 artifact |
| HARNESS | ACC-013 | Build one Micro PDD | F3 artifact | persisted F4 artifact |
| HARNESS | ACC-014 | Build one full SPC | F4 artifact | persisted F5 artifact |
| HARNESS | ACC-015 | Draft one ATLAS PDD | F5 artifact | persisted F6 artifact |
| HARNESS | ACC-016 | Certify one MVP-PDD/PWDD | F6 artifact | certificate + verification identity |
| Delivery | ACC-017 | Generate one bounded codebase bundle | certified artifact | ZIP/manifest/file set |
| Fidelity | ACC-018 | Compare one bundle against its certified PDD | PDD + bundle | server-normalized PFP report |
| Advisory | ACC-050 | Create one F0 engagement | operator input | persisted engagement |
| Advisory | ACC-051 | Sweep one eligible retainer | retainer + latest state | monitoring run + optional alert |
| Diagnostics | ACC-052 | Run one F0.5 diagnostic intake | structured concern | diagnostic artifact |
| Diagnostics | ACC-053 | Stream one MAP analysis | intake/context | persisted map |
| Intake | ACC-030 | Claim and ingest one IPDD | document | source record + PWDD session |
| Intake | ACC-031 | Claim and assemble one Cartridge | scoped project assets | package + linked session |
| Governance | ACC-040 | Apply one generated schema migration | committed migration | matching DB journal |
| Governance | ACC-041 | Record one LLM run cost | provider response | run-ledger row |
| Governance | ACC-042 | Reject one over-budget LLM request | monthly spend + cap | HTTP 402 without new LLM call |
| Notifications | ACC-043 | Dispatch one digest only after provider success | digest payload | sent count + delivery stamp |
| Notifications | ACC-044 | Close one stale cron episode after recovery | new heartbeat | recovery stamp + all-clear email |
| Integration | ACC-045 | Push one F8 file set to GitHub | bundle + connection | repository commit or explicit error |
| Growth | ACC-060 | Record one acquisition-magnet session | public tool input | privacy-bounded magnet result |
| Progression | ACC-061 | Award one evidence-backed badge | persisted qualifying signal | idempotent badge state |

### 5.1 Worksheet acceptance rules

- One task performs one coherent operation.
- Every task traces to a feature and a current code path.
- LLM tasks include both budget enforcement and run recording.
- Any client-provided aggregate, score, verdict or ranking with gate impact is recomputed server-side.
- A task is not marked complete merely because an email promise resolved; `EmailResult.ok` must be true.

---

## Part 6 — DJ Implementation & Operations Plan

### 6.1 As-built tool selection

| Tool/platform | Current role |
| --- | --- |
| Replit | Project workspace, artifacts, workflows, secrets, development preview and publishing |
| pnpm workspaces | Dependency graph and package execution |
| TypeScript 5.9 / Node.js 24 | Primary implementation/runtime |
| React + Vite | Staff web interface |
| Express 5 | API and webhook service |
| PostgreSQL + Drizzle | Persistent data and migrations |
| OpenAPI + Orval | Contract and generated clients/validators |
| Vitest | API and web automated tests |
| GitHub integration | Repository mirror and F8 delivery target |
| Stripe | Dormant subscription, seat and credit billing |
| Replit AI integrations | Provider access for model execution |

### 6.2 Change protocol

1. Diagnose the requirement before naming a new package or platform.
2. Update OpenAPI first unless the route is an explicitly documented exception.
3. Add/change Drizzle schema and generate a committed migration; never synchronize shared DBs with destructive `push`.
4. Use canonical `harnessRoute` ordering for new LLM execution surfaces.
5. Ensure every LLM caller is budget-gated and recorded.
6. Add focused tests and run workspace typecheck/test.
7. Restart affected workflows once after the coherent change.
8. Update this Living PDD when the capability, count, posture or invariant changes.

### 6.3 Operational baseline

- Web development workflow: running.
- API development workflow: running with all migrations applied.
- Mockup sandbox: running as an isolated design artifact.
- Typecheck and test workflows: passing at the snapshot.
- GitHub Sync: running but failing fast on a divergent resume base; do not force-push.

### 6.4 Next review triggers

Refresh this document immediately when any of the following occurs:

- `SUBSCRIPTIONS_ENABLED` becomes active.
- A new engine or public/authenticated route is added.
- The API contract exception list changes.
- A schema table or migration is added.
- A new scheduled target, alert stamp or integration is introduced.
- Published production health is formally reverified.
- ALBERT performs the first live register query for this product.

---

## Part 7 — Summary of Sources

### 7.1 Internal primary sources

| Source | Use | Classification |
| --- | --- | --- |
| `replit.md` | Active posture, stack, operating constraints, scheduled jobs and terminology | VERIFIED-INTERNAL |
| `README.md` | Product summary and repository entry points | VERIFIED-INTERNAL |
| `docs/architecture/decisions.md` | Binding architecture decisions and known contract exceptions | VERIFIED-INTERNAL |
| `docs/architecture/features.md` | Detailed shipped feature behavior | VERIFIED-INTERNAL |
| `docs/architecture/gotchas.md` | Non-obvious implementation constraints | VERIFIED-INTERNAL |
| `docs/architecture/llm-cost-guardrail.md` | Cost-budget invariant | VERIFIED-INTERNAL |
| `lib/api-spec/openapi.yaml` | Contract-declared API surface | VERIFIED-INTERNAL |
| `lib/db/src/schema/*.ts` | Current data model | VERIFIED-INTERNAL |
| `artifacts/api-server/src/routes/*.ts` | Runtime API route declarations | VERIFIED-INTERNAL |
| `artifacts/api-server/src/engines/*.ts` | PromptWare execution layer | VERIFIED-INTERNAL |
| `artifacts/command-centre/src/App.tsx` | Active browser route map | VERIFIED-INTERNAL |
| Workspace workflow logs at snapshot | Typecheck, tests, startup and migration evidence | VERIFIED-INTERNAL |

### 7.2 Method source

`ATLAS_360_PLAN_v3_0_0_ALBERT_Integration_1788458927280.pdf`, supplied 3 September 2026, provides the 10-Part standard, Path A/Path B Living PDD rules, OSIRIS drift bands, source classification and ALBERT Part 9 boundary.

### 7.3 External evidence status

No KONSA evidence-retrieval pass was run. Business and market statements are therefore limited to code-supported operational value or marked `[INFERRED]`.

---

## Part 8 — Definition of Terms

| Term | Type | Grounded definition in this project |
| --- | --- | --- |
| ATANDA Command Centre | Product | Internal staff operations platform around the FORGE.BONSAI HARNESS |
| FORGE.BONSAI HARNESS | Governance/architecture | Ordered PromptWare instruction layer that drives session transformations; not itself an SPC |
| Engine | Runtime component | A bounded instruction/execution path such as F1, F7, F8 or PFP |
| SPC | Artifact/method | Super Prompt Card; may describe a reusable governed prompt method |
| PDD | Artifact family | PromptWare Design Document unless explicitly qualified otherwise |
| IPDD | Input artifact | Ingestion Product Design Document supplied to the ingestion flow |
| PWDD | Output artifact | PromptWare Design Document produced from an ingested IPDD |
| Micro PDD | Qualified output | F4 intermediate document |
| ATLAS PDD | Qualified output | F6 structured design document |
| MVP-PDD | Qualified output | F7 SPARTAN-compressed, certifiable output |
| Living PDD | Governance artifact | Current code-derived architecture baseline that is refreshed as implementation changes |
| Cartridge | Context package | Scoped project context containing documents, SPCs and non-secret links, injected into session prompts |
| PFP | Quality control | PDD Fidelity Protocol that compares a certified document to a code bundle |
| F0 | Advisory layer | Engagement, report, retainer, task and monitoring domain outside the sequential build path |
| F0.5 | Diagnostic layer | Structured pre-build diagnostic intake |
| MAP | Analysis path | Streaming structured analysis associated with Mathmon intake/map records |
| Staff mode | Access posture | Shared-code authentication with ADMIN/INSTITUTION-equivalent access |
| Subscription mode | Dormant posture | Clerk/Stripe tiered SaaS behavior enabled by `SUBSCRIPTIONS_ENABLED` |
| Exactly-once stamp | Reliability construct | Unique persisted marker used to prevent duplicate operational notifications |
| Drift band | Governance metric | OSIRIS classification: GREEN under 15%, AMBER 15–30%, RED over 30% or governance breach |
| DESIGN-INTENT | Evidence class | Specified but not proven as a live integrated capability |

CARTER persistent-library synchronization was not run; these definitions are grounded in current repository language only.

---

## Part 9 — IP Pre-Registration Screening

> Preliminary candidate inventory only. No USPTO, WIPO, EUIPO, UKIPO, US Copyright Office or other register was queried in this pass. Nothing below states that a mark is clear, safe, available, registrable or patentable. This is not legal advice or a substitute for a licensed practitioner’s clearance search.

### 9.1 Candidate extraction

| Candidate | Apparent class | Repository use | Search status |
| --- | --- | --- | --- |
| ATANDA Command Centre | Product/service name | Product title and interface | UNSEARCHED |
| FORGE.BONSAI HARNESS | Product/method name | Core PromptWare instruction layer | UNSEARCHED |
| ATLAS 360 PLAN | Method/document name | Living-PDD methodology supplied for this pass | UNSEARCHED |
| Advanced Cartridge | Feature/service name | Scoped project-context intake | UNSEARCHED |
| PDD Fidelity Protocol / PFP | Method name | Code-to-PDD drift analysis | UNSEARCHED |
| ATLAS-J / JSON Crystallisation | Feature/method name | Typed ATLAS PDD transformation | UNSEARCHED |
| HOST DJ / VIBE DJ / CODE DJ | Productized role names | Advisory and implementation paths | UNSEARCHED |
| Ascension Protocol | Program name | Evidence-based onboarding/progression | UNSEARCHED |
| SPHINX Marketplace | External product/integration name | Outbound listing seam | EXTERNAL OWNERSHIP/RIGHTS NOT ASSESSED |
| F0, F0.5 and MAP mechanisms | Technical workflow candidates | Advisory and diagnostic architecture | PATENT LANDSCAPE NOT RUN |
| Exactly-once cron stale/flaky/recovery model | Technical mechanism candidate | Operational alert lifecycle | PATENT LANDSCAPE NOT RUN |
| Certified PDD-to-code drift gate | Technical mechanism candidate | PFP/F8 delivery control | PATENT LANDSCAPE NOT RUN |

### 9.2 Required next ALBERT pass

If formal screening is requested:

1. Confirm target jurisdictions and product/service classes.
2. Run dated `SEARCH` requests for proposed names.
3. Run `PATENT_VALIDATION` only as a landscape search for mechanism candidates.
4. Name every register, query, class and query date in the findings table.
5. Keep any suggested replacement names marked `UNSEARCHED` until separately queried.
6. Route active disputes, received legal correspondence, litigation or deadlines within five business days directly to qualified counsel.
7. Do not generate filing documents or legal correspondence by default.

---

## Living Update Record

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-05-30 | Original ATLAS 4-Part reverse-translation baseline |
| 2.0.0-draft | 2026-09-03 | Re-baselined under ATLAS 360 PLAN v3.0.0; active staff posture, current platform counts, F0/F0.5/MAP, magnet, cost, notification and cron-recovery domains documented; prior baseline classified RED drift |

## Maintenance Rule

This Markdown file is the living source of truth. PDF copies are snapshots only. A future change is incomplete if it materially changes the product posture, engines, routes, tables, integrations, cost controls, operational jobs or certified-output semantics without updating the affected `ACC-###` rows and this update record.