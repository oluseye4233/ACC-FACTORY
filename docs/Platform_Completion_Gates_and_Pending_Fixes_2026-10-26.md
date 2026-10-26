# Platform Completion, Closed Gates and Pending Fixes

**Platform:** ATANDA Command Centre / ARK Harness  
**Assessment date:** 26 October 2026  
**Purpose:** Recommend a development completion order and distinguish confirmed live status, historical findings, pending verification and intentionally deferred capabilities.  
**Scope:** This document records the preceding advisory review. It is not a new production database audit, release authorization, independent certification or claim that every backlog item has been reproduced.

## 1. Executive Recommendation

Complete and stabilize the existing platform before adding more major features. The main unfinished work is production security, independent verification and proving third-party handoffs—not rebuilding the core interface.

Keep two releases separate:

1. **Usable core platform:** sessions, ingestion, Cartridge, Exemplar, SPC Player, Boomerang, internal evaluation and FORGE training.
2. **Governed external operation:** independently verified SHORT SPRINTS/IMPRIMA, qualified F10/F11 handoffs and full F12 operation.

A usable core release must not imply that every protected gate is open. Keep protected workflows fail-closed while developing and operating the separately authorized internal/private lanes.

## 2. Confirmed Live Observations

The following observations were collected from deployment metadata and public endpoints on **26 October 2026**.

| Check | Observed result | What the result establishes |
| --- | --- | --- |
| Published deployment | Successful public deployment exists | The platform is published |
| Database readiness | Available | The readiness probe can reach the database |
| AI configuration | Configured | Credentials/configuration exist; this does not prove that every model call succeeds |
| Basic build readiness | True | Basic dependencies are ready; this is not full feature certification |
| SPHINX public catalog | `publicOpen: false`, `items: []` | Public marketplace supply is not activated |
| Independent XVL/VTE and full F12 | Live readiness reports these incomplete | These must not be advertised as fully operational |
| Protected SHORT SPRINTS/IMPRIMA | Live readiness reports incomplete verification/governance gates | Internal/private lanes remain distinct from protected external operation |

### Sources

- Published platform: <https://command-center.atanda.ai>
- Public readiness: <https://command-center.atanda.ai/api/readyz>
- Public SPHINX catalog: <https://command-center.atanda.ai/api/sphinx/catalog>
- Deployment metadata retrieved through the deployment service.

The readiness response is a database/configuration probe with declared deferrals, not an exhaustive runtime audit of every protected workflow.

**Release parity caveat:** The latest numbered Boomerang changes passed development checks. That alone does not establish that this exact revision has been republished.

## 3. Closed and Conditional Gates

| Gate | Present assessment | Required exit condition |
| --- | --- | --- |
| Protected database operation for IMPRIMA and SHORT SPRINTS | Not cleared for production activation in this review | Reviewed restricted-role installation, required permissions, FORCE RLS, exact policies and immutable-version triggers; verification using the actual application login |
| Independent XVL/VTE verification | Incomplete according to live readiness; complete independent evidence not established by this review | Required verification tracks, genuinely independent execution, source-bound evidence, failure handling and demonstrated acceptance criteria |
| Externally governed IMPRIMA | Conditional/blocked | Database protection clearance, independent evidence and named approval/publication authority; internal KLARITY/SOCRATES results do not substitute for these |
| Externally governed SHORT SPRINTS | Conditional/blocked | Production protection, qualified source/pack evidence, required verifier receipts and governed eligibility/release decisions |
| F10/F11 integrations | Provider-specific and conditional | Real account authorization, working broker/adapter, qualified artifact, required scopes and a genuine provider receipt or operational result |
| Full F12 | Incomplete according to live readiness | Demonstrated rollout, health checks, promotion controls, incident handling and confirmed rollback against a real target |
| SPHINX public marketplace | Confirmed closed at the checked endpoint | Explicit launch authorization, qualification/rights checks and verified catalog publication, withdrawal and cross-site synchronization |
| Azure Key Vault | Intentionally deferred | Complete as the agreed B-stage upgrade; it is not a reason to block the core MVP |

### 3.1 Production Database Evidence Requires Rechecking

The last detailed production-security assessment, dated **22 October 2026**, recorded missing restricted-role/guard elements.

That is historical evidence, not a fresh production database inspection on 26 October. Recheck those items before deciding which installation work remains. Do not assume that publishing application code installs every required role, policy or trigger.

The production audit should verify:

- The restricted operations role and the actual application's ability to assume it.
- Required positive SELECT/INSERT/UPDATE privileges, not just the absence of DELETE/TRUNCATE.
- RLS enabled and forced on the protected workflow tables.
- Exact reviewed policy predicates and absence of additional permissive bypass policies.
- Immutable-version trigger definitions and enabled state.
- Transaction-local actor and administrator context.
- Actual runtime use of the restricted identity, without owner-connection fallback.

A failed check must remain a failed check. Do not weaken the guard to obtain a green status.

### 3.2 Third-Party Subscriptions Are Not Integration Evidence

A subscription to Slack, LangSmith or another provider is not itself authorization or proof of a working integration.

- Slack needs workspace/app authorization, approved scopes and a demonstrated delivery or hosted-agent entry point.
- A LangChain export is not proof of execution in a target environment.
- A LangSmith dataset handoff does not prove that an evaluation ran.
- F11 needs genuine provider-side provisioning or hosting evidence for the selected integration.
- F12 needs real target health, promotion and rollback evidence.

## 4. Pending Fixes and Completion Work

The items below combine recorded follow-ups and outstanding completion criteria. They are not all freshly reproduced defects from this review and are not an exhaustive export of the project task queue.

### Priority 1 — Establish Release and Security Certainty

1. **Reconcile development versus production.**
   - Identify the exact published revision.
   - Verify which recent fixes are actually live.
   - Keep development tests, deployment success and production behavior as separate evidence.
2. **Recheck protected production database guards.**
   - Produce a clear PASS/FAIL list using the actual runtime identity.
   - Keep diagnosis read-only.
   - Separate any required installation from the audit and obtain the appropriate review.
3. **Reconcile the invariant register.**
   - Replace stale observations with dated evidence.
   - Track implementation, live activity and verification separately.
   - Treat inaccessible or unchecked capabilities as UNVERIFIED, not automatically inactive or complete.

These items come first because otherwise work may be duplicated or an unopened capability may be announced as complete.

### Priority 2 — Close Reliability and Financial Risks

Recorded follow-ups include:

- Budget-accounting regression coverage when model calls complete, fail or remain uncertain.
- Recovery visibility and alerts for abandoned credits/private files.
- Operator visibility into retries that remain running.
- Webhook delivery-failure warnings and retry-history performance.
- Monthly provider-bill reconciliation.
- Consistent session statuses and engine names across operator views.

Each item needs current confirmation, a scoped fix where necessary and closure evidence. Uncertain paid model outcomes must not trigger automatic redispatch and duplicate charges.

### Priority 3 — Finish User Workflows

- Verify remaining authenticated journeys across Quest, preparation, archive and cohort administration.
- Complete the wider mobile, keyboard and accessibility review.
- Confirm public certificate verification does not make staff-only requests.
- Complete the queued comparison of non-F8 Boomerang revisions before acceptance.
- Complete the queued Boomerang upgrade/gate-history export.
- Verify that FORGE certification unlocks lifetime Practitioner access only under the established invitation, course-completion and explicit certification rules.

#### Boomerang Work Already Verified in Development

The latest scoped work verified:

- Exact artifact links back to the originating session and F-stage.
- Immutable source-lineage naming: **Upgraded 1**, **Upgraded 2** and subsequent versions.
- Selecting a returned candidate as the source of the next rework.
- Idempotent return behavior and distinct numbering for concurrent corrections.
- No inherited passing score, certification or automatic review acceptance.
- F8 correction followed by a fresh drift check, with an explicit next-attempt action for a failed result.
- A signed-in Upgraded 1 → Upgraded 2 browser journey, reload persistence and a narrow-screen return card.

This successful Boomerang check does not complete platform-wide browser testing. It also does not guarantee that a first correction will pass a drift gate or establish independent certification.

### Priority 4 — Resolve Residual Security Findings

The latest documented dependency assessment retains:

| Dependency | Recorded severity | Closure requirement |
| --- | --- | --- |
| `braces` | High | Fresh advisory/version check, followed by a compatible patch or reviewed replacement |
| `sprintf-js` | Moderate | Fresh advisory/version check, followed by a compatible patch or reviewed replacement |

These are documented findings, not a new audit result from this report. Limited reachability is not the same as fixing a vulnerable dependency. Do not suppress an advisory simply because an inspected path appears less exposed.

## 5. Recommended Build Order

| Order | Deliverable | Completion standard |
| --- | --- | --- |
| 1 | Release/status reconciliation | Exact live revision and current gate register established |
| 2 | Production security clearance | Required guards pass under the actual restricted runtime identity |
| 3 | Core reliability and cohort pilot | Save/reopen, ownership, recovery, billing boundaries and training entitlement journeys pass |
| 4 | Independent XVL/VTE pilot | One complete, source-bound verification path demonstrated—not simulated |
| 5 | Protected IMPRIMA and SHORT SPRINTS pilots | One real end-to-end case for each, including rejection and recovery |
| 6 | One F10 → F11 provider pilot | Authorized handoff and genuine provider-side result established |
| 7 | F12 controlled operation | Failed-health hold and real rollback demonstrated before wider promotion |
| 8 | SPHINX public launch | Qualified Exemplar supply, synchronization and withdrawal verified |
| 9 | Azure B-stage completion | Vault integration and rotation completed without weakening existing safeguards |

Keep Software and Firmware acceptance paths distinct. Do not force software through hardware-only requirements or remove firmware safeguards.

Cohort training, internal/private evaluation and core reliability improvements can proceed in parallel where their existing authorization boundaries permit. Do not infer permission to open external release gates from that parallel work.

## 6. Completion and Progress Accounting

Do not assign a whole-platform completion percentage until the register and live release are reconciled. Existing percentages for a stabilization checklist are not percentages of the whole product.

For every gate or fix, record:

| Field | Required information |
| --- | --- |
| Capability/fix | Precisely bounded behavior |
| Responsible owner | Person or team accountable for closure |
| Implementation state | Missing, partial or implemented |
| Development verification | Test type, result and date; identify mocks/synthetic evidence |
| Live activity | ACTIVE, INACTIVE or UNVERIFIED, supported by dated evidence |
| Blocking dependency | Exact missing authority, implementation, configuration or evidence |
| Exit condition | Observable acceptance criteria |
| Release evidence | Published revision and production confirmation |

Synthetic receipts, configuration presence, passing component tests and a successful deployment must not be counted as proof of real independent execution or target operation.

## 7. Immediate Next Action

Perform a **read-only production-security and release-parity audit**, then revise the gate register with an owner and measurable exit condition for every blocker.

The audit should deliver:

1. The current published revision and a list of implemented changes not yet confirmed live.
2. A dated production database guard PASS/FAIL/UNVERIFIED matrix.
3. A reconciled list of closed, conditional and intentionally deferred gates.
4. A deduplicated remaining-fixes checklist, separating defects from optional enhancements.
5. A release recommendation for the usable core, without implying activation of protected workflows.

## 8. Supporting Project Documents

- `docs/ATLAS_360_PLAN_Living_PDD_2026-10-24.md`
- `docs/upgrade-program/protected-workflow-readiness.md`
- `docs/upgrade-program/fix-process-checkpoint.md`
- `docs/upgrade-program/verification-checkpoint.md`
- `docs/upgrade-program/dependency-advisories.md`
- `docs/upgrade-program/recovery-operations.md`
- `docs/upgrade-program/progress.json`
- `docs/boomerang-score-remediation.md`

Some supporting records contain historical observations. Their dates and verification scope must be respected rather than treating every recorded state as current.

---

**Bottom line:** The core platform can continue operating while protected gates remain closed. Complete the missing evidence and controls; do not weaken those gates to make the platform appear finished.
