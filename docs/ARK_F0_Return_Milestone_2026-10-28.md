# ARK Go-Live Sprint — F0 Advisory Return Milestone

**Date:** 28 October 2026  
**Scope:** Source-bound F0 advisory work and exact-stage saved-report return.  
**Release boundary:** Development build only; this change does not establish production activation.

## Subscriber service

From an owned F stage with a saved production artifact, the subscriber can:

1. Open the **F0 Advisory** supporting-tool box and read its purpose, outcome and return instructions.
2. Launch advisory. The server records the exact departure and automatically creates a new engagement linked to that source, owner, session and stage.
3. Complete the existing SOCRATES discovery and request advisory using the unchanged generation and usage rules.
4. Retrieve saved reports after refresh. Leaving advisory and reopening its linked engagement restores the original departure from server history.
5. Choose a saved report and use **RETURN TO THE STAGE YOU LEFT WITH NEW ARTIFACT AND CONTINUE PRODUCTION**.
6. Confirm creation of a project-named **Upgraded N** supporting candidate and return to the exact originating stage.
7. Review the candidate and continue the normal correction/evaluation process. Subsequent supporting departures retain incrementing upgrade history.

The original production artifact and original advisory report remain separate and unchanged. This service returns advice and supporting evidence; it does not claim that advice has automatically rewritten the production artifact.

## CORDON and CODON boundaries

This increment composes the existing owner-scoped departure, source-baseline, upgrade-numbering, saved-artifact and explicit-review primitives. It does not introduce a parallel return system, a new database schema or a new release authority.

It advances the F0 portion of the shared supporting-return work. It does **not** mark the entire G03/G04/G06 build units complete: their wider artifact, seven-tool and F0 acceptance contracts still need their own evidence.

## Safety and persistence

- The departure's F0 engagement is created server-side in the same transaction as the departure.
- A returned report must be saved, nonempty, owned by the subscriber, fresh for the departure and associated with that exact engagement.
- The engagement must still refer to the exact owned source and session.
- An unrelated report is rejected even if it belongs to the same subscriber or refers to the same production source.
- Changed production baselines block the return. Users must start a new departure against the current source rather than overwrite history.
- Repeating the same completed return is idempotent. Returning a different report through the already-returned departure is rejected.
- The result is unverified, advisory and review-required. It cannot inherit an approval, pass a drift check, certify, deploy or advance a stage.
- F0 report generation remains outside the production artifact catalog. Only the explicit, confirmed supporting-return action creates a production-linked candidate.
- Invalid explicit support cases cannot silently become standalone engagements. Standalone F0 remains available without a stage-return action.
- Navigating between engagements resets panel-local discovery/report state and aborts the old client stream; existing server persistence rules remain unchanged.

## Evidence

- API source/return and Boomerang suites: **24 tests passed**.
- Public service-register suite: **7 tests passed**.
- F0 page suite: **8 tests passed**.
- Supporting-tool launch and shared return-action suites: **14 tests passed**.
- API and frontend TypeScript checks passed; generated API/Zod libraries compiled.
- API and web managed workflows restarted successfully. The API reported all **62** committed migrations applied.
- Focused authenticated development-browser journey passed; details below.

Saved-report tests use uniquely identified synthetic development fixtures. They do not constitute independent advisory evidence or a newly recorded paid-provider response. No paid provider calls, production writes, security-policy changes or new migrations are part of this milestone.

## Inventory interpretation

The reviewed service register now lists **18 existing implementations, 16 partial implementations and 1 planned implementation**, across the unchanged **35** service contracts.

“Existing” means implementation exists, **not** that the complete A contract or production operation has been accepted. Local and production acceptance are deliberately separate; this increment does not invent a green live status or a revised completion denominator.

## Remaining release limits

- Complete original-contract acceptance and deployed verification are still required.
- The earlier full-suite result included nine provider replay-fixture gaps. This increment neither records paid responses nor skips/relabels those gaps.
- The previously observed production operations-role/security limitations remain unresolved by this advisory-only change.
- Independent XVL/VTE, protected IMPRIMA/SHORT SPRINTS and full F12 qualification are not unlocked by returning an advisory report.
- An advisory return does not guarantee that an upgraded production artifact will pass its next check.

## Browser evidence

The focused browser journey passed through the existing development staff-code login. The initial Clerk test login reached the learner route and was not used to bypass the staff boundary.

Verified in the browser:

- The F4 tool launched a new source-bound F0 engagement and displayed the correct origin.
- A clearly marked synthetic saved report survived refresh.
- Reopening with only the engagement ID restored the departure and source from server history.
- The exact long return action and its review/non-approval confirmation were visible.
- Return selected the original F4 stage and the project-prefixed **Upgraded 1** candidate.
- A record check confirmed `UNVERIFIED`, `forgeVerified: false`, advisory-only, review-required, `certifies: false` and `advancesStage: false`.
- F4 remained selected and F5 remained locked. A deliberately incomplete synthetic fixture did not satisfy its unrelated production prerequisites.
- Reopening restored the same returned-artifact link; repeating the same return produced no duplicate.
- Standalone F0 opened without a supporting-return action.

The actual application detail route is singular `/session/{id}`; the browser used the archive's real link and the server-generated return link. No application errors were observed in the successful staff journey. All uniquely created development QA records and temporary authentication files were removed after capture.

Paid report generation and the optional second browser iteration/mobile check were not exercised. Incrementing **Upgraded 2** and the rejection cases were covered by the API tests, not claimed as browser observations.

Browser evidence identifiers:

- `oqzz2z`: stage-bound advisory launch explanation.
- `cp7piv`: saved-report return action.
- `cic4lk`: explicit review/non-approval confirmation.
- `ooqu6n`: originating stage with one returned candidate and unchanged prerequisites.
- `wq9b46`: server-restored advisory origin.
