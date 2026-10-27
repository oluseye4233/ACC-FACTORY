# ATANDA Command Centre — ATLAS 360 SCAN Living PDD

Edition: 27 October 2026. Project: ATANDA Command Centre / ACC-FACTORY.

An evidence-grounded update to the living SCAN PDD, incorporating the latest development changes, public readiness observations and remaining gates. This edition supersedes earlier current-state descriptions only where fresh evidence is stated; historical reports remain historical evidence.

## Document control and evidence limits

This is an analyst-authored PDD using the ATLAS structure. No independent ATLAS, HIVE, FORGE, MATHMON, JCSE, XVL or VTE certification run was performed to produce it. No certification score, whole-platform completion percentage, commercial result or runtime activation is inferred from document generation.

The accompanying evidence manifest records generation time, anonymous public probes, deployment metadata supplied from the deployment service, selected source hashes and the workspace revision. These identify the reviewed working tree; they do not prove exact production-code parity. The PDF and Markdown are documentation, not release authorization.

| Evidence label | Meaning |
| --- | --- |
| PUBLIC OBSERVED | A dated anonymous endpoint response was obtained; its scope is only that response. |
| SOURCE PRESENT | An implementation or contract is present in the reviewed source; production execution is not established. |
| LOCAL VERIFIED | Scoped development tests, build or browser evidence support the specified behavior. |
| SPECIFIED | A policy or target architecture is recorded, but its runtime enforcement has not been established. |
| CONDITIONAL | Required configuration, authorization, source qualification or external evidence must still be satisfied. |
| DEFERRED / INCOMPLETE | Deliberately postponed work or an explicitly unfinished capability. |
| UNVERIFIED | There is insufficient current evidence to assert activation or inactivity. |

# PART 1 — Cheat Sheet

## Product and atomic solution summary

ATANDA is the corporate identity; ARK Harness is the governed specification-driven AI design lifecycle product operated through Command Centre. The platform helps an authorized user turn a brief or existing source into staged specifications, reviewable artifacts and a code scaffold. Supporting remediation returns work for review rather than granting automatic approval.

The current architecture remains a pnpm workspace with a React/Vite frontend, Express API, PostgreSQL/Drizzle persistence, generated OpenAPI clients, bounded provider operations, operational scripts and platform-specific handoff seams. This report does not replace the existing database, authentication or deployment architecture.

## Current changes at a glance

| Area | Current reading | Important limit |
| --- | --- | --- |
| ATANDA landing page | SNAP narrative and corporate identity implemented; desktop/mobile preview, marketing tests, type checks and frontend build passed. | Do not infer that the exact reviewed frontend revision is live from a healthy API response. |
| F4 | Platform-neutral specification direction; early TARGET VIBE restriction removed in the preceding conversion update. | Implementation choices belong downstream; this does not remove later safety gates. |
| F5 SCAN | Website, GitHub and local-server link intake implemented, with retained evidence and coverage status. | Public HTTPS retrieval is bounded; a repository page is not a full repository audit. |
| F6 | Drafting accepts owned, same-session F5 SPC or F5 SCAN sources. | Fresh briefs, other stages and legacy F6 SCAN sources do not qualify as new F6 draft inputs. |
| F8 CODE ONE + | Conversion guidance, VIBE/HOST recommendations and target-planning preferences integrated into F8. | This is not evidence of every independent CODE ONE + sub-agent or destination compiler running. |
| Artifact titles | ART-TITLE-001 requires every new project artifact title to start with the project name. | Specified policy; automatic enforcement across all creation paths is still pending. |
| Platform health | Health returns 200; readiness changed from 200 to 503 with database unavailable during this refresh. | The latest frozen readiness failure requires investigation; process health is not database readiness. |
| Full API regression | Latest recorded run: 866 passed, 10 failed, 40 skipped across 916 cases; 99 files passed and 2 failed. | The suite is not green; full-workspace tests did not complete successfully. |

## Five practical benefits

- Keep source context associated with the project instead of relying on generic artifact labels.
- Move from a valid F5 source into an F6 PDD without silently substituting a fresh brief.
- Expose evidence limitations before treating a SCAN as an assurance conclusion.
- Return weak work through a reviewable remediation loop with retained lineage.
- Distinguish usable internal preparation from independently governed approval and release.

## Production card

| Field | Current position |
| --- | --- |
| Intended users | Authorized subscribers, staff, invited FORGE learners and scoped cohort conveners. |
| Entry options | New Session; Ingestion; Cartridge with retained Exemplar references. |
| Main output chain | Brief / source → staged specifications → SPC or SCAN → ATLAS PDD → reviewed MVP PDD / code scaffold. |
| Commercial posture | Existing access and subscription configuration retained; no billing activation performed for this report. |
| Quality economics | No measured token saving, ROI, adoption or certification improvement is claimed. |
| Release position | Maintain the limited, governed operating boundary; do not announce all-feature readiness. |

# PART 2 — Executive Summary and Eight-stage SCAN

## Executive summary

The strongest current evidence concerns implementation, development checks and preserved source restrictions. The published process responds, but the latest frozen readiness probe reports database unavailable. This new operational finding takes priority over the earlier successful readiness response. Other unresolved areas are complete regression coverage after prompt changes, independent evaluation, protected workflow acceptance, destination-specific operational evidence and full F12 control.

Two different database protection layers must not be conflated. The latest surfaced deployment startup logs report PASS for the ARK app login, forced RLS on the expected imprima and short_sprints schema tables, immutability triggers, forbidden-grant checks, migration checksums and no-context row visibility. That is stronger evidence than a historical installation gap, but it is not a fresh exhaustive audit of the public artifact-operation tables, their positive grants, transaction-local context, or every actual request path.

Public readiness still explicitly defers full XVL/VTE and F12 and reports incomplete verification/governance for IMPRIMA and SHORT SPRINTS. At 06:41:02 UTC on 27 October the frozen probe also returned HTTP 503, database unavailable and buildReady false. Do not turn the earlier startup verifier's scoped PASS results into a blanket assertion that those services are fully activated or that database connectivity remains healthy.

## SCAN STAGE 1 — Freeze-stage Evidence Manifest

### 1.1 Fresh observations

The companion evidence file contains the precise UTC timestamps and response summaries from the anonymous probes performed for this refresh. Deployment metadata reported an active public autoscale deployment with a successful build.

| Probe | Observed basis before rendering | Supported conclusion |
| --- | --- | --- |
| /api/healthz | HTTP 200; status ok | The checked health endpoint responds. |
| /api/readyz | Earlier response: HTTP 200, database available. Frozen 06:41:02 UTC probe: HTTP 503, database unavailable, AI configured, buildReady false. | Latest readiness is failed; saved-work/sign-in database access may be affected. Root cause and duration are not established by this probe. |
| /api/sphinx/catalog | HTTP 200; publicOpen false; zero items | Public catalog publication remains closed at this endpoint. |
| Deployment startup logs | Database security verifier reports PASS; API later listens and /api/healthz returns 200. | The surfaced startup sequence passed its defined verifier; early readiness 500 responses alone do not establish continuing outage. |

These observations describe bounded public responses and surfaced logs. No production SQL was executed, no account journey was exercised in production and no secret was accessed for this report.

The readiness response instructs an operator to restore database access without replacing the database or connection string to bypass the failure. Diagnose the actual cause under approved read-only scope first. A single failed probe does not establish a permanent outage, but must not be hidden by the earlier successful response.

### 1.2 Recorded development evidence

| Check | Evidence and scope |
| --- | --- |
| Type checking | Latest surfaced typecheck workflow completed successfully across checked workspace packages. |
| Frontend tests | Earlier scoped delivery recorded 62 files / 467 passing tests; the later landing-page run separately passed 7 marketing tests. These are separate observations, not an additive total. |
| Frontend build | Production frontend build passed after the landing-page rewrite. |
| F5/F6 contract tests | Scoped API tests recorded 3 files / 32 passing cases; the later pinned-fetch test run separately passed 9 cases. |
| F5/F6 browser checks | Synthetic normal USER exercised local URL validation, mocked saved SCAN behavior, F6 source filtering and mobile containment; scoped test data was removed. |
| Actual bounded HTTPS retrieval | A public example page was successfully retrieved after the pinned-address family fix; this was not an AI-generated SCAN. |
| Full API suite | Latest surfaced run failed: 10 failures, 866 passes, 40 skips. This result takes precedence over any general statement that all tests pass. |

The browser used an intercepted F5 success response and a deliberate F6 rejection to avoid paid model calls. It establishes UI/request/source-selection behavior, not real provider-generated SCAN or PDD quality. Two generic 403 resource errors were observed during session loads without captured URLs; their relationship to other permission surfaces remains unverified.

## SCAN STAGE 2 — Baseline and Scope

### 2.1 Retained architecture and security boundaries

Keep generated API contracts synchronized with server and client consumers. Preserve owner/session checks, budget gates and run accounting. Protected workflows must use their reviewed restricted identity and transaction context; do not use a privileged fallback to make an activation check pass.

Existing migrations remain append-only. Do not use schema push or destructive SQL to bypass security failures. Current database verification, release custody and source-bound evidence requirements remain separate obligations.

### 2.2 In scope

This edition covers the F-process and supporting remediation; recent F4/F5/F6/F8 changes; Exemplar/SPC Player; the FORGE/convener learning path; IMPRIMA and SHORT SPRINTS internal versus external lanes; F10/F11/F12; corporate landing identity; project-first titles; the site map; and prioritized completion work.

### 2.3 Out of scope

No production installation, database mutation, marketplace opening, key rotation, subscription activation, paid model recording, external deployment, legal assessment or independent certificate issuance is performed. Publishing success and workspace test results are not substitutes for those activities.

## SCAN STAGE 3 — Evidence Mapping

### 3.1 Main production chain

| Stage | Current role and implementation reading | Gate or qualification |
| --- | --- | --- |
| F0 / F0.5 | Advisory and diagnostic surfaces remain represented. | Scores and source classes require their real provenance; no new production execution is asserted. |
| F1 | Session/ingestion/cartridge context enters the governed working chain. | Preserve ownership, input validation and the chosen source. |
| F2–F3 | Atomic specification and MA construction stages remain represented. | Installed governance criteria do not mean those criteria have passed. |
| F4 | Micro PDD remains platform-neutral; premature target restriction was removed. | Do not force a coding platform before the downstream conversion decision. |
| F5 | SPC production plus new link-based ATLAS 360 SCAN intake. | Persist coverage and distinguish fetched evidence from unverified references. |
| F6 | Draft ATLAS PDD from same-session, owned F5 SPC or F5 SCAN only. | Both JSON and streaming entry paths reject invalid source/mode combinations before provider work. |
| F7 | SPARTAN/MVP specification path and certification-related controls. | Retain source, score and credential rules; this report issues no new verdict. |
| F8 | CODE ONE + guided conversion integrates VIBE and HOST planning. | Drift/source qualification and applicable target controls remain; a scaffold is not a certified deployment. |
| F9 / F9.5 | Machine-floor evidence and OSIRIS custody remain distinct from conversion. | Firmware/physical outputs retain their applicable evidence and custody gates. |
| F10 | Target-specific export, provider and subscription handoff boundary. | Account subscription alone is not authorization, successful delivery or target execution. |
| F11 | Target-specific hosting/subscription handoff. | Configuration and actual provider results must be evidenced separately. |
| F12 | Governed operations target. | Full operation remains incomplete in the fresh public readiness declaration. |

### 3.2 F5 link intake and F6 source contract

The F5 intake accepts up to three HTTP/HTTPS URLs plus bounded supporting context. Public HTTPS text retrieval uses destination validation, pinned DNS, bounded response size and timeout controls. Redirects are not followed. Embedded credentials and known secret-like query keys are rejected.

Localhost, private-server and HTTP links are retained as REFERENCE_ONLY evidence rather than fetched. They must not be reported as inspected servers. Supply safely shareable context or an authorized public HTTPS endpoint when actual evidence is required; do not upload credentials.

SCAN retains source links and coverage statuses. A GitHub landing page is not equivalent to cloning, testing or auditing the whole repository. Unavailable or reference-only evidence remains explicitly limited in the subsequent PDD.

F6 accepts feature-5 SPC and ATLAS_360_SCAN_VIEW artifacts belonging to the same user and session. The legacy FROM_SPC name remains a compatibility alias for eligible F5 sources. FRESH is rejected for new drafts. Existing PLAN/SCAN transformations over already created PDDs are a different operation and must not be confused with the new F6 intake restriction.

### 3.3 Integrated conversion and target architecture

VIBE guidance now belongs inside F8 rather than constraining F4. The implementation uses CODE ONE + guided conversion and source-bound hosting recommendations; this does not establish a fully independent, separately evidenced execution of every named specialist.

The requested CODE ONE + / F10 destination categories are programming-language outputs, firmware, robotware, and IDE/VIBE coding environments. Treat this as target architecture, not proof that every compiler, device adapter, simulator or provider subscription is implemented or activated.

Colonization preferences are planning data. They do not establish owner consent to release, prove target compatibility or waive the ethical/governance block. Azure packaging must adapt to the target without suppressing mandatory safeguards.

### 3.4 Boomerang and SPC Player

Boomerang carries supporting work back toward its origin with retained source identity and numbered upgrades. SPC Player is a sequential advisory, plan-only supporting lane. Automated remediation may prepare a candidate and request a fresh evaluation; it must not manufacture a passing drift result.

Repeated Upgraded N iterations are lineage, not assurance. A failure remains a failure until a valid new check passes. Retain immediate recheck capability and visible recommendations without silently accepting stale source versions or starting unauthorized external execution.

### 3.5 Exemplar and SPHINX

Exemplar supplies retained owner-library references and the intended opt-in supply catalog. Public SPHINX is closed in the fresh observed catalog response. Any future library-to-marketplace switch must require the applicable internal quality, rights and qualification rules.

Cross-site integration with the separately maintained atanda.ai marketplace is an interface/product objective. This report does not establish completed cross-project synchronization, deployed upload UI changes on that separate site or public commerce activation.

### 3.6 FORGE FIELD ENGINEER and cohort governance

The learning/cohort/convener implementation is represented, including guided modules and progress surfaces. Training admission is free and invite-only. Practitioner free for life is unlocked only by completed course requirements plus the recorded FORGE FIELD ENGINEER certification; invitation acceptance or enrollment alone does not unlock it.

Standard usage/spend limits remain. Course assessment must not silently change existing Quest eligibility, independent credentials, higher-tier entitlements or billing arrangements. Cohort email/meeting/provider outcomes require their own operational evidence.

### 3.7 Internal and externally governed operations

| Lane | Usable implementation boundary | What it does not establish |
| --- | --- | --- |
| IMPRIMA Internal | Private preparation and internal KLARITY/SOCRATES supporting assessment are represented. | Independent verification, publication authority or external approval. |
| SHORT SPRINT Internal | Private preparation and internal assessment are represented. | Qualified sprint routing, independent receipts or governed release. |
| Externally governed IMPRIMA | Must satisfy protection, verification and approval/publication requirements. | Fresh readiness still reports incomplete verification/governance. |
| Externally governed SHORT SPRINTS | Must satisfy protection, eligibility, verifier and release requirements. | Fresh readiness still reports incomplete verification/governance. |

## SCAN STAGE 4 — Assurance Assessment

### 4.1 Latest regression failure disposition

| Finding | Evidence | Required response |
| --- | --- | --- |
| Nine provider replay failures | F4, F6 and F8 prompt changes lack matching cached fixtures for the three tested providers. | Review and refresh fixtures under approved provider/budget controls; rerun without removing assertions. |
| F6 disconnect regression | Streaming test expects a 200 SSE response but receives 400 under the changed intake contract. | Review its source/mode setup against the F5-only rule, preserve the rule, and prove valid-source output persistence after disconnect. |
| Full-workspace result | The API suite fails before a successful full workspace completion is established. | Resolve the recorded failures, then obtain a clean complete run; do not substitute scoped passing tests for this evidence. |
| Browser coverage limit | Intercepted responses validate client behavior, not model output or a real full project journey. | Add a bounded approved provider-backed acceptance when appropriate; preserve cost and ownership gates. |

The reported 866 passing, 10 failing and 40 skipped cases describe that API run only. Skipped tests are not passes. Percentages from this run must not be advertised as percentage completion of the platform.

### 4.2 Independent evaluation

Independent XVL/VTE remains incomplete in readiness. Advisory Track E contract checks and VTE failure intake are not equivalent to every verification track, an independent verifier authority or an operational end-to-end assurance program.

Source-code presence, self-assessed scores, operator-submitted CI evidence, target receipts and report formatting each have distinct meanings. None automatically becomes independent verification.

## SCAN STAGE 5 — Drift and Reconciliation

### 5.1 Project-first artifact invariant

ART-TITLE-001 is now recorded in the invariant documentation and permanent Agent rules: every new project artifact title must begin with the project name.

Use `ATANDA Command Centre — ATLAS 360 SCAN Living PDD` for this document. For other projects, use their actual owning project name. Preserve stage, readable type and Upgraded N suffixes without duplicating an existing prefix.

The rule is SPECIFIED, not yet automatically enforced across every artifact-creation path. Do not mark it active solely because this PDF complies. Do not mutate historical signed or hash-bound outputs to rename them; apply the rule to new outputs/versions. Titles and safe download filenames remain separate contracts.

### 5.2 Other reconciliation items

- Retire current-state copy that still describes separate F6 VDJ as the implementation destination decision or calls the new F8 Code ORACLE.
- Preserve the distinction between new F5 link SCAN and legacy F6/F7 PDD projection views.
- Keep the ATANDA-only corporate identity and SNAP landing copy consistent with real access terms and feature limits.
- Reconcile exact deployed revision/asset parity before saying every latest feature is live.
- Update test fixtures and test inputs after source/prompt contract changes without weakening the contracts.
- Reconcile old invariant entries and historical security findings using dated evidence, not documentary completion claims.

## SCAN STAGE 6 — Risk and Control Gaps

| Priority | Gap or risk | Measurable exit condition |
| --- | --- | --- |
| P0 | Latest frozen readiness returns 503 / database unavailable. | Read-only diagnosis identifies the cause; authorized remediation restores readiness and an actual database-backed acceptance without weakening checks. |
| P0 | Full regression remains red. | Valid F6 disconnect coverage and current provider fixtures; clean complete suite. |
| P0 | Protected request-path assurance is not proven by schema startup checks alone. | Read-only audit of actual runtime role, membership, positive grants, policies, context and immutable writes; reviewed remediation if needed. |
| P0 | Independent XVL/VTE and F12 operation remain unfinished. | Real source-bound independent execution; target health, promotion, incident and rollback evidence. |
| P1 | Title policy is not universally enforced. | All creation paths tested for project prefix, idempotence, lineage and immutable-history preservation. |
| P1 | CODE ONE + full evidence pipeline is incomplete. | Independently inspectable stage outputs, recovery semantics and downstream qualification, rather than prompt-only role claims. |
| P1 | F8 hosting-planning interruption recovery needs completion evidence. | Restart/disconnect handling preserves paid completed work and does not redispatch uncertain provider calls. |
| P1 | Provider-specific F10/F11 activation is conditional. | Real authorization, necessary scopes, qualified artifact and genuine provider result per target. |
| P1 | Cross-site Exemplar/SPHINX synchronization is not established here. | Reviewed interface contract, ownership/qualification, publication/withdrawal and cross-site acceptance. |
| P2 | Existing dependency/operational follow-ups remain open. | Audit current advisories and recovery/alert/cost follow-ups; retain unresolved upstream risks explicitly. |
| B-stage | Azure Key Vault migration/rotation. | Required Azure infrastructure and credentials, reviewed integration and rotation evidence; not an MVP prerequisite. |

This is a prioritized current-state register, not an exhaustive export of every project task. Historical proposals may be archived or superseded; recheck the task queue before scheduling duplicate work.

## SCAN STAGE 7 — Conformity Decision

The evidence supports a responsive process-health endpoint and substantial locally verified implementation. The latest frozen database readiness is failed. It does not support a claim of healthy database-backed production operation, universal readiness, all-feature activation, full independent certification or a green regression baseline.

Maintain current safeguards and clearly identified private/internal preparation capabilities. Keep public SPHINX closed and preserve target-specific release qualification until the relevant authorized gates are satisfied.

This report does not instruct another publish or make changes to production. A deployment may start and its defined database verifier may pass while application-level acceptance and the complete regression suite still require work.

## SCAN STAGE 8 — Monitoring and Living Update Loop

For each refresh, record the reviewed source snapshot, dated public endpoint observations, scoped test results, live parity limits and each changed gate's evidence. Preserve the previous report instead of silently rewriting its historical findings.

Track implementation status, live activity and verification status as separate fields. Use UNVERIFIED when a protected journey was not checked; do not automatically interpret it as broken or inactive.

Refresh this PDD after title enforcement, repaired full regression, protected-workflow acceptance, independent verification, new target adapters, marketplace launch authorization or a material change in the public readiness declaration.

# PART 3 — Atomic Prompt Worksheet

The following 45 single-operation work items are an implementation worksheet, not a record that 45 specialist calls were executed. Each row states a bounded input, one operation, a verifiable output and explicit prerequisite IDs. Priority is P0 critical, P1 high, P2 standard or P3 enhancement.

## Phase 1 — Evidence and baseline

| ID / priority | Input → single operation → output | Dependencies |
| --- | --- | --- |
| ATL-001 / P0 | Working tree → freeze selected source identities → dated hash manifest. | None |
| ATL-002 / P0 | Deployment service → record current metadata → bounded deployment snapshot. | 001 |
| ATL-003 / P0 | Public health endpoint → probe response → timestamped status observation. | 002 |
| ATL-004 / P0 | Public readiness endpoint → capture declarations → scoped readiness record. | 002 |
| ATL-005 / P0 | Public catalog endpoint → capture publication state → dated open/closed observation. | 002 |
| ATL-006 / P0 | Latest test workflow → classify failures → per-failure evidence list. | 001 |
| ATL-007 / P0 | Latest typecheck workflow → record outcome → scoped typecheck evidence. | 001 |
| ATL-008 / P1 | Current App route declarations → inventory paths → deduplicated site map. | 001 |
| ATL-009 / P0 | Evidence records → classify assurance scope → source/local/public/unknown labels. | 003,004,005,006,007,008 |

## Phase 2 — Core contract and naming repairs

| ID / priority | Input → single operation → output | Dependencies |
| --- | --- | --- |
| ATL-010 / P0 | F6 disconnect test → align valid source setup → same-session F5-source test fixture. | 006 |
| ATL-011 / P0 | Valid-source disconnect fixture → test disconnect persistence → persisted output evidence. | 010 |
| ATL-012 / P0 | Current F4/F6/F8 prompt identities → enumerate replay gaps → exact required fixture list. | 006 |
| ATL-013 / P0 | Approved provider recording scope → refresh missing fixtures → reviewed replay set. | 012 |
| ATL-014 / P0 | Repaired tests and replay set → run complete suite → unambiguous regression result. | 011,013 |
| ATL-015 / P1 | ART-TITLE-001 and creation routes → inventory title producers → coverage list. | 001 |
| ATL-016 / P1 | Owning project record → resolve title prefix → authoritative project-name value. | 015 |
| ATL-017 / P1 | Prefix and candidate title → format new artifact title → project-first idempotent title. | 016 |
| ATL-018 / P1 | Creation-path coverage list → verify title invariant → cross-path pass/fail evidence. | 017 |

## Phase 3 — Protected operations and evaluation

| ID / priority | Input → single operation → output | Dependencies |
| --- | --- | --- |
| ATL-019 / P0 | Approved read-only scope → inspect runtime identity → role/connection evidence. | 009 |
| ATL-020 / P0 | Runtime identity → inspect operations-role membership → membership result. | 019 |
| ATL-021 / P0 | Workflow query inventory → inspect required positive privileges → per-table grant matrix. | 019 |
| ATL-022 / P0 | Protected table inventory → inspect RLS policies → predicate and FORCE RLS findings. | 019 |
| ATL-023 / P0 | Protected table inventory → inspect immutability triggers → definition/enabled-state findings. | 019 |
| ATL-024 / P0 | Request context contract → verify transaction-local settings → actor/admin isolation evidence. | 020,021,022,023 |
| ATL-025 / P0 | Authorized bounded IMPRIMA case → execute acceptance → scoped workflow result. | 024 |
| ATL-026 / P0 | Authorized bounded sprint case → execute acceptance → scoped workflow result. | 024 |
| ATL-027 / P0 | Independent verifier contract → identify qualification gaps → verifier acceptance checklist. | 025,026 |

## Phase 4 — Conversion and target qualification

| ID / priority | Input → single operation → output | Dependencies |
| --- | --- | --- |
| ATL-028 / P1 | Integrated F8 contract → inventory actual stage evidence → implemented/deferred stage map. | 009 |
| ATL-029 / P1 | F8 recovery contract → verify interruption behavior → no-duplicate-charge recovery evidence. | 028 |
| ATL-030 / P1 | Selected F10 target → validate authorization → scoped provider authorization result. | 028 |
| ATL-031 / P1 | Qualified artifact and authorized target → perform bounded handoff → genuine delivery receipt. | 030 |
| ATL-032 / P1 | F11 hosting contract → verify provider outcome → target-specific hosting evidence. | 031 |
| ATL-033 / P0 | Authorized F12 target → verify health criteria → target health result. | 032 |
| ATL-034 / P0 | Reviewed promotion policy → verify promotion controls → promotion decision evidence. | 033 |
| ATL-035 / P0 | Reviewed rollback plan → verify rollback behavior → rollback evidence. | 034 |
| ATL-036 / P1 | Failed drift artifact → verify remediation lineage → source-bound Upgraded N candidate. | 018,028 |

## Phase 5 — Integration and release evidence

| ID / priority | Input → single operation → output | Dependencies |
| --- | --- | --- |
| ATL-037 / P1 | Remediation candidate → run fresh drift check → current pass/fail evidence. | 036 |
| ATL-038 / P1 | Exemplar qualification rules → specify publication contract → owner/quality/rights interface. | 009 |
| ATL-039 / P1 | Cross-site test scope → verify synchronization → publication/withdrawal acceptance result. | 038 |
| ATL-040 / P1 | FORGE eligibility cases → verify certification entitlement → invite/completion/certification boundary evidence. | 009 |
| ATL-041 / P2 | Current dependency advisories → classify residual risk → dated mitigation register. | 009 |
| ATL-042 / P0 | Deployed assets and source snapshot → assess release parity → exact verified/unverified parity statement. | 014,018 |
| ATL-043 / P1 | Updated evidence set → reconcile gate statuses → evidence-linked gate register. | 027,035,037,039,040,041,042 |
| ATL-044 / P2 | Gate register and site map → compile living PDD → project-prefixed source document. | 043 |
| ATL-045 / P2 | Source document → render reviewed PDF → downloadable report with page and evidence checks. | 044 |

# PART 4 — Implementation Plan and Governance

## 4.1 Recommended order

Treat the latest 503 database-readiness finding as the immediate operational priority: diagnose under read-only authority, obtain approval for any required corrective action, and confirm recovery without changing or weakening the existing protection model. No such correction is performed by this documentary update.

1. Restore regression certainty: review the F6 disconnect test's input contract, refresh approved provider fixtures, then obtain a clean complete run.
2. Implement ART-TITLE-001 centrally and cover all bypass/derivative paths without changing immutable historical artifacts.
3. Establish protected runtime evidence: actual identity, role membership, required grants, exact policies, context and immutable-version behavior.
4. Demonstrate bounded internal/external workflow acceptance under the appropriate gates; do not substitute internal results for independent evidence.
5. Complete independent verification and target-specific F10/F11/F12 evidence in dependency order.
6. Complete full CODE ONE + evidence/recovery and any destination-specific compiler or provider work.
7. Qualify cross-site marketplace supply before any authorized public opening; keep Azure work in its agreed B-stage.
8. Reconcile release parity and refresh this living report.

Steps are ordered by evidence and safety dependencies rather than a claimed whole-platform completion percentage. Some target preparation may proceed in parallel, but it cannot bypass its listed prerequisite gates.

## 4.2 Tool and implementation policy

Use the existing Replit/pnpm workspace, React/Vite, Express, OpenAPI code generation and PostgreSQL/Drizzle migration history. Preserve the established deployment startup migration/verification chain. No tool migration is justified merely to prepare this PDF.

VIBE/HOST target selection belongs in F8 and target handoff packaging. Provider choice must reflect actual target compatibility, evidence and user authorization; do not reuse generic tool-mix percentages as measured recommendations.

## 4.3 Accountable review roles

| Role | Responsibility | Evidence boundary |
| --- | --- | --- |
| Product owner | Approve scope, priorities and marketplace/release decisions. | Product instruction is not independent technical evidence. |
| Implementation engineer | Deliver source/contract/UX changes and regression coverage. | Tests support their measured scope only. |
| Database/security reviewer | Review restricted roles, grants, policies and request context. | Do not weaken a failed security check. |
| Independent verifier | Execute qualified source-bound evaluation. | Must not relabel internal assessment as independent. |
| Release operator | Confirm target health, promotion, rollback and parity. | A delivery receipt is not proof of target enforcement. |
| Cohort convener | Maintain invite, course and certification records. | Training outcomes do not overwrite Quest rules. |
| Documentation custodian | Reconcile evidence and preserve dated reports. | Report completion does not activate product gates. |

These are accountability assignments, not a claim that named SPC agents, a Camelot team or a certification panel ran during this refresh.

# ADDENDUM A — Current Site Map

The generated route inventory following this source text is extracted from current frontend declarations. A registered route is not proof that an anonymous visitor can use it or that every action behind it is active.

| Surface | Typical entry | Current interpretation |
| --- | --- | --- |
| Corporate/public information | Landing, pricing, public verification, status | Source present; fresh API probes are limited to the observed endpoints. |
| Production workspace | Command, sessions, session detail | Authentication/permissions and per-stage gates apply. |
| Intake | New Session, Ingestion, Cartridge | Retained source context and validation apply. |
| Supporting work | SPC Player, Boomerang, Exemplar | Source identity, lineage and owner scope must be retained. |
| Learning | Student login/register, Learn, Quest, Ascension | Invitation, course and credential rules apply. |
| Cohort management | Convener and cohort detail | Convener authorization and actual provider outcomes apply. |
| Operations and delivery | Operations, F10 and session verification | Internal/preparation versus governed operation remains explicit. |
| Account/admin | Account, billing, activity, costs and admin pages | Identity/role/feature permissions apply; source presence is not public access. |
| F11/F12 workspace entry | Through applicable session/operations interfaces | Do not invent standalone /f11 or /f12 routes; full F12 remains incomplete. |
| External marketplace | Separately maintained atanda.ai project | Cross-project production integration not established by this review. |

# ADDENDUM B — Publication and Acceptance Checklist

- Confirm the exact source revision and intended published assets.
- Resolve the recorded complete-suite failures; do not describe scoped passes as full regression clearance.
- Preserve the defined database verification startup gate and obtain any missing application-path evidence.
- Verify one authorized journey for each capability being announced as newly active.
- Keep independent XVL/VTE, full F12 and externally governed operations conditional until their own evidence clears.
- Keep public SPHINX closed until explicitly authorized and qualified.
- Apply project-first naming to all new artifacts without rewriting signed history.
- Preserve FORGE's certification-dependent lifetime Practitioner entitlement and standard usage limits.
- Update the Guide, status descriptions and living invariant evidence only to match demonstrated behavior.

## Final determination

The platform has a responsive process-health endpoint, material implemented functionality and useful recent local verification. The latest frozen readiness probe reports database unavailable; the complete API regression result is red and independent/governed capabilities remain explicitly incomplete. Prioritize read-only diagnosis of database readiness, then continue the ordered evidence and repair work. Do not market this report as all-feature activation, independent certification or a blanket production-readiness approval.
