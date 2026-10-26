# Production Read-Only Audit and Remaining-Fixes Checklist

**ATANDA Command Centre / ARK Harness**  
**Observed:** 26 October 2026, approximately 13:47–13:57 UTC  
**Method:** Published deployment metadata, unauthenticated public endpoints and frontend assets, read-only production database replica queries, current source contracts and project task states.  
**Change scope:** None in production. No roles, policies, triggers, data, migrations, secrets, provider accounts or deployment settings were changed. This document is not a security installation approval.

This audit supersedes the *observations* in `docs/Platform_Completion_Gates_and_Pending_Fixes_2026-10-26.md` where newer evidence is available. It does not replace the full upgrade specifications.

## 1. Executive Ruling

**The published core is reachable, but the protected IMPRIMA / SHORT SPRINTS production gate is CLOSED.** The catalog replica contains the five protected public-schema tables, but lacks the required non-login operations role, FORCE RLS, effective reviewed policy predicates and immutable-version triggers. Do not turn a private preparation or internal assessment into a protected Final publication, protected sprint verdict or certified release by weakening that gate.

Other product gates have different states: full independent XVL/VTE and F12 remain incomplete according to the live readiness response; SPHINX is confirmed closed to the public; Azure Key Vault remains an agreed B-stage deferral. F10/F11 require acceptance per real provider and target, not a blanket switch.

The public frontend serves a component containing the new Boomerang **Rework this version again** link and **not a gate pass** notice. That is evidence the interface reached a published asset—not proof of the exact serving API revision or an authenticated production journey.

## 2. Evidence and Limits

| ID | Read-only observation | Finding | Limit |
| --- | --- | --- | --- |
| E1 | Deployment service | Successful **public**, autoscale deployment at <https://command-center.atanda.ai> | Metadata returned no immutable serving source revision in this audit |
| E2 | `GET /api/readyz` | HTTP success; database `available`, AI `configured`, `buildReady: true` | Probe explicitly disclaims model availability, migrations, every feature and independent certification |
| E3 | `GET /api/sphinx/catalog` | `publicOpen: false`, empty `items` | Confirms source API closed; does not audit external site's entire integration |
| E4 | Public versioned frontend bundle | `ReturnedUpgrade` component contains rework link and non-pass notice | Static asset proof only, not an authenticated production return or API revision attestation |
| E5 | Production **read-only replica** catalog | `ark_app_login` exists; `atanda_artifact_operations` absent | Replica checking user was `neondb_owner`, **not** proof of the live application's connected identity |
| E6 | Production replica `pg_class` | All nine workflow-accessed public tables exist. RLS enabled but **not forced** on each of five protected tables | Does not assess the other four tables as part of the five-table protected RLS contract |
| E7 | Production replica `pg_policies` | Seven expected *names* exist; `qual` and `with_check` are null in the returned catalog rows | Names alone do not satisfy the reviewed expressions |
| E8 | Production replica non-internal `pg_trigger` | Neither expected immutable-publication trigger was present on the five protected tables | Does not prove anything about unrelated triggers elsewhere |
| E9 | Role/privilege matrix | Role membership and nine-table SELECT/INSERT/UPDATE checks returned **NULL** because the target operations role is absent | NULL means **cannot pass/assess**, not a passing negative privilege test |
| E10 | Project task registry | 39 accepted/queued/in-progress records and 82 **proposed** records at the observation time | Task status is not a reproduced bug, deployment verdict or acceptance evidence |

The seven policies' missing expressions and missing FORCE flags are material catalog failures. A later positive privileged operation must still be checked using the application's real runtime identity after a reviewed installation; the replica cannot supply that attestation.

### What remains unknown about the serving revision

The local source history contains a Boomerang implementation checkpoint followed by a Publish checkpoint, and a matching versioned Boomerang UI component is public. The deployment metadata returned by the service does **not** include an exact serving backend commit or digest. Therefore:

- **Frontend presence: observed.**
- **Backend revision parity: unverified.**
- **Signed-in production Boomerang flow: unverified.** The earlier signed-in Upgraded 1 → Upgraded 2 browser pass exercised the **development** app with synthetic data.

Find the exact serving build record in Publishing and pair its immutable revision/digest with a non-destructive authenticated production smoke check. Do not infer that publishing succeeded for a specific backend change solely from the source commit order or public asset.

### Migration visibility

The production replica listed the nine workflow tables and the `app`, `ark_meta`, `imprima`, `public` and `short_sprints` schemas. A lookup for a table named `__drizzle_migrations` returned no rows in the replica's visible `pg_tables`. This **does not prove** migrations failed, were skipped or need manual replay. Confirm the authoritative deployment migration record using the supported release path; do not create or alter a ledger based on this lookup.

## 3. Production Security Gate — Confirmed Check Results

The reviewed software contract expects a restricted, non-login `atanda_artifact_operations` role; actual `SET LOCAL ROLE`; positive table privileges; FORCE RLS; exact owner/authority policy definitions; and the two immutable-version triggers. It must fail closed if a requirement is missing.

| Check | Observed state | Verdict |
| --- | --- | --- |
| `ark_app_login` catalog role | Exists, login-capable; not a proof that the deployed app uses it for every request | **PARTIAL / RUNTIME UNVERIFIED** |
| `atanda_artifact_operations` restricted role | No matching catalog role | **FAIL** |
| App-login membership in operations role | Target role absent; `pg_has_role` cannot establish membership | **FAIL PREREQUISITE** |
| Role must lack superuser/bypass/DDL/login capabilities | No target role to check | **FAIL PREREQUISITE** |
| Required positive table grants | Target role absent; all matrix results NULL | **FAIL PREREQUISITE** |
| RLS enabled on five protected tables | Enabled on all five | **PASS FOR THIS CHECK ONLY** |
| FORCE RLS on five protected tables | False on all five | **FAIL** |
| Four owner and three authority policy definitions | Seven names present, returned predicates/check expressions NULL | **FAIL** |
| No additional permissive protected-table policies | No extra policies among catalog rows returned | **PASS FOR THIS NARROW CHECK ONLY** |
| `imprima_file_immutable` and `imprima_final_immutable` triggers | Neither present in catalog result | **FAIL** |
| Actual transaction uses restricted role and sets actor/admin context | Cannot test with this replica's read-only owner connection | **UNVERIFIED** |
| Protected end-to-end owner/cross-owner/immutability behavior | Not exercised against production | **UNVERIFIED** |

The checking connection (`neondb_owner`) itself has `rolbypassrls: true` and owns these tables. That fact is **not** a claim that all production requests run as that user; it is why inspecting a replica through the owner cannot substitute for an application-runtime role test.

**Required privilege matrix after a reviewed installation**

| Table | SELECT | INSERT | UPDATE |
| --- | --- | --- | --- |
| `imprima_jobs` | Yes | Yes | Yes |
| `imprima_files` | Yes | Yes | No |
| `short_sprint_runs` | Yes | Yes | Yes |
| `artifact_operation_events` | Yes | Yes | No |
| `sprint_verifier_authorities` | Yes | Yes | Yes |
| `harness_artifacts` | Yes | No | No |
| `harness_feature_state` | Yes | Yes | Yes |
| `command_deck_traces` | Yes | Yes | No |
| `vte_verification_failures` | Yes | Yes | Yes |

Do not replace this positive matrix with merely checking the absence of DELETE/TRUNCATE. The existing guard also forbids protected ownership/public-schema creation and UPDATE on immutable files/events. **No installation was attempted during this audit.**

## 4. Gate Register for Completing the Platform

| Gate | Classification on this evidence | Exit condition | Accountable lane |
| --- | --- | --- | --- |
| Published core & public readiness | **ACTIVE for basic reachability** | Associate live revision with tested feature journeys and monitor actual operations | Release engineering |
| Protected IMPRIMA and SHORT SPRINTS | **CLOSED — confirmed catalog blockers** | Reviewed installation by authorized administrator, nine readiness checks PASS on production, actual restricted-role transactions PASS, negative owner/immutability checks PASS | Administrator + security reviewer + engineering |
| IMPRIMA Internal / SHORT SPRINT Internal and private preparations | **Implemented in source; current live end-to-end status unverified in this audit** | Verify separately under their own authorization; do not present as external certification | Product + QA |
| Independent XVL/VTE | **INCOMPLETE per live readiness** | Required tracks, truly independent executor, bound evidence, failure/recovery and observed verdict | Verification authority |
| Qualified F10/F11 | **CONDITIONAL by provider** | Qualifying artifact, authorization/scopes, first real provider/host action, retained artifact-bound receipt and target evidence | Integration owner + provider-account owner |
| Full F12 | **INCOMPLETE per live readiness** | One controlled target pilot with health hold, staged promotion, incident path and proven rollback | Operations + release approver |
| Public SPHINX marketplace | **CLOSED — confirmed source API** | Rights/qualification, opt-in, synchronization, withdrawal, actual external receiver acceptance and explicit public-opening decision | Marketplace + legal/product |
| Azure Key Vault | **INTENTIONALLY DEFERRED** | Approved B-stage connection, rotation and ethical-control verification | Security + platform |
| Subscriber-wide database isolation | **SEPARATE PENDING SCOPE** | Reviewed tenant-isolation design and enforcement beyond the five protected public tables | Security architecture |

Development-only test receipts, synthetic provider reports, an external subscription or green readiness are not sufficient exit evidence.

### Invariant-register reconciliation

The checked `docs/upgrade-program/progress.json` currently marks **all 129 listed invariants** and **all 243 listed atomic prompts** as `liveActivity: UNVERIFIED`. This is a **register maintenance/evidence gap**, not proof that none of the capabilities work. Its production-observation entries predate this audit. Do not turn 0/129 verified register entries into a whole-platform completion percentage. For each applicable invariant, attach the serving revision, dated runtime/test evidence, assessor and enforcement tier; distinguish ACTIVE, INACTIVE and UNVERIFIED.

## 5. Definitive Remaining-Fixes Checklist — Prioritized

The checkboxes below are exit conditions, **not** a request to implement everything at once. P0 items must remain closed or be resolved before claiming protected/public operation; P1 establishes one real verified vertical slice; P2 consists of narrower accepted follow-ups.

### P0 — Release and Security Truth

- [ ] **R1 — Identify the exact serving backend revision.** Match Publishing build record to source and verify a bounded authenticated production core journey. Public frontend presence is not sufficient. **Status:** unverified.
- [ ] **R2 — Obtain a reviewed production guard installation plan and approval.** Resolve the role, membership, positive grants, FORCE RLS, exact policies and immutable triggers. The audit did not install them. **Status:** multiple confirmed catalog failures and prerequisites.
- [ ] **R3 — Run all nine production readiness checks plus actual runtime-role/context probes after installation.** Prove owner isolation and immutable Final/file behavior; refuse owner fallback. **Status:** blocked by R2.
- [ ] **R4 — Reconcile the invariant register against the published revision.** Update evidence per capability, not by copying specifications or development results. **Status:** all listed entries currently UNVERIFIED in the register.
- [ ] **R5 — Triage high-risk accepted/proposed regressions before wider activation.** Prioritize staff-only calls on public verification (#330), stage unlocking (#112), F0 foreign artifacts (#239), free-tool score exposure (#93), F9 retry duplicate protection (#195), rate-limit restart behavior (#92) and budget drift (#296). **Status:** task titles are recorded; individual current failure states need targeted verification.
- [ ] **R6 — Confirm paid/subscription safety before opening billing.** Verify published access/checkout pricing, entitled workspace entry, account ownership and recovery without assuming the current disabled/dormant checkout is a live paid journey (#346, #347). **Status:** production paid journey not attested here.

### P1 — Demonstrate Governed Vertical Slices

- [ ] **R7 — One independent XVL/VTE case:** complete required tracks and retain verifiable bound receipts, including a genuine fail/inconclusive path.
- [ ] **R8 — One protected IMPRIMA Final case and one SHORT SPRINTS case:** only after R2–R3, with approved source, restricted identity, real assessment/authority, immutable version and rejection/recovery evidence.
- [ ] **R9 — One qualified F10 → F11 target:** retain actual provider authorization, artifact-bound handoff, receipt and provider-side outcome; do not equate Slack/LangChain export with hosted execution (#335, #336).
- [ ] **R10 — One F12 operational pilot:** prove hold on failed health, staged rollout, incident response and confirmed rollback against a real target.
- [ ] **R11 — SPHINX source-to-marketplace contract:** consent, qualification, metadata freshness, de-list/withdrawal and receiver-side reconciliation before publicly opening catalog.
- [ ] **R12 — Complete authenticated core QA:** real save/reopen and negative owner tests for remaining accepted Quest, cohort, SPC source-selection, Boomerang and preparation journeys (#323–#325, #333, #344). Do not repeat model calls or contact live recipients as part of testing.

### P2 — Recorded Accepted Product/Operational Follow-Ups

These are accepted/queued/in-progress task records, **not confirmation that each code path is broken today**. Close or retire them only with current evidence. A `CONCURRENCY_LIMIT` marker means queued capacity, **not** an application defect.

| Area | Accepted task refs and recorded scope |
| --- | --- |
| Security and governance | #317 reduce security risks before new release paths; #318 subscriber database isolation; #330 public verification/staff-only errors; #341 Azure ethical safeguards; #342 duplicate governed copies on retry; #343 staff sign-in governance choices |
| Private operations | #319 private drafts from reports/Player; #320 interrupted private-file recovery; #337 resume internal reviews without duplicate model calls; #338 compare KLARITY edits |
| Users and source lineage | #321 stale Boomerang work warnings; #322 review-history search; #323 invited lesson live check; #324 stale/foreign live Boomerang check; #325 source-file retention in real Player run; #326 source files in advisory returns; #333 signed-in supporting-work recovery; #334 Quest evidence accessibility; #344 convener/trainee signed-in checks; #348 non-F8 revision comparison; #349 Boomerang/gate-history export |
| External handoff and commerce | #335 qualified Slack/LangChain adapters; #336 artifact-bound hosting receipts; #346 subscription-price/checkout alignment; #347 paid subscriber workspace access |
| Recovery and F8 | #327 recovery while API asleep; #328 repeated recovery failure alerts; #331 individual alert inspection; #332 bounded recovery audit history; #339 interrupted F8 repair recovery; #340 corrected-bundle comparison; #345 cohort email duplicate-send recovery |
| UI, delivery and operations | #315 remaining high-contrast screens; #316 text/contrast acuity; #329 F-stage bundle loading; #183 SPC run outcome analytics; #184 SPC delivery review; #187 cross-tab Player retry status; #230 paused-alert retry performance |

That table enumerates the **39 accepted/queued/in-progress records** observed. Their current implementation may have advanced independently of task state: validate the behavior before creating a duplicate fix.

### Proposed Backlog Is Not a Release Gate by Default

There were **82 PROPOSED** records at observation time. They are suggestions, not accepted commitments. Some titles appear to overlap work already documented as fixed (for example, fresh-install baseline and large GitHub-push handling), so blindly treating all 82 as open bugs would be misleading. Review them by risk, deduplicate against shipped code and the accepted queue, and promote only verified blockers or chosen product improvements.

High-priority proposals to inspect include #92, #93, #112, #188 (repeated webhook failures), #195, #239, #296 (budget drift) and #302 (monthly provider-bill export). These are **investigation/acceptance candidates**, not newly reproduced failures.

## 6. Sequenced Action Plan

1. **Now:** R1 and R4, plus the read-only R2 finding review. Record the serving revision and produce an approved administrator installation procedure; do **not** relax checks.
2. **After reviewed installation:** R3 and R5. Keep protected lanes disabled if any check fails.
3. **Next working pilot:** R6 and R12 for honest core operational quality; then R7 and R8 on a single qualified source each.
4. **External release:** R9 then R10, one target first. Work backwards from required receipt, custody and rollback evidence before adding more adapters.
5. **Public marketplace:** R11 only when Exemplar rights and withdrawal work across both systems.
6. **Class B:** Azure Key Vault connection/rotation and target ethics proof, without retroactively treating deferral as launch approval.

Do not force the Software path through Firmware-only hardware checks, and do not remove mandatory governance when adapting an artifact to Azure or another target.

## 7. Audit Reproduction and Guardrails

The production observations used **SELECT only** against the managed production read-only replica: `pg_roles`, `pg_class`, `pg_policies`, `pg_trigger`, `information_schema.schemata` and `pg_tables`. The privilege matrix uses catalog role OIDs; it returns NULL rather than pretending to evaluate a nonexistent role. The published readiness/catalog and compiled frontend were accessed with ordinary GET requests.

No production data rows were selected. No migration or security DDL was run. Do not run a “repair” on the read-only replica or infer the app's request identity from `current_user` of the replica.

**Required handoff:** an authorized administrator and security reviewer can perform a separate, reviewed production installation; engineering then repeats the read-only catalog checks and a safe actual-runtime-role test. A reviewer—not this document—determines final protected-workflow clearance.

### Related records

- `docs/upgrade-program/protected-workflow-readiness.md` — expected nine checks and privilege matrix.
- `artifacts/api-server/src/lib/artifact-operations/database-protection-contract.ts` — reviewed catalog expectations.
- `artifacts/api-server/src/lib/artifact-operations/context.ts` — restricted-role and transaction-local actor checks.
- `docs/upgrade-program/progress.json` — invariant register requiring reconciliation.
- `docs/Platform_Completion_Gates_and_Pending_Fixes_2026-10-26.md` — original advisory.

**Bottom line:** The next production operation is an **approved security installation and verification**, not an unconditional F10/F12 or public marketplace activation. The usable core and private preparation path can be evaluated separately without claiming the closed gate passed.
