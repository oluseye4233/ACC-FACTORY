# ATLAS 360 SCAN — Living PDD
## ATANDA Command Centre / ACC-FACTORY

**Evidence date:** 17 October 2026, late update. Current public/catalog observations were collected on **18 October 2026 at 03:14–03:17 UTC**, equivalent to **17 October, 22:14–22:17 CDT (America/Chicago)**. The earlier 14:52–14:57 UTC scan remains a historical comparison, not fresh evidence.
**Document class:** Repository-grounded current-state assurance PDD, with a living maintenance protocol.
**Code freeze:** `fd0d76b044a1ab3362571074cbcebe6f3ade60aa`; the companion manifest also hashes current report and source files.
**GitHub:** `oluseye4233/ACC-FACTORY`, main; this refresh identifies the local application baseline without claiming a fresh remote reconciliation.
**Published target:** https://command-center.atanda.ai
**Audience:** Product owner, operators, engineering, release governance.
**Assurance boundary:** This report is not independent XVL verification, FORGE certification, a penetration test, a compliance attestation, or proof of every authenticated workflow.

## Reading guide and status legend

The report preserves the eight ATLAS 360 SCAN stages used by the platform. The four ATLAS document parts follow those stages. Addendum A is the current site map; Addendum B is the activation register; Addendum C defines living-document maintenance; Addendum D records the cohort pilot, Boomerang and immediate publication boundary.

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
| Production catalogs | Fresh read-only `pg_class`, `pg_policy`, `pg_roles`, `pg_trigger` inspection | Five protected workflow tables and eight learning tables present; controls assessed separately |
| Production deployment | Deployment service: deployed, successful build, public, autoscale | Current build ID/completion timestamp not returned; no old build ID reused |
| Live client asset | `/assets/index-BuxqFEIP.js` | SHA-256 `0a8f647b295d334ace54ac59731eac46bb1454617a08a5479fae8dd19a71052b` |
| Cohort implementation | Learning API/curriculum/access/service, learning schema and pilot guide | Free invite-only programme, scoped roles, funding, assessment and portfolio |
| Boomerang implementation | Boomerang API and origin/state-transition library | Exact F-stage review coverage, with freshness and ownership checks |
| Registration fix | `learning-entry.ts` and regression tests | Authenticated entry redirects with invitation preservation |
| Collected evidence | `docs/atlas-360-scan-evidence-2026-10-17.json` | Dated public/catalog facts and historical verification, with limitations |

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
| `GET /api/learn` | HTTP 401 Unauthorized | Learning endpoint deployed; not evidence of an admitted student |
| `GET /api/boomerang/cases` | HTTP 401 Unauthorized | Protected endpoint deployed; no case mutation tested |
| `/learn-register` | HTTP 200 and visible browser-rendered registration form | LIVE—OBSERVED for signed-out entry only; account creation not submitted |
| Live client markers | Cohort/Boomerang markers present; entry-redirect patch marker absent | Deployment inventory only, not authenticated feature acceptance |

The earlier root/status/Sphinx/operations shell probes are historical, not fresh authenticated observations. The current session endpoint remains `/api/auth/session`.

## 1.3 SQL guard observations

All five expected tables now exist: `imprima_jobs`, `imprima_files`, `short_sprint_runs`, `artifact_operation_events`, and `sprint_verifier_authorities`.

For each table, RLS is enabled but **FORCE RLS is false**. Each has **zero policies containing both USING and WITH CHECK predicates** in the observed catalog. The required `atanda_artifact_operations` role is absent. No non-internal IMPRIMA immutability triggers were returned for `imprima_jobs` or `imprima_files`.

These guard findings were rechecked at 03:15 UTC on 18 October. All five tables also returned zero non-internal triggers in this catalog observation.

All eight learning tables are present: `learning_cohorts`, `learning_memberships`, `learning_invitations`, `learning_assignments`, `learning_submissions`, `learning_reviews`, `learning_audit` and `learning_charges`. RLS is disabled on those tables. Cohort isolation therefore relies on application authorization; this is not a database-level multi-tenant isolation attestation. The catalog replica's connection identity must not be mistaken for the application's runtime role.

**Conclusion:** The cohort schema is deployed, but protected full-workflow SQL controls remain incomplete. Table presence or RLS enabled alone is insufficient. No production application data or schema was modified for this report.

## 1.4 Evidence limits

No new authenticated production enrollment, case adoption, create/save/reopen/download journey, model execution, checkout, independent verifier receipt, provider deployment, rollback, or destructive security test was performed. No customer records or secrets are reproduced. The public registration form was visually observed, not inferred from HTTP 200 alone. Previously recorded preview tests remain historical evidence, not tests rerun during this refresh.

# SCAN STAGE 2 — Baseline and Scope

## 2.1 Product baseline

ATANDA Command Centre is a PromptWare production and operations platform. A React/Vite client, Express API, shared OpenAPI-generated clients/schemas, PostgreSQL persistence and private object storage support a gated F-process, document generation, artifact libraries, advisory execution and release handoffs.

The platform is not a single all-features-enabled release. It combines established engine surfaces, recently deployed preparation functionality, and deliberately closed governed operations.

## 2.2 Architectural map

```text
Visitor / subscriber / authorized operator
  -> React/Vite Command Centre
     -> public acquisition, verification, status, Sphinx shell, student identity entry
     -> authenticated command, sessions, library, Boomerang, operations, administration
     -> scoped student learning and assigned instructor cohort review
  -> Express API /api
     -> identity + owner checks + tier/feature gates + cost controls
     -> HARNESS engines and generated API contracts
     -> PostgreSQL records + private immutable file bytes
     -> optional provider/verifier/export connections
  -> guarded release boundary
     -> independent receipts / custody / authorized target / health evidence
```

Individual students now use verified Clerk identities alongside the unchanged shared staff-session entrance. Students must not receive the shared staff code: that entrance provides administrator privileges. Education access is a separate bounded capability, not paid-tier elevation. This report changes neither authentication nor secrets. Azure Key Vault adoption remains deferred, not silently replaced with a claim of Azure compliance.

## 2.3 In-scope capabilities

Public entry and recovery, F0–F9 engine surfaces and side-steps, F10 release connectors, F11 hosting handoff, F12 staged-operation implementation, Exemplar/Sphinx catalog supply, SPC Player, IMPRIMA, SHORT SPRINTS, Boomerang, FORGE FIELD ENGINEER, admin/cost/billing surfaces, and the upgrade invariant register.

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

## 3.6 Boomerang across the F-process

The owner-scoped case workflow supports exact origin labels F0, F1–F9, F9.5, F10–F12, F6-VDJ and MM. F0 cases bind to owned advisory engagements; other supported stages bind to owned sessions. Return, review and acceptance use source snapshots and freshness checks. Acceptance is reviewed supporting input, not an execution, certification, deploy or release verdict.

The `/boomerang` workspace and deployed API are present. Anonymous case reads return 401. No fresh production create/return/accept/adopt journey was performed, so full live behavior remains DEPLOYED—UNVERIFIED. A stage label does not activate the underlying protected gate.

## 3.7 FORGE FIELD ENGINEER

The free, invite-only programme supports Architect, Engineer and combined tracks with 31 worked lessons based on Guide and Ascension. It provides named expiring invitations, verified primary-email matching, explicit free terms, cohort/membership controls, source-bound submissions, assigned teaching review, feedback history, progress and portfolio JSON export.

Funding is programme-provided: cohort and student allowances cover the cohort lifetime; company-level limits still apply. Completed charges and held reservations are distinct. Unfinalised training reservations remain held after timeout until settlement or confirmed release; uncertain calls need operator reconciliation.

Existing Quest eligibility is unchanged. Course assessment does not award or withhold existing credentials. Actual qualifying owned platform artifacts retain normal eligibility. F9–F12 course exercises are simulations/tabletops, not real custody, verification or deployment evidence. Students have no administrator, company-spend or protected release permissions.

The public registration form is LIVE—OBSERVED and the eight learning tables are deployed. Cohort joining, teaching and funded inference remain unverified in production. Recorded preview testing supports the student journey, not a live-pilot completion claim.

## 3.8 Registration link and QR boundary

The shared destination is https://command-center.atanda.ai/learn-register. PNG and print-ready SVG QR files encode that same URL; neither embeds a private invitation token nor admits anyone automatically.

A routing defect allowed an existing staff session to fall through to 404 on that public identity-entry URL. The local fix sends authenticated staff and students to `/learn`, retaining the invitation token without accepting arbitrary external redirect parameters. Thirteen focused regressions and frontend typechecking passed at that delivery checkpoint.

The observed published client still matches the pre-fix asset. The routing patch remains **REPUBLISH REQUIRED**, followed by a signed-in staff/student link check. Signed-out registration works now; a private browser is the temporary workaround for staff inspecting that public entry.

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
| FORGE FIELD ENGINEER entry | Visible public registration plus learning schema | LIVE—OBSERVED for entry; admitted student workflow DEPLOYED—UNVERIFIED |
| Signed-in registration link | Local repair; published client still pre-fix | IMPLEMENTED—LOCAL VERIFIED / REPUBLISH REQUIRED |
| Boomerang whole-F review | Stage-aware implementation and deployed protected API | DEPLOYED—UNVERIFIED for authenticated acceptance/adoption |
| Learning data isolation | Application role/ownership checks; learning-table RLS disabled | Preview evidence recorded; no independent production isolation audit |

## 4.2 Recorded local validation

The existing preparation release records full workspace typechecking, production builds, regression tests and one signed-in preview pass. That pass exercised IMPRIMA and SC TWO persistence/download, actual file formats, hashes, anonymous rejection, cross-owner rejection and a narrow mobile layout. SC ONE has recorded persisted-service tests rather than that same browser pass.

The later cohort delivery recorded 612 API tests, 206 frontend tests and 32 script tests passing: **850 passed, 40 existing skips**, with workspace typechecking and production builds passing. The preview journey exercised individual sign-in, explicit free invitation acceptance, orientation submission, instructor review, persisted feedback and portfolio download; student administrator/protected F9 attempts were refused.

The subsequent registration-routing repair recorded **13 focused regressions** and frontend typechecking. These are separate dated checkpoints, not a freshly executed combined suite. This documentation refresh did not rerun application tests or perform authenticated production acceptance.

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
| Source baseline | Earlier freeze `ad265f...`, 31 routes | Current freeze `fd0d76...`, 36 registered patterns | Update hashes/map; do not reuse the old deployment ID |
| Cohort availability | Absent from earlier scan | Public form rendered; eight learning tables present | Record entry/schema evidence, not full enrollment acceptance |
| Registration 404 | Signed-out worked, signed-in staff path failed | Local repair; published client still pre-fix | Republish and check both states; retain the same QR |
| Boomerang scope | Absent from earlier site map | Whole-F review mapping implemented | Record review boundary, not automatic execution authority |

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
| P1 | Signed-in registration repair not published | Owners inspecting the QR/link may see 404 | Changed published asset and signed-in navigation confirmation |
| P1 | Cohort admission/review/funding untested live | Entry form mistaken for an accepted pilot | Controlled named invite, terms, submission/review/export and isolation evidence |
| P1 | Learning tables lack database RLS | Privacy depends on API authorization and runtime controls | Production role/ownership review and scoped negative checks; no SQL isolation claim |
| P1 | Course completion confused with Quest/release authority | False badge or deployment claims | Preserve Quest predicates and F9–F12 simulation labels |
| P2 | Boomerang acceptance confused with execution | Reviewed input mistaken for stage approval | Fresh source-bound adoption plus normal downstream gates |

Do not fix the SQL blocker by adding a superuser fallback, runtime production DDL, a startup migration runner, empty public policies, or a false “approved” marker. Keep the existing production data intact. Azure setup remains a separate deferred infrastructure upgrade.

# SCAN STAGE 7 — Conformity Decision

**Decision: CONDITIONAL LIMITED-RELEASE BASELINE.**

The application is published and its publicly measurable launch dependencies respond. Private preparation, cohort schema and cohort/Boomerang API surfaces are deployed, but authenticated outcomes still need production confirmation. FORGE FIELD ENGINEER registration renders live. The signed-in registration repair needs republishing. Full governed IMPRIMA, full SHORT SPRINTS, independent XVL/VTE completion and F12 operation are not approved active. Sphinx public commerce remains closed.

The codebase supports a working platform and a deliberately limited preparation release. It does not support the blanket statement “all original upgrade requirements are active.” No certification is granted by this document.

# SCAN STAGE 8 — Release and Monitoring

## 8.1 Immediate operating posture

1. Continue operating the currently published baseline while monitoring readiness and errors.
2. Confirm the authenticated preparation workflows against the published build before changing their live status.
3. Resolve database guard transfer through the supported platform publication/security path; do not mutate production from this report.
4. Connect and exercise genuine independent verifiers and deployment targets.
5. Reconcile the affected invariants and prompt rows using actual observations.
6. Open Sphinx only after explicit launch authorization and qualification/ownership checks.
7. Republish the registration-entry fix; confirm the shared URL signed out, signed in as a student and signed in as staff.
8. Run a controlled cohort pilot before broad invitation distribution; retain free terms, funding limits, role isolation and unchanged Quest rules.
9. Confirm one fresh-source Boomerang review/adoption journey without unlocking its protected destination gate.

This refresh changes documentation and its renderer only. It does not publish the app, send invitations, create learners, call models or modify production records. The earlier application publish succeeded, but the later registration-routing repair still needs publication and scoped live confirmation.

## 8.2 Rollback and monitoring boundaries

Public readiness can detect loss of DB reachability or missing provider configuration. It cannot establish successful generation, billing correctness, owner isolation, independent verification or provider health. F12 rollback controls must be tested against real authorized provider evidence before being called operational. Keep rollout approvals, file integrity and customer-data recovery separate from routine documentation updates.

# PART 1 — ATLAS CHEAT SHEET

**Problem:** Product breadth and stale progress labels make it difficult to distinguish an implemented feature from a live, governed capability.

**Solution:** A frozen source/evidence baseline, eight-stage assurance decision, complete navigation map and per-capability activation conditions.

**Current capability groups:** Published command platform and saved artifacts; gated F-process generation; shared Exemplar/Sphinx supply; private IMPRIMA/SHORT SPRINTS preparation; source-bound Boomerang review; free invite-only FORGE FIELD ENGINEER training.

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
| Deliver free invite-only training | MUST | ATLAS / course owner | Verified identity, explicit admission, funded limits and scoped review |
| Preserve existing Quest rules | MUST | Quest governance | No new badge prerequisites or automatic course awards |
| Support enrollment links in every session state | MUST | BUGMXT / engineering | Signed-out entry and safe authenticated redirect, preserving invitation |
| Extend Boomerang without bypassing gates | MUST | OSIRIS / engineering | Fresh owner-bound reviewed input, no automatic release authority |

# PART 3 — ATOMIC PROMPT WORKSHEET

These are proposed maintenance/remediation instructions, not completed work or newly scheduled project tasks. Every row has one primary operation, explicit input, output and a prerequisite. IDs are document-local. “None” means no preceding worksheet dependency.

## Phase 1 — Foundation / P0

| ID | One operation | Input → verifiable output | Depends on |
| --- | --- | --- | --- |
| A01 | Freeze the application commit | Git HEAD → immutable commit identifier | None |
| A02 | Enumerate frontend routes | Frozen App.tsx → unique path inventory | A01 |
| A03 | Enumerate API mounts | Frozen router → mount inventory | A01 |
| A04 | Record published release | Deployment metadata/client → available build ID or dated client SHA-256, with unknown fields explicit | A01 |
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
| A16 | Verify anonymous API denial | Preparation/learning/Boomerang URLs → 401 evidence | A04 |
| A17 | Verify owner isolation | Two authorized actors and scoped IDs → cross-owner denial evidence | A16 |
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
|   |-- /learn-login            Individual student sign-in
|   |-- /learn-register         Free registration / shared QR destination
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
|   |-- /boomerang              Owner-scoped whole-F review cases
|   |-- /learn                  Learning / authorized cohort management
|   |-- /teach/cohorts/:id      Owner / assigned instructor review
|   |-- /account                Account / available plan controls
|   |-- /me/activity            Personal activity
|   `-- /me/costs               Personal cost view
`-- Authorized administration
    |-- /admin/badges           Badge administration
    |-- /admin/ops              Operations administration
    `-- /admin/provider-billing Provider reconciliation
```

The map covers all **36 unique registered route patterns**, including root. Identity entry uses `/learn-login/*?` and `/learn-register/*?` for nested callbacks; the tree shows their shorter entry URLs. Unknown paths use not-found. F-stages are embedded views, not invented standalone URLs. Public entry grants no cohort admission or platform capabilities. Staff root access redirects to `/command`; student root access redirects to `/learn`.

This is the platform inventory, not an unrestricted student menu. Student capabilities are allowlisted and funded only under an owned active membership. Assigned instructors see cohort-submitted work, not unrelated private library content.

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
| `/boomerang` | Authenticated owner | Whole-F reviewed input; anonymous API denied; live create/adopt unverified |
| `/learn` | Verified individual / authorized staff | API/schema deployed; preview journey passed; live admission/review unverified |
| `/teach/cohorts/:id` | Owner / assigned instructor | Scoped review; no unrelated private library access granted |
| `/learn-login/*?` | Public identity entry | Sign-in/callbacks; authenticated-entry repair needs publishing |
| `/learn-register/*?` | Public identity entry | LIVE signed-out registration and QR destination; authenticated-entry repair pending |
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
| FORGE FIELD ENGINEER | Free invite-only source implementation; public form live | Controlled live join/review/export and funded-call checks |
| Guide / Ascension curriculum | 31 worked lessons; track-scoped assessment | Production progression; existing Quest rules remain authoritative |
| F9–F12 training | SIMULATION / tabletop only | Never treat assessment as real custody/verifier/provider evidence |
| Shared QR/link | Existing registration URL remains correct | Republish signed-in redirect; no QR regeneration needed |
| Boomerang whole-F cases | Owner/source-bound reviewed input | Live freshness/adoption evidence without gate bypass |

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
| FORGE FIELD ENGINEER entry | Recorded preview evidence | LIVE—OBSERVED for signed-out form only | Form rendered and learning tables present; no new live signup submitted |
| Cohort admission/review/funding | Preview journey and access/funding checks | DEPLOYED—UNVERIFIED | Controlled production pilot needed |
| Signed-in registration repair | 13 regressions and typecheck passed | REPUBLISH REQUIRED | Observed published client matches pre-fix snapshot |
| Boomerang review/adoption | Whole-F ownership/freshness controls | DEPLOYED—UNVERIFIED | Anonymous refusal observed; no authenticated mutation performed |

The activity ledger’s rule remains authoritative: ACTIVE requires published evidence, INACTIVE requires absence or explicit disablement, and unchecked capabilities stay UNVERIFIED. “Enforced” additionally requires the specified I1+ passing test recorded in XVL; no such enforcement upgrade is made here.

# ADDENDUM C — LIVING PDD MAINTENANCE CONTRACT

## C.1 Refresh triggers

Refresh after a publish, schema/security transfer, verifier/provider connection change, marketplace launch decision, material route change, or an incident that invalidates an earlier observation. Review open blockers before claiming a broader release.

## C.2 Update procedure

1. Freeze a new application commit and published release identity; use the dated client SHA-256 if current build ID metadata is unavailable.
2. Recollect public probes and approved read-only SQL guard observations.
3. Obtain scoped authenticated evidence where required; never extrapolate from a SPA HTTP 200.
4. Amend only statuses supported by the new evidence; keep dated previous observations.
5. Update this Markdown and the separate dated evidence-input JSON; rendering time must not imply new observations.
6. Run `node scripts/src/build-living-scan-report.mjs`.
7. Check the generated PDF, manifest, route inventory and content hashes.
8. Distribute the new report with its source and evidence manifest.

The generator does not monitor continuously, sign an independent certificate, call models, change production records, or publish the application. “Living” means maintainable source plus explicit evidence-refresh rules, not an invented always-on monitoring service.

## C.3 Integrity and delivery

Editable source: this Markdown. Frozen observations: `docs/atlas-360-scan-evidence-2026-10-17.json`. Renderer: `scripts/src/build-living-scan-report.mjs`. Generated PDF/manifest: `generated-artifacts/atlas-360-scan/`. Generated files remain excluded from Git/deployment; source and maintenance instructions remain in the repository.

**Final release statement:** The current platform is published and publicly healthy at the measured baseline. Full IMPRIMA, full SHORT SPRINTS, independent XVL/VTE enforcement, F12 operation and public Sphinx commerce retain their individual gates. No gate was bypassed to prepare this report.

# ADDENDUM D — RELEASE DELTA AND PILOT ACCEPTANCE

## D.1 Changes since the earlier scan

| Change | Verified evidence | Not established |
| --- | --- | --- |
| FORGE FIELD ENGINEER | 31-lesson source; preview enrollment/review/export; live form and eight production learning tables | Authenticated live admission, funded generation or course completion |
| Individual identities | Student identity implementation alongside unchanged staff access | No new production student account created during this scan |
| Shared link / QR | Both target live `/learn-register`; signed-out form rendered | Signed-in routing repair still needs publishing |
| Boomerang whole-F integration | Exact stage registry, ownership/freshness controls and deployed protected API | No production case created, accepted or adopted here |
| Quest conformity | Course assessment remains separate from ordinary eligibility | No credential or badge awarded by this report |
| Evidence maintenance | Separate collected-data input, source hashes and generated manifest | PDF rendering is not continuous monitoring or a new observation |

## D.2 Invite-only cohort operating sequence

1. Publish the existing entry repair; verify the changed release and every session-state route.
2. Open Training as an authorized owner; create a cohort with explicit capacity, lifetime funding, student allowance and expiry.
3. Activate the cohort and issue named invitations. Copy/send each private link manually; automatic invitation email is not claimed.
4. Students register with their own verified identity and explicitly accept free terms. The public QR cannot redeem a named invitation.
5. Confirm one student's orientation submission, instructor review, feedback after reload and private portfolio export on the published build.
6. Check cross-owner denial, student refusal of protected/admin actions and funded-call limits using controlled authorized fixtures.
7. Continue normal owned F-process work for real qualifying artifacts. Keep F9–F12 simulations labeled and preserve existing Quest predicates.

## D.3 Acceptance boundaries

Accept the pilot only against its scoped evidence. Enrollment, course review, Boomerang acceptance and public HTTP probes cannot make protected IMPRIMA, SHORT SPRINTS, XVL/VTE, F12 or Sphinx commerce active. Do not bulk promote 129 invariant rows from UNVERIFIED.

The immediate publication item is the shared authenticated registration redirect. Broader rollout still needs controlled production cohort and Boomerang evidence. Production application records, paid plans, secrets and protected-gate settings were not changed by this refresh.
