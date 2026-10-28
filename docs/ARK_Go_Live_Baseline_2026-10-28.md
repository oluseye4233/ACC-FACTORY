# ARK — Go-Live Baseline and Shared Status Contract

**Date:** 28 October 2026  
**Scope:** G00/G01 foundation; preliminary G02 infrastructure observations.  
**Release state:** Development change, not published by the agent. No new F-stage activation is claimed.

## Delivered

- A versioned service register at `GET /api/platform-services`.
- All 35 service contracts from the go-live plan: 14 F-stage surfaces and 21 supporting functions, with stable identifiers.
- The Guide's current-status section now consumes that register instead of its older hardcoded status list.
- Subscriber outcomes, limitations, stage/function filters, existing destination links and explicit missing-route behavior.
- Separate implementation, service mode, source eligibility, entitlement, assessment, delivery, operation, local acceptance and production acceptance fields.
- Explicit B/C descriptions and activation triggers.
- A date-only inventory revision distinct from response generation and evidence-check timestamps.
- The register performs no authorization, account lookup, credential inspection or gate override.

## Initial source coverage

| Observation | Count |
|---|---:|
| Existing implementation, not yet accepted against the new full A contract | 17 |
| Partial implementation / incomplete bounded A contract | 17 |
| Planned bounded A service: F12 Operations | 1 |
| Total | 35 |
| Local full-contract acceptance established by this register | 0 |
| Deployed-revision full-contract acceptance established by this register | 0 |

These are not functionality-completion percentages. Existing production features are not declared inactive merely because their complete new sprint contracts have not been reassessed. Source existence is not proof of satisfactory completion.

The static register is intentionally conservative and is a reviewed inventory, not a real-time per-user monitor. Source eligibility and entitlement remain evaluated in the actual session/workflow. Acceptance remains unverified until service-specific evidence is recorded through an appropriate future evidence contract; this foundation does not invent an acceptance authority.

## Fresh public production observations

At approximately **20:37 UTC on 28 October 2026**:

- `/api/healthz`: HTTP 200, status OK.
- `/api/readyz`: HTTP 200, database available, AI configured.
- Readiness explicitly retains the incomplete independent XVL/VTE, full F12 and original governed IMPRIMA/SHORT SPRINTS qualifications.
- `/api/sphinx/catalog`: HTTP 200, `publicOpen: false`, no public items.

These observations do not prove AI request success, authenticated flows, guarded transactions, provider acceptance or the deployed revision of this new register.

## Preliminary protected-database evidence

A read-only query of the managed production catalog returned:

| Check | Observation |
|---|---|
| `atanda_artifact_operations` role present | No |
| Expected protected public workflow tables present | 5 |
| Those tables with RLS enabled | 5 |
| Those tables with forced RLS | 0 |

This is catalog evidence, not an attestation of the application's actual runtime connection or positive access privileges. Existing checks must still verify exact policy predicates, membership, positive privileges, transaction-local context and immutable guards.

No role creation, grants, migrations, RLS weakening, production data writes or security installation was performed. Protected actions remain gated. The separately named internal/private service contracts do not establish protected qualification.

## Configuration metadata

The supported production secret-presence inspection reports the database/application-login, Clerk/session, configured AI and private-storage secret entries present. Presence is not correctness or successful access.

Dedicated F10 broker-token, authorization-key and receipt-signing secret entries were not registered in that inspection. This does not expose their values, inspect non-secret runtime representations, or attest to broker readiness. Existing fallback signing behavior must be assessed according to its real security contract; absence of a dedicated signing entry alone is not proof that every receipt path is disabled.

No secrets were requested, created, modified or displayed.

## Verification

- API register/readiness focused checks: **14 tests passed**.
- Guide/register focused checks: **7 tests passed**.
- API and frontend typechecks passed; code generation and shared-library typechecks passed.
- Existing managed web/API workflows restarted and serving. The prior detached development listeners were positively identified before targeted replacement; no production process was stopped.
- The running development proxy returned the actual 35-record service register with HTTP 200.
- Anonymous screenshot confirmed the staff access wall renders without a page crash. It could not inspect the signed-in Guide; its presentation and filters were verified at component-test level, not claimed as an authenticated browser acceptance.
- The independently running existing full test workflow reports **880 passed, 9 failed, 40 skipped** in its API run. The nine failures are missing replay fixtures in F4/F6/F8 provider-switching tests. This is not a full green regression result. No paid recording or test weakening was performed.

## Milestone interpretation

**Foundation delivered:** subscribers who can access the Guide will be able to inspect the intended service scope, implementation limitations and what evidence is still needed. The new view appears on production only after the user publishes it.

**No new F-stage gate unlocked:** this work establishes the baseline used to judge later unlocks honestly. It does not change certification, protected publication, custody, deployment or operating authority.

Next dependency work: shared artifact/source contracts, meaningful names and consistent saved-result return behavior, followed by source-bound F0/supporting-tool completion. Each actual F-stage unlock must state subscriber actions, limits, verification evidence and development-versus-live status.
