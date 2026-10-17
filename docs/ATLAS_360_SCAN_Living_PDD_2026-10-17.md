# ATLAS 360 SCAN — Living PDD
## ATANDA Command Centre / ACC-FACTORY

**Evidence date:** 17 October 2026. Public probes captured at approximately 14:52–14:57 UTC (09:52–09:57 America/Chicago).
**Document class:** Repository-grounded current-state assurance PDD, with a living maintenance protocol.
**Code freeze:** `ad265fcea73835783dae6490cb90cd3da4168fae`.
**GitHub:** `oluseye4233/ACC-FACTORY`, main; application snapshot synchronized, followed by sync-recovery documentation.
**Published target:** https://command-center.atanda.ai
**Audience:** Product owner, operators, engineering, release governance.
**Assurance boundary:** This report is not independent XVL verification, FORGE certification, a penetration test, a compliance attestation, or proof of every authenticated workflow.

## Reading guide and status legend

The report preserves the eight ATLAS 360 SCAN stages used by the platform. The four ATLAS document parts follow those stages. Addendum A is the current site map; Addendum B is the activation register; Addendum C defines living-document maintenance.

- **LIVE—OBSERVED:** The stated behavior was directly observed on the published platform during this scan. The claim is limited to that observation.
- **DEPLOYED—UNVERIFIED:** Code or an endpoint is present in the published release, but its authenticated behavior or complete business outcome was not verified.
- **IMPLEMENTED—LOCAL VERIFIED:** Source and recorded development/preview evidence exist. This is not a live-operation claim.
- **BLOCKED / INACTIVE:** A required control is demonstrably missing, or the feature is explicitly disabled.
- **PENDING / PARTIAL:** Requirements remain incomplete or only a limited/advisory path exists.
- **DEFERRED:** Explicitly postponed; not an MVP launch requirement.

A frontend HTTP 200 may only mean the SPA shell was served. It does not prove the route's feature worked. A configured model provider is not evidence of a successful model call. “Unverified” does not mean “inactive.”

# SCAN STAGE 1 — Freeze-stage Evidence Manifest

## 1.1 Frozen sources

| Evidence | Location / observation | Scope |
| --- | --- | --- |
| Application routes | `artifacts/command-centre/src/App.tsx` | Public paths, authenticated paths and route ordering |
| API router | `artifacts/api-server/src/routes/index.ts` | Mounted API capabilities |
| Production readiness | `/api/healthz`, `/api/health`, `/api/readyz`, `/api/launch-readiness` | Public reachability, database probe, provider configuration |
| Operations implementation | `artifacts/api-server/src/lib/artifact-operations/` and corresponding routes/UI | Preparation and protected full-workflow separation |
| SQL readiness contract | `database-protection.ts` | Six read-only control groups; fail-closed full lane |
| Upgrade ledger | `docs/upgrade-program/progress.json` | Historic local/live observations; not automatically current |
| Release boundary | `docs/upgrade-program/SPARTAN-artifact-preparation-release.md` | Preparation scope, explicit exclusions |
| SCAN contract | `artifacts/api-server/src/engines/pdd-view.ts` | Eight-stage SCAN structure |
| Production catalogs | Read-only `pg_class`, `pg_policy`, `pg_roles`, `pg_trigger` inspection | Presence of five workflow tables; absent required guards |
| Production deployment | Build `f4343ca5-a545-4574-a34d-948d0926f789` | Success reported at 2026-10-17 14:31:07 UTC |
| Live client asset | `/assets/index-B6U19k7J.js` | SHA-256 `38093616de5498bad9364df88b4df3ca1df3ccb3252ec4d106821fc5c76140e9` |

The companion evidence manifest records source hashes, the route inventory, the scan JSON, and frozen public/database observations. It is generated with this report, not signed by an independent verifier.

## 1.2 Production observations

| Probe | Result | What it establishes |
| --- | --- | --- |
| `GET /api/healthz` | HTTP 200, status ok | API process is responding |
| `GET /api/health` | HTTP 200; db ok, engines ok, version 0.1.0 | DB probe and configuration-based engine readiness; no model execution |
| `GET /api/readyz` | HTTP 200; database available, AI configured, buildReady true | Baseline launch readiness only |
| `GET /api/launch-readiness` | Same readiness state | Explicitly warns that full XVL/VTE, F12 and governed operations remain incomplete |
| `GET /api/auth/session` | HTTP 200; authenticated false | Anonymous session lookup works |
| `GET /api/sphinx/catalog` | HTTP 200; publicOpen false; items empty | Public commerce activation is closed |
| Anonymous preparation reads, IMPRIMA and SHORT SPRINTS | HTTP 401 Unauthorized | Both deployed endpoints reject anonymous access; not proof of owner save/download |
| `/`, `/status`, `/sphinx`, `/operations` | HTTP 200 HTML shell | Frontend asset serving; protected operations still require authentication |

An exploratory `/api/staff/session` request returned 404; the correct current route is `/api/auth/session`. This is a probe-path correction, not a product defect.

## 1.3 SQL guard observations

All five expected tables now exist: `imprima_jobs`, `imprima_files`, `short_sprint_runs`, `artifact_operation_events`, and `sprint_verifier_authorities`.

For each table, RLS is enabled but **FORCE RLS is false**. Each has **zero policies containing both USING and WITH CHECK predicates** in the observed catalog. The required `atanda_artifact_operations` role is absent. No non-internal IMPRIMA immutability triggers were returned for `imprima_jobs` or `imprima_files`.

**Conclusion:** Table creation has advanced since the old ledger entry, but full workflow protection is not ready. RLS enabled alone is insufficient. No production data or schema was modified for this report.

## 1.4 Evidence limits

No new authenticated production create/save/reopen/download journey, model execution, checkout, independent verifier receipt, provider deployment, rollback, or destructive security test was performed. No customer records or secrets are reproduced. Previously recorded preview tests are historical evidence, not a test run performed during this scan.

# SCAN STAGE 2 — Baseline and Scope

## 2.1 Product baseline

ATANDA Command Centre is a PromptWare production and operations platform. A React/Vite client, Express API, shared OpenAPI-generated clients/schemas, PostgreSQL persistence and private object storage support a gated F-process, document generation, artifact libraries, advisory execution and release handoffs.

The platform is not a single all-features-enabled release. It combines established engine surfaces, recently deployed preparation functionality, and deliberately closed governed operations.

## 2.2 Architectural map

```text
Visitor / subscriber / authorized operator
  -> React/Vite Command Centre
     -> public acquisition, verification, status, Sphinx shell
     -> authenticated command, sessions, library, operations, administration
  -> Express API /api
     -> identity + owner checks + tier/feature gates + cost controls
     -> HARNESS engines and generated API contracts
     -> PostgreSQL records + private immutable file bytes
     -> optional provider/verifier/export connections
  -> guarded release boundary
     -> independent receipts / custody / authorized target / health evidence
```

Clerk-related identity integration and the existing staff-session boundary are present in the project; this report does not alter authentication. Secrets remain in the existing environment/integration controls. Azure Key Vault adoption is deferred, not silently replaced with a claim of Azure compliance.

## 2.3 In-scope capabilities

Public entry and recovery, F0–F9 engine surfaces and side-steps, F10 release connectors, F11 hosting handoff, F12 staged-operation implementation, Exemplar/Sphinx catalog supply, SPC Player, IMPRIMA, SHORT SPRINTS, admin/cost/billing surfaces, and the upgrade invariant register.

Out of scope: independent certification, customer acceptance, commercial marketplace launch, real infrastructure provisioning, or treating analyst SPC methods as software-enforced controls.

# SCAN STAGE 3 — Evidence Mapping

## 3.1 F-process and side-step map

| Surface | Source-backed purpose | Current assurance |
| --- | --- | --- |
| F0 | Service intake, engagements, reports and retainers | Authenticated implementation; live business journey unverified |
| F1–F2 | Test/assess prompt and evolve the production input | Implemented engines; model-run result not sampled live |
| F3 | MA/CELL birth package | Implemented; source, owner, tier and cost gates apply |
| F4 | Micro PDD | Implemented; reused as SC ONE preparation source |
| F5 | SPC construction and synthesis | Implemented; source for SC TWO and catalog copies |
| F6 | ATLAS PDD | Implemented; ATLAS J and 360 PLAN/SCAN are side-step views |
| F7 | SPARTAN MVP conversion | Implemented; doctrinal labels are not an independent certificate |
| F8 | CODE DJ codebase bundle and HOST DJ advisory | Gated implementation; submitted CI/IDE evidence is not provider-validated |
| F9 | Firmware machine-floor verification/custody evidence | Hardware/profile-dependent; Software routing differs; not a universal requirement for every artifact |
| F10 | Signed release/export/connector boundary | Target-specific and fail-closed; no live delivery executed here |
| F11 | Hosting/provider handoff | Implemented surfaces; target credentials and evidence required |
| F12 | Staged rollout, health, incident and rollback/promotion | Implemented in full operational workflow; not fully active/independently verified |

The proposed old numbered “F10 ATLAS 360” concept is retired. ATLAS 360 PLAN/SCAN remains an F6/F7 document view; current F10 refers to the release gateway.

## 3.2 IMPRIMA: two distinct lanes

**Private preparation lane:** Named authenticated owner, existing session-backed source, source-preserving DRAFT HTML/DOCX/Unicode PDF, saved metadata, private individual files and ZIP, exact-byte manifest, no model call. Unsafe/secret-like sources are rejected. Preparation manifests forbid release; no Final approval or public publication is implied.

**Protected full lane:** Editorial/review workflow, immutable versions, named Final approval and governed handoff exist in the implementation and have recorded preview tests. Production SQL guard deficiencies keep this lane blocked. A preparation is not a substitute Final record.

## 3.3 SHORT SPRINTS: two distinct lanes

**Private preparation lane:** SC ONE packages the Micro PDD and birth package; SC TWO packages the SPC, configuration and standalone agent spec sheet. Files persist privately with exact-byte manifests. These are proposals/packages, not permission to skip stages or deploy.

**Protected full lane:** Source qualification, YES/NO/DEFER, immutable exports, signed independent track receipts, custody, route/restore and provider rollout controls are implemented or partially represented. True full activation requires SQL guards and genuine verifier/provider execution evidence. Synthetic test receipts cannot qualify a customer release.

## 3.4 Exemplar → Sphinx supply

The shared catalog architecture avoids building a second marketplace inventory. Owners keep library artifacts private by default and may opt qualified copies into supply. MA, SPC, Micro PDD and PDD qualification must be assessed against the internal eligibility rules; source presence alone is not eligibility. Opening Sphinx requires an explicit authorized launch action. Commerce remains external to the shared metadata catalog; the current catalog is closed.

## 3.5 XVL / VTE and SPC Player

XVL contract/evalset, verification workbench and advisory Track E JSON checks exist. VTE failure intake and partial trace capture do not constitute a complete independent learning/verification system. SPC Player is sequential, advisory and plan-only; JSON download and consented public-HTTPS webhook behavior do not authorize deployment or a certification claim.

# SCAN STAGE 4 — Assurance Assessment

## 4.1 Current decision by layer

| Layer | Finding | Decision |
| --- | --- | --- |
| Published application | A successful new deployment exists; public health is good | LIVE—OBSERVED at baseline only |
| DB reachability | Current readiness and deep health pass | LIVE—OBSERVED; not an audit of all schema/permissions |
| Public Sphinx sales | Catalog explicitly closed | INACTIVE by intentional gate |
| Preparation endpoints | Reachable and anonymous access denied; client includes operations code | DEPLOYED—UNVERIFIED for authenticated completion |
| Full IMPRIMA / SHORT SPRINTS | Required SQL control groups fail based on catalogs | BLOCKED |
| Independent verification / F12 | No genuine production execution evidence established | PENDING / UNVERIFIED |
| Theme control | Present in source; no interactive live verification in this scan | UNVERIFIED live behavior |
| Invariant enforcement | No new invariant-specific live tests were recorded | All 129 retain UNVERIFIED benchmark |

## 4.2 Recorded local validation

The existing preparation release records full workspace typechecking, production builds, regression tests and one signed-in preview pass. That pass exercised IMPRIMA and SC TWO persistence/download, actual file formats, hashes, anonymous rejection, cross-owner rejection and a narrow mobile layout. SC ONE has recorded persisted-service tests rather than that same browser pass.

Ledger test counts differ by checkpoint. This report intentionally does not present those varying historical counts as a single fresh certification or as tests rerun today.

## 4.3 Quality and economics disclosures

No independent JCSE/HIVE/FORGE assessment was conducted. No 50/50 quality score, semantic-preservation percentage, token reduction or monetary saving is asserted. Document completeness is assessed by evidence coverage, not by inheriting a score printed on an SPC card. Token economics requires actual input/output usage and current provider pricing before savings can be computed.

# SCAN STAGE 5 — Drift and Reconciliation

| Drift | Older statement | Current evidence | Required treatment |
| --- | --- | --- | --- |
| Publishing | Prior build failed container creation | New 17 October build succeeded | Do not continue describing the old failure as the current release |
| Workflow schema | Production workflow tables absent on 16 October | Five expected tables now present | Supersede absence claim, retain guard blocker |
| SQL protection | “Tables exist / RLS enabled” could imply safe operation | FORCE false; role and immutability triggers absent | Keep full commands fail-closed |
| Preparation live state | READY_TO_PUBLISH / INACTIVE in historic ledger | Published endpoints now return 401 anonymously | Mark deployed, but authenticated use remains unverified |
| Theme live state | Older ledger said theme not published | Current client changed; interaction not checked | Do not repeat old absence as a current confirmed fact |
| Upgrade detail | 243 prompt rows mostly not started | Coarse operational summaries show later implementation | Reconcile row by row; do not infer 243 completions from one summary |
| GitHub mirror | Old resume marker blocked synchronization | Snapshot repaired and incremental sync succeeded | Use current frozen commit, preserve GitHub history |

The raw ledger is intentionally preserved by this report rather than bulk rewriting statuses without evidence. New report observations supersede only the exact historical statements they contradict.

# SCAN STAGE 6 — Risk and Control Gaps

| Priority | Risk / gap | Consequence | Exit evidence |
| --- | --- | --- | --- |
| P0 | Missing restricted role, FORCE RLS, policies/immutability guards | Governed workflow cannot safely activate | Supported managed production transfer plus exact read-only guard pass |
| P0 | Independent receipts not established | False certification or unsafe stage skip if bypassed | Genuine approved verifier executions bound to source/config hashes |
| P0 | Full F12 provider operations unproven | Unreliable health/traffic/rollback decisions | Real staged rollout and rollback evidence from authorized target |
| P1 | Authenticated new release not observed here | Deployed preparation may fail at persistence/storage/font boundaries | Owner save/reopen/format/download checks in production |
| P1 | Ledger is stale at row level | Misleading “active/inactive” reporting | Dated, scoped evidence per changed invariant/prompt |
| P1 | Marketplace readiness could be confused with public launch | Premature exposure of unqualified/private artifacts | Explicit launch authorization, negative eligibility/ownership checks |
| P1 | Preparation output is mistaken for Final/certified product | False approval or distribution | Preserve DRAFT/proposal labels and releaseAllowed false |
| P2 | Private file writes can outlive interrupted preparation | Orphaned storage growth | Conservative reference-aware recovery with reconciliation evidence |
| P2 | Sessionless report/Player preparation sources deferred | Incomplete source coverage | Owner-scoped lineage and actual UI/backend flow for those sources |
| P2 | Large remote sync tree assembly can time out | Delayed repository handoff | Small verified tree batches; no forced branch rewrite |

Do not fix the SQL blocker by adding a superuser fallback, runtime production DDL, a startup migration runner, empty public policies, or a false “approved” marker. Keep the existing production data intact. Azure setup remains a separate deferred infrastructure upgrade.

# SCAN STAGE 7 — Conformity Decision

**Decision: CONDITIONAL LIMITED-RELEASE BASELINE.**

The application is published and its publicly measurable launch dependencies are responding. The private preparation build is deployed, with authenticated outcomes still requiring production confirmation. Full governed IMPRIMA, full SHORT SPRINTS, independent XVL/VTE completion and F12 operation are not approved as active by this scan. Sphinx public commercial activation remains closed.

The codebase supports a working platform and a deliberately limited preparation release. It does not support the blanket statement “all original upgrade requirements are active.” No certification is granted by this document.

# SCAN STAGE 8 — Release and Monitoring

## 8.1 Immediate operating posture

1. Continue operating the currently published baseline while monitoring readiness and errors.
2. Confirm the authenticated preparation workflows against the published build before changing their live status.
3. Resolve database guard transfer through the supported platform publication/security path; do not mutate production from this report.
4. Connect and exercise genuine independent verifiers and deployment targets.
5. Reconcile the affected invariants and prompt rows using actual observations.
6. Open Sphinx only after explicit launch authorization and qualification/ownership checks.

The 17 October publish has already succeeded; another publish is not needed merely to make this report true. This report adds documentation only and does not change runtime behavior.

## 8.2 Rollback and monitoring boundaries

Public readiness can detect loss of DB reachability or missing provider configuration. It cannot establish successful generation, billing correctness, owner isolation, independent verification or provider health. F12 rollback controls must be tested against real authorized provider evidence before being called operational. Keep rollout approvals, file integrity and customer-data recovery separate from routine documentation updates.

# PART 1 — ATLAS CHEAT SHEET

**Problem:** Product breadth and stale progress labels make it difficult to distinguish an implemented feature from a live, governed capability.

**Solution:** A frozen source/evidence baseline, eight-stage assurance decision, complete navigation map and per-capability activation conditions.

**Top five current capabilities:** Published command platform; database-backed saved artifacts; gated F-process generation; shared Exemplar/Sphinx catalog architecture; private IMPRIMA/SHORT SPRINTS preparation.

**Three business benefits:** Less ambiguity in release decisions; private preparation without false approvals; reuse of qualified library inventory for a future marketplace.

**Production card:** Current state scan / manual living refresh / no independent certification / public baseline observed / full activation conditional.

# PART 2 — EXECUTIVE REQUIREMENTS AND CAPABILITY MATRIX

| Requirement | Priority | Owner discipline | Acceptance boundary |
| --- | --- | --- | --- |
| Keep platform usable with existing database | MUST | ADA / operations | Readiness plus authenticated owner journey |
| Distinguish preparation from protected release | MUST | SPARTAN / ARES | UI/API/manifests never claim Final or deployment |
| Preserve database protections | MUST | ARES / engineering | Exact role/RLS/policy/trigger guard pass |
| Bind verification to actual artifacts | MUST | XVL / CODE DJ | Genuine receipts match immutable source/config bytes |
| Provide current site map | MUST | ATLAS / SKRIBE | Every registered route classified in Addendum A |
| Reuse Exemplar as Sphinx supply | SHOULD | SPHINX | Qualified opt-in only; commerce not silently opened |
| Maintain evidence-backed living statuses | MUST | ATLAS / OSIRIS | Dated, scoped live observations, no inferred enforcement |
| Adopt Azure Key Vault | DEFERRED | Infrastructure | Authorized credentials, rotation and retrieval checks later |

# PART 3 — ATOMIC PROMPT WORKSHEET

These are proposed maintenance/remediation instructions, not completed work or newly scheduled project tasks. Every row has one primary operation, explicit input, output and a prerequisite. IDs are document-local. “None” means no preceding worksheet dependency.

## Phase 1 — Foundation / P0

| ID | One operation | Input → verifiable output | Depends on |
| --- | --- | --- | --- |
| A01 | Freeze the application commit | Git HEAD → immutable commit identifier | None |
| A02 | Enumerate frontend routes | Frozen App.tsx → unique path inventory | A01 |
| A03 | Enumerate API mounts | Frozen router → mount inventory | A01 |
| A04 | Record published build | Deployment metadata → build ID and timestamp | A01 |
| A05 | Probe baseline readiness | Published readiness URL → timestamped response | A04 |
| A06 | Inspect required SQL guards | Approved read-only catalogs → six-group result | A04 |
| A07 | Classify feature evidence | Inventory and observations → status matrix | A02,A03,A05,A06 |
| A08 | Extract activation blockers | Status matrix → scoped blocker register | A07 |
| A09 | Define release boundary | Blockers and source release profile → written boundary | A08 |

## Phase 2 — Control completion / P0

| ID | One operation | Input → verifiable output | Depends on |
| --- | --- | --- | --- |
| A10 | Specify restricted-role transfer | Existing role contract → supported transfer requirements | A09 |
| A11 | Specify forced-RLS transfer | Five-table contract → forced-RLS requirements | A10 |
| A12 | Specify owner-policy transfer | Existing predicate contract → exact policy requirements | A11 |
| A13 | Specify verifier-policy transfer | Authority policy contract → policy requirements | A12 |
| A14 | Specify immutability transfer | Expected trigger bindings → immutable-version requirements | A13 |
| A15 | Validate transferred guards | Authorized supported transfer result → exact read-only pass/fail | A14 |
| A16 | Verify anonymous preparation denial | Published preparation URLs → 401 evidence | A04 |
| A17 | Verify preparation owner isolation | Two authorized test actors → cross-owner denial evidence | A16 |
| A18 | Verify protected command refusal | Failed guard fixture → refusal before writes/spend | A06 |

## Phase 3 — Working feature evidence / P1

| ID | One operation | Input → verifiable output | Depends on |
| --- | --- | --- | --- |
| A19 | Verify IMPRIMA persistence | Authorized owner and safe source → reopened draft | A17 |
| A20 | Verify IMPRIMA HTML | Saved draft → valid source-preserving HTML | A19 |
| A21 | Verify IMPRIMA DOCX | Saved draft → valid source-preserving DOCX | A19 |
| A22 | Verify IMPRIMA Unicode PDF | Saved draft → readable PDF with required glyphs | A19 |
| A23 | Verify IMPRIMA archive integrity | Draft ZIP → byte/hash comparison result | A20,A21,A22 |
| A24 | Verify SC ONE preparation | Qualified owner source → persisted private package | A17 |
| A25 | Verify SC TWO preparation | Qualified owner source → persisted private package | A17 |
| A26 | Verify sprint package bytes | Preparation ZIPs → manifest/hash comparison result | A24,A25 |
| A27 | Verify preparation non-release labels | Preparation output metadata → releaseAllowed false evidence | A23,A26 |

## Phase 4 — Independent operation / P1

| ID | One operation | Input → verifiable output | Depends on |
| --- | --- | --- | --- |
| A28 | Register approved verifier identity | Authorized public-key record → registered authority evidence | A15 |
| A29 | Execute one independent contract check | Approved fixture and verifier → signed execution receipt | A28 |
| A30 | Validate receipt binding | Receipt and immutable source/config → binding verdict | A29 |
| A31 | Validate refusal of mismatched receipt | Controlled mismatch → negative gate evidence | A30 |
| A32 | Qualify an SC source | Trusted lineage and required receipts → qualification verdict | A31 |
| A33 | Record a governed sprint ruling | Qualified source and authorized actor → persisted ruling | A32 |
| A34 | Bind an authorized deployment target | Consent and target configuration → target binding | A33 |
| A35 | Observe a staged provider rollout | Approved disposable release → actual provider status evidence | A34 |
| A36 | Observe a provider rollback | Controlled failed-health scenario → confirmed rollback evidence | A35 |

## Phase 5 — Release and living governance / P2

| ID | One operation | Input → verifiable output | Depends on |
| --- | --- | --- | --- |
| A37 | Verify IMPRIMA Final immutability | Guard-ready workflow fixture → SQL-enforced rejection evidence | A15,A23 |
| A38 | Verify Exemplar eligibility refusal | Unqualified owner artifact → denied marketplace-mode switch | A07 |
| A39 | Verify Exemplar opt-in ownership | Qualified owner copy → scoped supply-mode evidence | A38 |
| A40 | Record marketplace launch decision | Authorized launch ruling → dated explicit open/closed state | A39 |
| A41 | Refresh invariant evidence | Approved live results → scoped invariant amendments | A27,A31,A36,A37 |
| A42 | Reconcile prompt progress | Implemented source plus evidence → row-level progress delta | A41 |
| A43 | Refresh site-map status | Current routes and live observations → revised addendum | A42 |
| A44 | Publish the revised report | Reviewed report → PDF/source/manifest with hashes | A43 |
| A45 | Record the next review trigger | Current build ID and open risks → dated review rule | A44 |

**Dependency policy:** Do not execute blocked downstream operations by replacing evidence with an AI-generated score. Worksheet specification rows A10–A14 do not authorize direct production DDL. Token usage and labor estimates are unmeasured; no savings dashboard is fabricated.

# PART 4 — IMPLEMENTATION AND COORDINATION PLAN

## 4.1 VIBE DJ selection

Retain the current Replit/pnpm/React/Vite/Express/PostgreSQL/OpenAPI stack. Use GitHub for source handoff; use existing tests and read-only production evidence for validation. No replacement framework, database migration, second marketplace catalog or new payment stack is justified by this scan.

Tool-selection criteria are stack fit, safety, maintainability, observable outputs, cost and release speed. No arbitrary tool percentages or invented comparative scores are assigned.

## 4.2 SPC responsibility map

ATLAS: report structure and atomic acceptance; ADA: architecture and contracts; CODE DJ: code integrity/handoff; SPARTAN: limited-release scope; ARES: containment and security boundaries; BUGMXT: defect reproduction; KLARITY/SOCRATES: editorial/review requirements; SKRIBE: readable outputs; OSIRIS: custody/orchestration; SPHINX: qualified catalog supply; STRATEGOS: business priorities.

These are responsibility labels and analyst methods, not evidence that independent agents have executed or certified this report. A named human owner remains responsible for release authorization.

## 4.3 Eight work packages in dependency order

| Package | Focus | Exit condition |
| --- | --- | --- |
| 1 | Freeze/reconcile baseline | Route/evidence manifest reviewed |
| 2 | Preparation production confirmation | Owner persistence, downloads and negative paths observed |
| 3 | Supported SQL protection transfer | Exact six-group guard pass; no bypass |
| 4 | Verifier registration and real execution | Bound signed positive and negative receipts |
| 5 | Governed IMPRIMA and sprint acceptance | Final/ruling behavior and immutability proven |
| 6 | Provider/F12 exercise | Real rollout, health hold and rollback evidence |
| 7 | Catalog qualification and authorized launch | Eligible owner opt-in and explicit public launch decision |
| 8 | Living evidence refresh | Invariants, route status and report agree with observed release |

No calendar duration is promised before platform/security and external-provider dependencies are resolved.

# ADDENDUM A — CURRENT SITE MAP

## A.1 Navigation hierarchy

```text
ATANDA Command Centre
|-- Public access
|   |-- /                       Sign-in / access front door
|   |-- /verify                 Artifact verification
|   |-- /test-your-agent        Acquisition assessment
|   |-- /calculate-your-savings Acquisition calculator
|   |-- /status                 Recovery / dependency status
|   `-- /sphinx                 Marketplace shell (public catalog CLOSED)
|-- Authenticated workspace
|   |-- /command                Command Deck
|   |-- /sessions               Saved sessions
|   |-- /session/new            New production session
|   |-- /session/:id            F-process workspace and side-steps
|   |-- /session/:sessionId/verification  XVL / sprint preflight
|   |-- /ingest                 Document intake
|   |-- /cartridge              Cartridge intake
|   |-- /f0                     Service work
|   |-- /operations             IMPRIMA / SHORT SPRINTS
|   |-- /exemplars              Private library / qualified supply mode
|   |-- /exemplars/:id          Artifact detail
|   |-- /spc-player             Player runs
|   |-- /spc-player/new         Run setup
|   |-- /spc-player/:id         Advisory run detail
|   |-- /f10                    Release connector console
|   |-- /prompts                Prompt library
|   |-- /quests                 Quests
|   |-- /ascension              Progression
|   |-- /guide                  Platform guide
|   |-- /account                Account / available plan controls
|   |-- /me/activity            Personal activity
|   `-- /me/costs               Personal cost view
`-- Authorized administration
    |-- /admin/badges           Badge administration
    |-- /admin/ops              Operations administration
    `-- /admin/provider-billing Provider reconciliation
```

The map covers all 31 unique registered route paths, including root. Unknown paths use the not-found component. F-stages are embedded views, not invented standalone URLs. Public-route access does not grant authenticated capabilities. The root redirects to `/command` only for an authenticated session.

## A.2 Route-by-route status

| Path | Access | Status and pending work |
| --- | --- | --- |
| `/` | Public / authenticated redirect | LIVE shell observed; sign-in completion not tested here |
| `/verify` | Public | Implemented; actual certificate lookup/decision unverified in this scan |
| `/test-your-agent` | Public | Implemented; assessment result unverified live |
| `/calculate-your-savings` | Public | Implemented; estimate must not be treated as realized savings |
| `/status` | Public recovery | LIVE health APIs observed; status UI rendered separately, no all-feature guarantee |
| `/sphinx` | Public | LIVE shell and closed catalog observed; public commercial listings INACTIVE |
| `/command` | Authenticated | Implemented; owner session navigation unverified live |
| `/guide` | Authenticated | Implemented guide; latest feature coverage requires editorial maintenance |
| `/sessions` | Authenticated | Implemented; production list/create/reopen unverified |
| `/session/new` | Authenticated | Implemented; generation constrained by tier, budget and provider |
| `/ingest` | Authenticated | Implemented; uploaded-input journey unverified |
| `/cartridge` | Authenticated | Implemented; cartridge-to-session journey unverified |
| `/f0` | Authenticated | Implemented; service workflows unverified live |
| `/session/:sessionId/verification` | Authenticated owner | Advisory verification/preflight implemented; full independent verification PENDING |
| `/session/:id` | Authenticated owner | F-process implemented; no blanket live engine certification |
| `/prompts` | Authenticated | Implemented prompt library; live owner data flow unverified |
| `/quests` | Authenticated | Implemented progression surface; live outcomes unverified |
| `/ascension` | Authenticated | Implemented progression surface; live outcomes unverified |
| `/account` | Authenticated | Implemented account controls; billing depends on feature flags/configuration |
| `/admin/badges` | Authorized admin | Implemented; admin mutations not exercised |
| `/admin/ops` | Authorized admin | Implemented; cron/alerts and admin actions require separate operational evidence |
| `/admin/provider-billing` | Authorized admin | Implemented reconciliation; no live financial import performed |
| `/me/activity` | Authenticated owner | Implemented; personal history unverified live |
| `/me/costs` | Authenticated owner | Implemented; actual ledger/provider reconciliation unverified here |
| `/exemplars` | Authenticated | Shared catalog implementation; no public launch inferred |
| `/exemplars/:id` | Authenticated owner | Detail/qualification/supply controls implemented; owner switching unverified live |
| `/spc-player` | Authenticated | Advisory runtime implemented; not autonomous release authority |
| `/spc-player/new` | Authenticated | Ordered kit/run configuration implemented; live creation unverified |
| `/spc-player/:id` | Authenticated owner | Advisory output/delivery paths; external delivery unverified |
| `/operations` | Authenticated owner | Preparation APIs deployed; owner completion UNVERIFIED; full lane BLOCKED |
| `/f10` | Authenticated / target gates | Release connector implementation; genuine custody/target evidence required |

## A.3 Embedded operation map

| Embedded capability | Current state | What is pending |
| --- | --- | --- |
| Light / dark mode | Source implemented | Interactive production visibility/persistence check |
| ATLAS 360 PLAN / SCAN | F6/F7 document views | Per-source generation and saved-lineage confirmation live |
| IMPRIMA preparation | Deployed private endpoint, anonymous 401 | Authenticated production persistence/download confirmation |
| IMPRIMA full / Final | BLOCKED | SQL protection + review/approval acceptance |
| SC ONE / SC TWO preparation | Deployed private endpoint, anonymous 401 | Production owner package/hash confirmation |
| SHORT SPRINTS YES / skipping | BLOCKED / conditional | Guard-ready workflow, source qualification and genuine receipts |
| Independent XVL/VTE | PARTIAL | Full independent tracks, durable enforcement and learning-loop evidence |
| Full F12 | NOT APPROVED ACTIVE | Real provider rollout/health/rollback/promotion proof |
| Public Sphinx supply | CLOSED | Qualification, opt-in, explicit authorized launch |
| Azure Key Vault | DEFERRED | Provisioning, credentials, least privilege, rotation and retrieval tests |

# ADDENDUM B — CURRENT ACTIVATION REGISTER

The source invariant ledger contains **129 invariants**, all with `liveActivity: UNVERIFIED`. It also contains **243 prompt rows**: **231 NOT_STARTED** and **12 PARTIAL**, plus one partial supplemental prompt. These are ledger states, not freshly measured completion percentages.

Current production probes justify ACTIVE only for the specific public readiness/auth-anonymous/catalog observations in Stage 1. They do not justify marking all related invariant rows active or enforced. Some NOT_STARTED rows are evidently stale relative to later aggregate implementation notes; resolve the exact mapping before changing them.

| Area | Local status | Live benchmark | Reason / next evidence |
| --- | --- | --- | --- |
| Baseline app and DB probe | Implemented | LIVE—OBSERVED | Successful publish + health/readiness |
| Existing authenticated platform | Implemented | UNVERIFIED by this scan | No authenticated journey performed here |
| Private preparation | Recorded preview verified | DEPLOYED—UNVERIFIED | Endpoints deployed; owner completion still needs observation |
| Full governed operations | Recorded local lifecycle evidence | BLOCKED | Restricted role/FORCE/policy/trigger requirements not met |
| Independent verifier operation | Partial implementation/protocol | UNVERIFIED / PENDING | No genuine current production execution receipts |
| F12 operation | Implemented workflow scaffolding/controls | UNVERIFIED / NOT APPROVED ACTIVE | No real provider rollout/rollback exercised |
| Sphinx public launch | Gated implementation | INACTIVE / CLOSED | Explicit publicOpen false |
| Azure Key Vault | Deferred requirement | DEFERRED | No activation evidence; not MVP blocker |

The activity ledger’s rule remains authoritative: ACTIVE requires published evidence, INACTIVE requires absence or explicit disablement, and unchecked capabilities stay UNVERIFIED. “Enforced” additionally requires the specified I1+ passing test recorded in XVL; no such enforcement upgrade is made here.

# ADDENDUM C — LIVING PDD MAINTENANCE CONTRACT

## C.1 Refresh triggers

Refresh after a publish, schema/security transfer, verifier/provider connection change, marketplace launch decision, material route change, or an incident that invalidates an earlier observation. Review open blockers before claiming a broader release.

## C.2 Update procedure

1. Freeze a new application commit and deployment ID.
2. Recollect public probes and approved read-only SQL guard observations.
3. Obtain scoped authenticated evidence where required; never extrapolate from a SPA HTTP 200.
4. Amend only statuses supported by the new evidence; keep dated previous observations.
5. Update this Markdown source and the renderer’s frozen observations.
6. Run `node scripts/src/build-living-scan-report.mjs`.
7. Check the generated PDF, manifest, route inventory and content hashes.
8. Distribute the new report with its source and evidence manifest.

The generator does not monitor continuously, sign an independent certificate, call models, change production records, or publish the application. “Living” means maintainable source plus explicit evidence-refresh rules, not an invented always-on monitoring service.

## C.3 Integrity and delivery

Editable source: this Markdown file. Build script: `scripts/src/build-living-scan-report.mjs`. Generated PDF and evidence manifest: `generated-artifacts/atlas-360-scan/`. Generated outputs are excluded from Git and application deployment; source and maintenance instructions remain in the repository.

**Final release statement:** The current platform is published and publicly healthy at the measured baseline. Full IMPRIMA, full SHORT SPRINTS, independent XVL/VTE enforcement, F12 operation and public Sphinx commerce retain their individual gates. No gate was bypassed to prepare this report.
