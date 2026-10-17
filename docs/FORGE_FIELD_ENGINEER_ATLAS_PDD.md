# FORGE FIELD ENGINEER
## ATLAS PromptWare Design Document

**Product:** Invite-only cohort accounts for Intelligent Systems Architect and Engineer trainees  
**Subscription display name:** FORGE FIELD ENGINEER  
**Document version:** 1.1 — 17 October 2026 — Existing Quest Rules Conformance Edition  
**Status:** Implementation specification; not an implemented subscription, external certification or production-readiness attestation  
**Commercial policy:** Free, invitation-only pilot; no payment card, checkout, recurring charge or automatic paid conversion  
**Platform:** ATANDA Command Centre / ARK Harness  
**Curriculum authorities:** Platform Guide, Ascension Protocol, Quest badge registry and applicable engine gate contracts  
**Credential rule:** Existing Quest rules are authoritative and unchanged; cohort assessments add no badge prerequisites  
**Audience:** Programme owner, instructors, students, product team, implementation engineers and assessors

---

# PART 1 — CHEAT SHEET

## 1.1 Atomic solution summary

Create a named cohort membership that guides each individually authenticated student through a versioned ARK Harness curriculum. At every gate the student sees a worked example, attempts an equivalent task on their own project, receives evidence-based feedback and follows the existing Quest and Ascension progression toward eligible badges and certificates.

**The offer:** FORGE FIELD ENGINEER is the free, invite-only subscription that provides access to the training environment. It is not itself a badge, professional licence, paid commercial tier or proof of engineering competence.

## 1.2 Top five features

1. **Private cohort admission:** Named invitations, individual accounts, instructor assignment, revocation and an explicit free entitlement.
2. **Guided gate curriculum:** Guide and Ascension content mapped to every F gate, with worked examples, practical exercises, evidence expectations and clear availability labels.
3. **Personal learning workspace:** Each student has their own sessions, artifacts, progress and evidence portfolio, rather than using an instructor's shared account.
4. **Quest-aligned progression:** Required repeat exercises, architecture and engineering tracks, credential evidence and a capstone mapped to actual badge conditions.
5. **Instructor oversight:** Cohort roster, assigned-work visibility, feedback, remediation, learning-completion decisions and a separate credential-eligibility review.

## 1.3 Three benefits

- Students understand why each gate exists before being expected to operate it.
- Instructors can distinguish example viewing, authentic student work and assessed competence.
- ATANDA can operate a controlled training pilot without opening public subscriptions, weakening production safeguards or misrepresenting credentials.

## 1.4 Production card

| Item | Specification |
|---|---|
| Plan code | `forge_field_engineer` — proposed stable internal identifier |
| Access | Invitation acceptance plus an active cohort membership |
| Price | 0; no payment mandate; programme-funded inference |
| Tracks | Shared foundation, Intelligent Systems Architect, Intelligent Systems Engineer |
| Learning sequence | Guide orientation → Ascension baseline → worked gates → personal practice → Quest evidence → capstone |
| Credential targets | ASPE, AISA, AISE; optional senior credentials where actual prerequisites are met |
| Existing surfaces reused | `/guide`, `/ascension`, `/quests`, `/sessions`, `/f0`, `/boomerang`, `/spc-player` |
| Proposed surfaces | `/learn`, `/learn/cohorts/:id`, `/learn/lessons/:id`, `/teach/cohorts/:id`, `/invite/:token` |
| Ownership | Student owns their work; instructor sees only work explicitly assigned/submitted to their cohort |
| Non-negotiable boundary | Training completion never substitutes for protected certification, custody or release evidence |
| Initial delivery | Cohort pilot, not public self-enrolment or public marketplace activation |
| Document assurance | Editorial design review only; independent validation and release approval pending |

## 1.5 Launch definition

A programme owner can create one private cohort, invite students, deliver a complete worked gate curriculum, observe student-owned evidence and record assessed learning completion. Students can pursue credentials through the existing authoritative rules. Any unavailable protected capability is taught as a clearly labelled demonstration or simulation; it cannot be reported as operational completion.

**Not a launch condition:** Activating full F12, independent XVL/VTE, Sphinx public commerce or Azure-dependent production functions. Their absence must remain visible and may defer an advanced credential or module.

## 1.6 Token economics

No inference-saving percentage, annual saving or semantic-preservation score has been measured for this proposal. Use concise, versioned lesson context, bounded example retrieval and stored instructor-approved exemplars. Preserve the complete rubric and provenance. Baseline tokens, provider spend and savings must be measured during the pilot; they are not assumed to be 45%.

---

# PART 2 — EXECUTIVE SUMMARY AND SYSTEM DESIGN

## 2.1 Problem and vision

The platform has a Guide, Ascension journey and Quest board, but these do not by themselves constitute a managed cohort programme. A novice needs a coherent example, an equivalent personal exercise, a safe environment, feedback and a truthful route from practice to credential evidence.

The solution is an education layer over the existing Harness, not a second set of engines or an alternate certification authority. The same student evidence should be visible in the learning workspace and linked to the relevant existing platform records.

### Explicit user requirements

| ID | Priority | Requirement | Acceptance evidence |
|---|---|---|---|
| R01 | MUST | Offer the exact subscription name FORGE FIELD ENGINEER | Student account and cohort screens display the name |
| R02 | MUST | Keep the pilot free and invite-only | Public enrolment denied; no checkout or card required |
| R03 | MUST | Support Intelligent Systems Architect and Engineer trainees | Both track maps and distinct capstone rubrics exist |
| R04 | MUST | Use the Guide and Ascension Protocol as curriculum authorities | Every lesson records source section and curriculum version |
| R05 | MUST | Provide a worked example for each gate | Published pack covers F0–F12 including F9.5 and relevant side-steps |
| R06 | MUST | Guide students along the Quest badge and certification path | Server-derived progress links to actual credential requirements |
| R07 | MUST | Preserve personal ownership and evidence | One student's progress is never inherited from another |
| R08 | MUST | Distinguish actual work from examples and simulation | UI and exports carry evidence class and availability state |
| R09 | MUST | Preserve existing protected gates | Cohort membership cannot create certification or release authority |
| R10 | SHOULD | Allow instructor feedback and remediation | Versioned review decisions and resubmission history |
| R11 | SHOULD | Support desktop, phone, light and dark modes | Accessible, keyboard-operable lesson and roster views |
| R12 | SHOULD | Provide programme completion records | Cohort completion record is separate from Quest credentials |
| R13 | NICE | Add optional peer review after the pilot | Explicit opt-in, scoped visibility, no badge authority |

## 2.2 Repository-grounded starting point

This specification was informed by source inspection, not a fresh audit of the deployed site.

| Existing area | Observed basis | Cohort implication |
|---|---|---|
| Guide | Walkthroughs and stage descriptions, including protected-operation caveats | Reuse approved source content; do not reproduce outdated screenshots as truth |
| Ascension | Thirteen rungs computed from actual platform signals | Add a cohort projection, not a parallel editable checklist pretending to be the original journey |
| Quests | Artifact counts, claimed badges and credential-specific rules | Use the authoritative badge service; never copy eligibility into an independent permissive service |
| Engine access | Tier and rate-limit checks exist | Introduce a scoped education entitlement without globally upgrading the student to an unrestricted commercial tier |
| Boomerang | Origin-bound support requests, source-change checks and owner review | Use for remediation; it does not automatically execute or grant clearance |
| IMPRIMA / Short Sprints | Private preparation and protected-operation distinctions | Optional preparation exercises only where supported |
| Identity | Current staff access is not a sufficient student identity model | Individual student authentication and invitation binding are launch prerequisites |
| Verification / release | Evidence and protected gates are distinct | An engineering lesson cannot claim a verified deployment merely because it displayed a worked example |

**Availability rule:** Before publishing a curriculum version, verify every linked route and advertised action against the deployed release. Use `AVAILABLE`, `CONDITIONAL`, `DEMONSTRATION_ONLY`, `BLOCKED` or `RETIRED`. This document does not assert that every source-present feature is currently live.

### Existing Ascension spine

| Order | Rung | Training interpretation |
|---|---|---|
| 1 | Know Your Number | Baseline JST self-assessment; personal reflection, not an intelligence ranking |
| 2 | Monster Hunter | Diagnose ambiguous intent at F1 |
| 3 | Atom Smith | Produce a bounded F2 atomic prompt |
| 4 | Floor Manager | Develop MA, Micro PDD and SPC evidence across F3–F5 |
| 5 | Pillar Architect | Work toward all seven Context Craft pillar badges |
| 6 | Atlas Bearer | Produce an F6 ATLAS PDD |
| 7 | Tool DJ | Complete the current VIBE recommendation condition |
| 8 | Spartan | Obtain a qualifying certified F7 artifact through the existing gate |
| 9 | Code ORACLE | Use the F8 build branch when entitled and eligible |
| 10 | Drift Guardian | Execute the supported PFP drift exercise |
| 11 | BONSAI Cultivator | Use DE-SPC only after its actual badge/access prerequisite |
| 12 | JST Ascendant | Complete a second JST assessment and reflection |
| 13 | Hive Builder | Participate in a qualifying team context without receiving org-admin privileges |

**Existing rule to preserve:** The current Tool DJ rung checks a VDJ run-count condition equivalent to at least two recorded runs. Do not promise that one example click completes this rung. Preserve the real signal; curriculum versioning does not replace the current authoritative progression service.

## 2.3 Actors and authority

| Role | Allowed | Forbidden |
|---|---|---|
| Programme owner | Create cohorts; assign instructors; set capacity, dates and funded budgets; issue/revoke invitations | Mint student credentials without their authoritative evidence |
| Instructor | Publish assigned curriculum; view submitted cohort work; provide feedback; assess learning completion | Browse unrelated private libraries, alter global billing, grant production release authority |
| Student | Accept own invitation; run allowed learning actions; submit own evidence; review feedback; pursue eligible badges | Access another student's private artifacts or protected infrastructure |
| Assessor | Review assigned credential evidence under existing authorised procedures | Treat attendance or an instructor's sample as competence evidence |
| Platform service | Resolve scoped entitlements; project progress; enforce cost and provenance rules | Silently convert a free student to paid status |

An instructor is not automatically an assessor, platform administrator, subscriber billing owner or production operator. A student may belong to more than one cohort; submissions and instructor visibility are scoped to the particular membership.

## 2.4 Cohort account and free subscription lifecycle

### Cohort

`DRAFT → INVITING → ACTIVE → COMPLETED → ARCHIVED`

An owner may suspend an active cohort. An archive is read-only; it does not delete student-owned artifacts. A completed cohort does not automatically issue any Quest credential.

### Invitation

`ISSUED → ACCEPTED | EXPIRED | REVOKED`

Proposed default: single-use invitation, seven-day expiry, configurable capacity and cohort end date. Bind it to a verified intended identity. Store a token hash rather than the invitation bearer token. Never put the raw token in analytics, audit text or application error logs. Strip it from the browser address after redemption.

Redemption must be transactional: validate token, identity, expiry and remaining capacity; establish the single active membership. Repeated acceptance by the same identity is idempotent; a competing identity is denied without revealing private roster data. Instructor acceptance and roster imports must not create account takeovers.

### Membership and entitlement

`INVITED → ACTIVE → SUSPENDED | COMPLETED | REVOKED`

An active membership yields a cohort-scoped educational entitlement called FORGE FIELD ENGINEER. Suspension/revocation immediately blocks new funded actions. Students retain access to their own records and exports subject to the published retention policy.

**Commercial rules**

- No paid Stripe product or paid checkout is required for the initial internal entitlement.
- No card collection, automatic renewal charge or hidden future billing agreement.
- If paid access is later offered, require a separately disclosed price and explicit consent.
- Leaving a cohort does not cancel, downgrade or overwrite a separately purchased subscription.
- Existing commercial access cannot be used to bypass student privacy or assessment integrity.
- The entitlement must be checked server-side; a sidebar label is not enforcement.

## 2.5 Entitlement design and safeguards

Use an explicit capability overlay, not `student.tier = architect` as a shortcut.

| Capability | Proposed cohort treatment |
|---|---|
| Guide, lessons, Ascension and Quest views | Available to active students |
| Personal training sessions and F1–F7 | Available within approved curriculum scope and funded limits; preserve artifact gate prerequisites |
| F6-VDJ, MM and PFP | Scoped to approved lessons, quotas and actual availability |
| F8 build/export | Available only after the required qualifying source and programme-approved educational capability |
| F9 hardware actions | No student physical-device operation by default; simulation or approved supervised environment |
| F9.5, F10, F11, F12 | Demonstrations by default; real operation needs independently authorised capabilities and all original gates |
| SPC Player | Owned, bounded learning runs where funded; no external transmission by default |
| Boomerang | Supporting-work and remediation loop; never a substitute for pass evidence |
| IMPRIMA / Short Sprints | Private preparation exercises only; preserve protected-operation restrictions |
| Public library / Sphinx sales | No publication or commercial listing by default |
| Costs, billing and provider secrets | No global or other-student visibility |

**Decision formula:** Allow a training action only when the individual identity is valid, membership is active, the lesson grants that capability, the resource is in the permitted student/cohort scope, the original engine's non-commercial prerequisites pass, and all applicable budget and safety gates pass.

Refactor commercial-tier checks through an explicitly reviewed resolver if necessary. Never disable existing controls globally or treat a training entitlement as an escalation bypass. Keep the normal cost-cap denial response and learning-friendly guidance.

**Cost policy:** Free means no student charge, not unlimited inference. Require a funded programme cap, per-student usage allowance, concurrency limits and reservation accounting across every LLM call path. Programme owner selects numeric allowances before activation. When exhausted, deny new funded runs explicitly, preserve reading/export access and show the next available support action. Do not silently switch to unfunded providers.

## 2.6 Student journey and interfaces

1. **Invitation:** Student sees programme name, free terms, cohort dates, privacy notice and intended identity before accepting.
2. **Orientation:** Open START HERE / Guide; learn artifact vocabulary, gate boundaries, budget rules and how to ask for support.
3. **Baseline:** Complete the existing JST assessment; choose Architect, Engineer or both; see the actual Quest requirements.
4. **Worked example:** Read a synthetic project brief; inspect the gate's input, expected output, pass/fail cases and why the gate exists.
5. **Personal attempt:** Clone the starting brief, not a completed sample artifact, into a student-owned session. Execute the gate or submit a clearly labelled simulation.
6. **Feedback:** System shows actual gate results. Instructor reviews submitted evidence against the lesson rubric. A Boomerang remediation request can preserve source and revision history.
7. **Progression:** Complete repeat exercises for real badge thresholds. The next lesson can unlock on learning prerequisites, but an engine still applies its own gates.
8. **Capstone:** Submit a traceable portfolio, conduct a review and request a credential only when its authoritative conditions are met.
9. **Exit:** Complete a JST reflection; export the learning portfolio; receive a cohort completion record if earned. Retain a clear list of credentials awarded, eligible, pending or blocked.

### Proposed student home

Show cohort, track, free access status, curriculum version, current lesson, next action, remaining funded allowance, pending feedback and a credential progress panel. Separate “lesson complete” from “credential earned.” Do not expose a public leaderboard of JST scores.

### Lesson page

Use seven persistent sections: **Purpose; Guide/Ascension reference; Worked example; Your exercise; Evidence and rubric; Feedback; Next step.** Include a visible mode badge and an “Open the correct Harness stage” link using the canonical engine mapping.

### Instructor console

Roster and membership states; assigned curriculum version; aggregate learning progress; submitted evidence; remediation queue; scoped budget remaining; audit history; completion records. Do not make the full student library visible simply because the student accepted an invitation.

## 2.7 Worked project and gate curriculum

**Reference project:** FIELD SERVICE REQUEST DESK — a synthetic maintenance-intake assistant for a community workshop. It converts fictional service requests into a structured triage record for a human coordinator. It does not diagnose hazardous machinery, trigger repairs, collect real customer data or autonomously dispatch staff.

**Fixed example input:** “Workshop B reports that demonstration bench DEMO-07 has stopped. No injury, smoke or heat is reported. Requester asks for a coordinator review tomorrow. Contact is the fictional handle sample-requester.”

**Expected structured record:** asset DEMO-07; location Workshop B; issue “stopped”; reported hazards “none reported, not independently verified”; requested timing “tomorrow — timezone/date unresolved”; disposition “human coordinator review”; confidence bounded; missing fields explicit. Urgency must not be inferred from an invented date or assumed safety inspection.

Each student receives the same visible source pack and creates a distinct owned variant. Examples are published training fixtures, not engine-created student achievements.

| Gate / module | Worked example | Student exercise and required evidence | Completion boundary |
|---|---|---|---|
| F0 — Advisory | A fictional sponsor wants fewer unstructured maintenance requests. Discovery exposes unclear triage responsibility; bear case identifies over-reliance on AI. | Complete discovery for a different fictional workshop; submit problem, alternatives, constraints and explicit human authority. | Instructor checks reasoning; a sample advisory report is not the student's certified report. |
| F1 — Diagnose | Diagnose “build an intelligent helpdesk”; identify missing output schema, allowed inputs and safety boundaries. | Run a diagnosis on the student's own brief; explain every unresolved ambiguity. | Save the actual diagnostic artifact and rubric evidence, not a screenshot of the instructor's score. |
| F2 — Atomic prompt | “Convert the supplied fictional maintenance request into one JSON triage record matching the schema; mark absent facts unknown.” | Write one bounded transformation prompt with typed input and a verifiable schema. | Reject compound instructions such as triage plus scheduling plus notification. |
| F3 — MA / CELL | Define the Intake Normaliser persona, transformation capability and refusal boundaries. | Create a distinct MA birth package with a single responsibility. | Owner-specific artifact and bounded scope; no copied package counted as authentic production. |
| F4 — Micro PDD | Describe schema fields, missing-information handling, validation errors and a human-review endpoint. | Produce a Micro PDD for the student's MA; trace each requirement to a testable outcome. | Real Micro PDD evidence; instructor approval is a learning decision, not external certification. |
| F5 — SPC | Turn the intake MA contract into an SPC with allowed data, failure cases and human escalation. | Produce the first qualifying SPC and a misuse example it refuses. | Apply existing engine gates; a viewed worked SPC does not meet the student's badge count. |
| F6 — ATLAS PDD | Four-part design for intake, review queue and an auditable coordinator decision, with a bounded MVP. | Author the student's ATLAS PDD; explain lineage from their Micro PDD and SPC. | Saved ATLAS artifact and reviewable requirement traceability. |
| F6-VDJ — Tool selection | Compare a simple hosted web implementation with a spreadsheet workflow against constraints. | Obtain the actual supported recommendation evidence; justify one chosen stack and one rejected alternative. | Respect the currently configured Ascension signal; tool selection is not provider certification. |
| MM — Maths / measures | Define completion rate as valid records divided by submitted synthetic requests; show denominator and missing-data treatment. | Compute the measure over a fixed synthetic set with an expected answer, including a zero-denominator test. | Reproducible calculation, not a plausible narrative or invented financial claim. |
| F7 — SPARTAN MVP | Reduce the PDD to intake, coordinator queue and audit trail; exclude autonomous dispatch and payment. | Generate the student's qualifying MVP PDD and retain actual certification/verification evidence if the gate passes. | No automatic learning-based certification; show failure/remediation or actual status truthfully. |
| F8 — CODE ORACLE / CODE DJ | Trace the certified spec to a runnable intake scaffold and its tests. | Build the student's eligible scaffold or IDE export; demonstrate schema validation and human-review boundaries. | A build export is not independent verification or a public release. |
| F8-HDJ — HOST DJ side-step | Compare deployment options using data sensitivity, budget and operator skill. | Record a hosting recommendation and its assumptions without sending credentials. | Advisory selection only; not activation of a deployment channel. |
| F9 — Machine floor | Optional firmware variant uses simulated workshop sensor input with an explicit hardware profile and expected fault cases. | Engineer-track students submit a simulated evidence package; real hardware only under separately authorised supervision. | Software follows its actual software branch; do not force all students through a fictitious mandatory hardware gate. |
| F9.5 — OSIRIS custody | Show a specimen artifact hash and a deliberate change that breaks the specimen's continuity. | Explain the failed comparison and route the deviation to the authorised review/advisory point. | Demonstration receipt is labelled training-only; it is not live custody or a usable release attestation. |
| F10 — Release gateway | Compare a complete specimen release packet with one lacking signature/custody evidence. | Assemble a mock packet and explain why the incomplete packet must be denied. | No simulated signature, receipt or packet may satisfy the real gateway. Actual lineage rules remain authoritative. |
| F11 — Host connector | Show a test-only target configuration with a deliberately unreachable health endpoint. | Submit configuration reasoning, safe error handling and rollback criteria without production secrets. | A configuration lesson is not an authorised delivery or public availability claim. |
| F12 — Full operation | Present a mock launch review showing missing independent verification as a blocking item. | Conduct a supervised tabletop go/no-go decision; produce a checklist with reasons and unresolved conditions. | Mark DEMONSTRATION_ONLY or BLOCKED until real operational prerequisites exist; no full F12 completion claim from this exercise. |
| Boomerang remediation | An instructor returns a schema correction to the original F4 source; source drift forces a new request. | Perform request → return → revision → return → review on the student's own evidence. | Acceptance is supporting input; it does not advance an engine or approve release. |

### Branch rules

- F0 is an advisory engagement, not a fabricated numeric session stage.
- Canonical cockpit IDs are not F numbers: F6-VDJ=8, F8=9, MM=10, F9=11, F10=12, F11=13. Use the existing registry, not string-to-integer shortcuts.
- Teach ingestion and cartridge entry as alternative starting routes after the main foundation exercise.
- Teach ATLAS PLAN/SCAN, private IMPRIMA and Short Sprints as optional applied modules, not replacements for core assessment.
- A student can learn a blocked gate from its specimen without being credited with executing that gate.

## 2.8 Quest evidence and credential path

| Credential | Current repository condition | Curriculum response | Honest completion label |
|---|---|---|---|
| ASPE — ATOMIC SUPER PROMPT ENGINEER | The student's owned `SPC` artifact count is at least 3 and owned `MA_BIRTH_PACKAGE` count is at least 4 | Four MA exercises: intake normaliser, missing-field checker, review summariser, audit-note formatter; develop three into distinct SPCs | Display existing eligibility/status; instructor approval is not an additional Quest prerequisite |
| AISA — ATOMIC INTELLIGENT SYSTEMS ARCHITECT | The student's owned counts include at least 1 `ATLAS_PDD`, 1 `MICRO_PDD` and 1 `MVP_PDD`; this predicate does not add an F7 certificate requirement | Main project supplies one of each; architecture assessment is separately labelled cohort feedback | Never withhold a qualifying Quest badge because an additional course assessment is incomplete |
| AISE — ATOMIC INTELLIGENT SYSTEMS ENGINEER | Successful existing URL claim flow creates or updates a `CLAIMED` AISE record | Submit at least one supported URL field to the existing claim endpoint; use its allowlist and reachability validation unchanged | URL classification/reachability is not independent verification of authorship, safety, functionality or professional competence |
| AISA_PWDD | At least 3 distinct student session IDs containing an `MVP_PDD` artifact with non-null `spartanCert`; the current count does not filter session origin | Optional advanced work in 3 qualifying sessions; do not require 3 different origin types | Use the returned status; do not silently reinterpret the badge identifier as a stricter origin rule |
| AISE_BUILD | Successful existing engineer claim using a reachable public HTTPS URL and a 1–500 character evidence note; optional session ID | Use the current engineer claim endpoint unchanged | This checks reachable-URL evidence; it does not provide independent CI, code, ownership or build validation |
| Context Craft | Each pillar earns at a per-pillar JCSE score of at least 6 from the existing artifact-driven award path; badges persist once earned | Targeted F1/F2 improvement exercises across SYSTEM, ROLE, INSTRUCTION, EXAMPLE, CONSTRAINT, FORMAT and DATA | Preserve existing threshold and persistence; do not normalise 6 to 6/10 or replace it with a course score |

**No credential inflation or additional barriers:** A viewed/copied sample must not directly create forged artifact counts, award events or claimed records. A legitimate student-owned artifact produced through the normal engine flow counts exactly as existing Quest rules specify, even when the exercise was guided by a worked example. Do not add originality tests, instructor approval, a new certification condition, prior badge requirements or cohort completion as extra Quest predicates. Current count-based rules are not a full competence assessment; a separate learning rubric must not override them.

### Existing Quest authority and claim contract

- Read major badge progress from `GET /api/me/badges` and pillar progress from `GET /api/me/context-craft-badges`. The cohort UI projects these responses rather than recomputing a competing result.
- AISE uses `POST /api/me/badges/aise/claim`. Accepted optional URL fields are `spcDnaAgentUrl`, `gptUrl`, `copilotUrl` and `nativeAppUrl`; at least one must pass the current classifier and reachable-public-HTTPS check. The optional notes limit remains 2,000 characters.
- Existing supported URL classes cover GPT links, Copilot links, native app store/browser-extension links and public HTTPS SPC-DNA agent domains. Keep the actual server allowlist authoritative rather than copying it into a stale client-only validator.
- AISE_BUILD uses `POST /api/me/badges/engineer` with `url`, required `evidenceNote` of 1–500 characters and optional UUID `sessionId`. Keep the existing public HTTPS/reachability and private-address protections.
- Preserve `LOCKED`, `UNLOCKED`, `CLAIMED` and `REVOKED` exactly as returned. A revoked badge remains visibly revoked; an instructor cannot restore it. Use existing authorised revocation/restoration/re-claim procedures only.
- Context Craft thresholds are 6 for all seven pillars; existing maximums are 7 for SYSTEM, ROLE, DATA, FORMAT, EXAMPLE and CONSTRAINT, and 8 for INSTRUCTION. Keep these scales intact.
- Do not impose an ASPE → AISA → AISE prerequisite chain where the existing Quest endpoint does not require one. It is a recommended teaching sequence, not a new eligibility restriction.
- Respect existing badge-dependent feature access, including DE-SPC access. The free subscription does not grant an earned badge or suppress a badge gate.
- Course feedback may mark a lesson `REVISION_REQUIRED` while the existing Quest badge is already `UNLOCKED` or `CLAIMED`. Show both truthfully. Neither status overwrites the other.

**Programmes and titles:** Use the product's existing AISA/AISE names accurately. The course may be described as Intelligent Systems Architect and Engineer training; it must not claim accreditation, statutory licensing, institutional endorsement or independent professional certification that has not been obtained.

### Assessment and retry policy

For each lesson, record **NOT_STARTED, IN_PROGRESS, SUBMITTED, REVISION_REQUIRED, LEARNING_COMPLETE, or BLOCKED**. Keep a separate evidence mode: **ACTUAL_PLATFORM, SIMULATION, or VIEWED_EXAMPLE**. These are cohort learning states only and are not extra Quest eligibility rules.

Proposed rubric: requirement clarity, artifact lineage, correct gate use, evidence quality and safe handling. Each dimension has explicit pass conditions in the lesson version. Do not invent global JCSE passing thresholds; inherit active engine and Context Craft rules. A student may resubmit new evidence with retained prior feedback. Reassessment never overwrites earlier decisions.

Programme completion requires orientation, baseline and reflective reassessment, required assessed lessons, an approved capstone portfolio and truthful disposition of advanced blocked modules. Issue a **cohort completion record**, explicitly separate from credentials still pending.

## 2.9 Data and API contracts

### Proposed entities

| Entity | Minimum fields and invariants |
|---|---|
| Cohort | ID, owner, title, lifecycle, capacity, dates, funded policy, published curriculum version; no public enrolment flag enabled by default |
| CohortRole | Cohort, user, role; unique active assignment; least privilege |
| Invitation | Cohort, intended verified identity, token hash, expiry, state, issuer, accepted membership; no raw token storage |
| Membership | Cohort, student, lifecycle, accepted terms version, activation/end timestamps; unique cohort/student |
| CurriculumVersion | Immutable published version, Guide/Ascension/Quest source references, reviewed availability snapshot, track definitions |
| LessonVersion | Stable lesson key, version, stage label, prerequisites, evidence mode, example hash, rubric, next action |
| StudentAssignment | Membership, pinned lesson version, owned session/engagement reference, learning status, attempt number |
| EvidenceSubmission | Assignment, owner, actual artifact/run IDs, captured hashes, mode, timestamps, submission version |
| ReviewDecision | Submission version, authorised reviewer, decision, rubric results, feedback, timestamp; append-only |
| EducationEntitlement | Membership, plan code, scoped capability set, validity and funded limits; distinct from paid subscription |
| CompletionRecord | Student, cohort, curriculum version, assessed outcomes, unresolved/blocked modules, issue/revocation audit |
| CohortAuditEvent | Actor, cohort, action, subject, timestamp, safe metadata; never raw invitation tokens or secrets |

Use the existing user and artifact records. Do not duplicate engine artifacts into a new training database as if they were independent creations. A versioned example pack is immutable reference material; student attempts have new ownership and provenance.

### Proposed API families

- `/api/learn/me` — student memberships, pinned curriculum and funded allowance.
- `/api/cohorts` — authorised programme management.
- `/api/cohorts/:id/invitations` — issue and revoke named invitations.
- `/api/invitations/redeem` — identity-bound single-use redemption.
- `/api/cohorts/:id/memberships/:membershipId` — scoped lifecycle changes.
- `/api/learn/assignments/:id` — lesson state and owned evidence links.
- `/api/learn/assignments/:id/submissions` — append a versioned submission.
- `/api/teach/submissions/:id/reviews` — authorised version-matched review.
- `/api/learn/credentials` — projection of authoritative Quest status plus cohort assessment status.
- `/api/cohorts/:id/completions` — issue a labelled cohort learning-completion record.

Use generated OpenAPI clients following the existing repository conventions. Validate ownership and membership on every read/write/download. A guessed object ID must not reveal another student's work. Review requests include an expected version and artifact hash; return a conflict on stale evidence.

### State and evidence invariants

1. A revoked/expired invitation cannot create active access.
2. One student can accept one seat in a cohort only once.
3. Examples and simulations cannot create actual gate-execution events.
4. Instructor feedback does not write into engine certification fields.
5. An artifact source change invalidates a pending assessment until resubmitted.
6. Cross-cohort and cross-student reads fail unless an explicit current assignment permits them.
7. A free membership cannot authorise a charge.
8. A completed learning assignment cannot unlock a protected engine by bypassing its real source gates.
9. An archived curriculum version remains interpretable; published content cannot be silently replaced.
10. Public certificate lookup discloses only the approved minimal verification payload, never a roster or private portfolio.

## 2.10 Privacy, safety and operational controls

- Individual identity is mandatory; never distribute the shared staff access code to students.
- Use synthetic data in every worked example. Do not require disclosure of employer information, personal health data or real credentials.
- Instructor visibility is assignment-scoped. Students explicitly submit artifacts for review; private unrelated work stays private.
- Avoid public student lists, rankings, scores or certificates by default. Obtain a specific opt-in before public publication.
- Set and disclose retention, withdrawal, export and deletion policies before invitations are issued. Jurisdiction-specific obligations require appropriate legal review.
- Age eligibility must be established before launch. If minors are admitted, approve the necessary guardian, privacy and safeguarding process first.
- Preserve audit records without retaining bearer tokens, secret values or unnecessary identity data.
- Reuse controlled file-upload validation; treat PDF/document content and returned support as untrusted input.
- Reject prompt injection that attempts to reveal other students' work, change entitlements or manufacture assessment results.
- Do not expose production provider keys, Azure access, GitHub authorisations or company-wide spend to learners.
- Direct SQL access is not a student feature. Any new database tables need additive committed migrations and reviewed production ownership/access protections.
- Before launch, investigate any failing application workflows and tests. A written PDD is not evidence that the current deployment is healthy.

## 2.11 Risks and mitigation

| Risk | Mitigation / release condition |
|---|---|
| Free access becomes unrestricted production privilege | Explicit scoped capability overlay; deny-by-default actions; adversarial access tests |
| Shared identity prevents authentic assessment | Individual login plus intended-recipient invitation binding |
| Students earn badges by duplicating samples | Immutable example provenance; original-attempt assessment; no synthetic award events |
| Existing Quest predicates are accidentally strengthened or weakened | Project authoritative responses unchanged; separate course feedback from badge eligibility |
| F12 simulation is advertised as operational clearance | Persistent demonstration label; explicit protected capability checks |
| Cohort spend grows without limit | Owner-approved funded limits; reservations; concurrency bounds; no silent fallback |
| Curriculum drifts from engine or badge rules | Pin source versions; review differences before new publication; show blocked status |
| Mentor can access every learner artifact | Explicit submission scope; membership revalidation; revoked access tests |
| Invite links leak or are replayed | Token hashing, short expiry, redacted logs, one-use redemption and concurrency testing |
| Progress is lost on withdrawal or archive | Preserve student ownership, read/export policy and auditable lifecycle transitions |

## 2.12 Capability and SPC role matrix

These are proposed design/assurance roles, not evidence that the cards have executed or certified this PDD.

| Capability | Lead role / supporting doctrine | Success measure |
|---|---|---|
| Curriculum architecture | ATLAS + STRATEGOS | Every required gate mapped to example, exercise and evidence |
| Technical and data integrity | ADA + CODE DJ | Ownership, versioning and entitlement tests pass |
| Bounded MVP and delivery | SPARTAN | A complete private pilot without protected-operation bypasses |
| Explanations and lesson clarity | SKRIBE + KLARITY | Novice can identify input, expected output and next action |
| Guided discovery | SOCRATES | Student can explain the problem before building |
| Security review | ARES + relevant CORDON/CODON specifications | No unreviewed role, token or protected-operation escalation |
| Debugging | BUGMXT | Reproducible failures and verified fixes |
| Source/evidence custody | OSIRIS doctrine | Teaching evidence cannot impersonate live custody |

**Source gaps:** Exact student identity provider configuration, invitation delivery channel, pilot roster, authorised assessors, budget values, age policy, retention schedule and launch curriculum sign-off remain owner decisions. No additional SPC is necessary to author this PDD. Independent claims must remain pending until the appropriate real verifier and authority are available. FRACTAL synergy multipliers, NFT issuance and unmeasured ZPOS quality claims are not launch requirements and are not asserted.

## 2.13 Quality and certification posture

| Design review dimension | Evidence in this PDD | Outstanding validation |
|---|---|---|
| Clarity | Explicit offer, user journey and boundaries | Student/instructor walkthrough |
| Atomicity | Forty-five scoped worksheet operations | Implementation review of each resulting change |
| Completeness | Entitlements, curriculum, examples, evidence, assessment, costs and lifecycle | Pilot data and source checks |
| Traceability | R01–R13, gate and credential mappings | Versioned production source registry |
| Security | Identity, privacy, tokens, role scope and protected gates | Threat model and adversarial tests |
| Reliability | Version checks, idempotent invites and state invariants | Concurrency/recovery verification |
| Usability | Guided lesson structure and accessibility requirements | Desktop/phone/assistive-technology testing |
| Efficiency | Stored examples and bounded retrieval | Measured token/cost baseline |
| Maintainability | Existing engines and generated contracts reused | Migration and upgrade rehearsal |
| Governance | Honest completion and credential authority separation | Authorised pilot release decision |

Target a JCSE review of at least 45/50 if the approved rubric applies. **No measured JCSE score, independent FORGE certification or external accreditation is claimed for this document.** Certification cannot be inferred from its name, authoring format or editorial self-review.

---

# PART 3 — ATOMIC PROMPT WORKSHEET

## 3.1 Execution contract

Each operation below specifies input, one action, verifiable output and prerequisites. Execute only after its dependencies are complete. Codes are engineering work units, not student badge tasks. `SOURCE` means this PDD plus current repository contracts. Never treat a prompt's expected output as already implemented.

P0 = RED / critical; P1 = YELLOW / core; P2 = GREEN / complete pilot; P3 = BLUE / release assurance. No instruction grants authority to modify production data, publish automatically or issue credentials.

### Phase 1 — Foundation: ATL-001–ATL-008

| ID / priority | Input → single operation → verifiable output | Depends on |
|---|---|---|
| ATL-001 / P0 | Input: SOURCE. Classify the cohort requirements. Output: requirement ledger preserving R01–R13 and explicit unknowns. | None |
| ATL-002 / P0 | Input: requirement ledger and current routes. Inventory reusable learning surfaces. Output: source-linked capability inventory with availability unverified until checked. | 001 |
| ATL-003 / P0 | Input: role table. Define the cohort authority policy. Output: allow/deny matrix for every actor and resource class. | 001 |
| ATL-004 / P0 | Input: free-offer requirements. Define the educational entitlement contract. Output: capability schema that cannot imply payment or global tier elevation. | 003 |
| ATL-005 / P0 | Input: current Guide and Ascension definitions. Map the curriculum spine. Output: versionable lesson/rung mapping covering the thirteen existing rungs. | 002 |
| ATL-006 / P0 | Input: authoritative Quest predicates. Map credential evidence requirements. Output: badge-to-evidence ledger including repeat counts and assurance limitations. | 002 |
| ATL-007 / P0 | Input: identity, role and resource policy. Model cohort threats. Output: prioritised threat register including token replay, IDOR and forged credentials. | 003,004 |
| ATL-008 / P0 | Input: owner-approved budget and pilot constraints. Define pilot operating limits. Output: funded limits, dates, capacity and launch decisions without invented approval. | 001,004 |

### Phase 2 — Core contracts: ATL-009–ATL-020

| ID / priority | Input → single operation → verifiable output | Depends on |
|---|---|---|
| ATL-009 / P0 | Input: cohort and role entities. Define cohort persistence schema. Output: typed cohort/role definitions with lifecycle constraints. | 003,008 |
| ATL-010 / P0 | Input: invitation invariants. Define invitation persistence schema. Output: hashed-token and redemption uniqueness definitions. | 007,009 |
| ATL-011 / P0 | Input: membership lifecycle. Define membership persistence schema. Output: cohort/student uniqueness and auditable lifecycle definitions. | 009 |
| ATL-012 / P1 | Input: curriculum mappings. Define immutable curriculum persistence schema. Output: published version and lesson provenance definitions. | 005,006 |
| ATL-013 / P1 | Input: assessment/evidence invariants. Define learner evidence persistence schema. Output: assignment, submission and append-only review definitions. | 011,012 |
| ATL-014 / P0 | Input: free entitlement contract. Define entitlement persistence schema. Output: membership-bound capability/validity definitions separated from paid billing. | 004,011 |
| ATL-015 / P1 | Input: programme completion policy. Define completion persistence schema. Output: labelled learning-completion records with credential distinctions. | 006,013 |
| ATL-016 / P0 | Input: invitation schema and authorised issuer. Implement invitation issuance. Output: single-use expiring invitation creation with redacted audit metadata. | 010 |
| ATL-017 / P0 | Input: invitation, membership and verified identity contracts. Implement invitation redemption. Output: transactional, capacity-bound, idempotent recipient acceptance. | 010,011,014 |
| ATL-018 / P0 | Input: membership state policy. Implement membership transitions. Output: authorised suspend/revoke/complete handler preserving separately owned access. | 011,014 |
| ATL-019 / P0 | Input: active membership and capability policy. Implement educational entitlement resolution. Output: server-derived scoped decision with explicit denial reasons. | 014,018 |
| ATL-020 / P0 | Input: entitlement resolver and existing engine guards. Integrate the cohort access guard. Output: controlled education access with all non-commercial engine prerequisites preserved. | 019,007 |

### Phase 3 — Learning experience: ATL-021–ATL-030

| ID / priority | Input → single operation → verifiable output | Depends on |
|---|---|---|
| ATL-021 / P1 | Input: approved persistence and operation contracts. Specify cohort OpenAPI operations. Output: validated owner-/role-scoped request and response schemas. | 009–020 |
| ATL-022 / P1 | Input: validated OpenAPI specification. Generate the typed client. Output: repository-standard client and validator artifacts without manual generated-code edits. | 021 |
| ATL-023 / P1 | Input: identity and role policy. Implement cohort resource authorisation. Output: reusable owner/assignment scope checks for reads, writes and downloads. | 003,021 |
| ATL-024 / P1 | Input: membership and pinned curriculum version. Implement learning progress projection. Output: deterministic per-student lesson states without invented engine events. | 012,013,023 |
| ATL-025 / P1 | Input: owned artifact and expected-version submission contract. Implement evidence submission. Output: append-only source-hashed submission or explicit stale/foreign denial. | 013,023 |
| ATL-026 / P1 | Input: generated client and progress projection. Build student learning home. Output: responsive cohort, next-action, budget and credential-status view. | 022,024 |
| ATL-027 / P1 | Input: generated client and scoped roster contract. Build instructor roster view. Output: cohort-only roster with submitted-work access and no unrelated private artifacts. | 022,023 |
| ATL-028 / P1 | Input: invitation contract and verified identity flow. Build invitation acceptance view. Output: accessible free-terms and recipient-bound acceptance journey. | 017,022 |
| ATL-029 / P1 | Input: lesson version and seven-section layout. Build the lesson view. Output: worked example, personal exercise, evidence and next action with persistent mode labels. | 022,024 |
| ATL-030 / P1 | Input: evidence version and authorised rubric. Implement review decisions. Output: append-only learning decision or stale-review conflict; no credential-field mutation. | 025,023 |

### Phase 4 — Integration: ATL-031–ATL-038

| ID / priority | Input → single operation → verifiable output | Depends on |
|---|---|---|
| ATL-031 / P1 | Input: gate curriculum and synthetic project. Compile the worked-example pack. Output: immutable versioned examples for every listed gate with known expected outcomes and failure cases. | 005,012 |
| ATL-032 / P1 | Input: existing Quest endpoints and exact predicates in section 2.8. Integrate the Quest projection. Output: unchanged authoritative badge states without added cohort prerequisites or fabricated award events. | 006,024 |
| ATL-033 / P1 | Input: Ascension source definitions. Integrate the cohort Ascension projection. Output: existing-rung evidence links preserving current signal predicates. | 005,024 |
| ATL-034 / P2 | Input: submitted lesson origin and existing Boomerang contract. Integrate contextual remediation links. Output: exact-origin support workflow that cannot advance protected stages. | 025,029 |
| ATL-035 / P0 | Input: funded limits and existing spend reservations. Integrate educational cost enforcement. Output: bounded LLM actions with explicit exhaustion and no unmetered call paths. | 008,020 |
| ATL-036 / P2 | Input: review API and instructor view. Build the feedback workspace. Output: rubric, revision history and source-change display scoped to assigned work. | 027,030 |
| ATL-037 / P2 | Input: approved capstone submissions and credential projection. Generate eligibility packets. Output: provenance-linked assessment packet identifying real, simulated, pending and blocked evidence. | 030,032,033 |
| ATL-038 / P0 | Input: approved additive schema changes. Generate the migration set. Output: committed forward migrations with reviewed ownership/access effects and no production execution. | 009–015 |

### Phase 5 — Validation and release: ATL-039–ATL-045

| ID / priority | Input → single operation → verifiable output | Depends on |
|---|---|---|
| ATL-039 / P0 | Input: role matrix and migrated test schema. Verify access isolation. Output: passing anonymous, foreign-student, foreign-cohort and revoked-membership tests. | 020,023,038 |
| ATL-040 / P0 | Input: invitation operations and test identities. Verify invitation concurrency. Output: passing replay, expiry, wrong-recipient and last-seat-race tests. | 016–018,038 |
| ATL-041 / P0 | Input: existing Quest behaviour and cohort adapter. Verify Quest conformance. Output: parity tests for counts, claims, pillar thresholds, revoked states and independence from cohort feedback; no forged awards or clearance. | 031,032,037 |
| ATL-042 / P1 | Input: deployed test curriculum and isolated students. Verify the learning journey. Output: desktop/phone evidence for invite→lesson→attempt→revision→completion with truthful credential status. | 026–037,039,040 |
| ATL-043 / P0 | Input: threat model and integrated application. Review pilot security. Output: prioritised findings with launch-blocking issues clearly marked. | 007,035,039–042 |
| ATL-044 / P2 | Input: implemented pilot behaviour. Compile the operations runbook. Output: admission, suspension, budget, recovery, privacy and support instructions matching actual behaviour. | 042,043 |
| ATL-045 / P0 | Input: validation evidence and owner decisions. Assess release readiness. Output: go/no-go checklist signed by an authorised human; publishing remains a separate explicit action. | 043,044 |

## 3.2 Dependency and execution rules

Foundation → approved contracts → implementation and examples → migrated isolated test environment → access/identity verification → journey verification → security review → human release decision.

Although ATL-038 is listed in the integration phase, apply its reviewed migrations to the isolated development/test environment before executing database-backed operations or validation. Never execute production schema changes as a side effect of a prompt. Parallel work is permitted only where dependencies and edited surfaces do not conflict.

### P0 Context Craft envelope

Apply this envelope to every RED operation, using its row as the single instruction:

- **SYSTEM:** ARK Harness training extension; preserve authoritative engine, identity and credential boundaries.
- **ROLE:** Implementer of this one operation, not programme owner or credential authority.
- **INSTRUCTION:** Execute only the row's named operation.
- **EXAMPLE:** Use the synthetic FIELD SERVICE REQUEST DESK fixtures or isolated test identities.
- **CONSTRAINT:** No production mutation, secret disclosure, invented pass evidence, paid conversion or broad tier bypass.
- **FORMAT:** The row's declared output, with a verifiable success/failure result.
- **DATA:** Current approved contracts and declared prerequisites only.

## 3.3 Worksheet assurance and token dashboard

All forty-five rows contain a single bounded engineering operation, declared inputs, expected outputs and prerequisites. A test suite may contain multiple assertions about its single verification objective; it must not silently implement unrelated features.

At execution time record input/output tokens, provider/model, cached context, retries and cost against each work unit. Compare against a measured unoptimised pilot baseline. Report savings only after both versions preserve requirements and pass the same tests. Do not use this worksheet to claim pre-existing 97.5% semantic preservation or a certified 50/50 result.

---

# PART 4 — IMPLEMENTATION PLAN

## 4.1 VIBE DJ tool selection

Choose tools by eight criteria: existing-stack alignment, security/privacy, identity/data integration, speed, operating cost, collaboration, AI support and verification quality.

| Tool / environment | Proposed use | Decision |
|---|---|---|
| Existing Replit workspace | Implement within current pnpm, React/Vite, Express and PostgreSQL structure | Primary; avoid rebuilding the product |
| Existing generated OpenAPI toolchain | Contract, validator and client generation | Required |
| Existing Vitest infrastructure | Access, lifecycle, provenance and credential tests | Required |
| Browser automation | One coherent critical invitation/learning/review journey pass | Required before pilot |
| Existing AI integration providers | Bounded student engine calls under funded reservations | Reuse approved providers; no new credential exposure |
| GitHub repository workflow | Version review and controlled integration | Reuse current approved sync/review process |
| Existing PDF/export tooling | Learning portfolios and labelled completion records | Reuse safe filename and byte-integrity conventions |
| Optional local editor | Developer preference compatible with repository controls | Optional; no requirement to subscribe to a separate tool |

No arbitrary Cursor/Claude/v0 percentage allocation is asserted. Selecting an editor is not a runtime dependency. Tool-specific adoption follows the project's existing governance, not a generic playlist.

## 4.2 ORCHESTRA coordination

- Keep one authoritative requirements ledger, OpenAPI contract and curriculum version registry.
- Allocate identity/access, curriculum, interface and assessment work to distinct owners with explicit boundaries.
- Integrate contracts before dependent interfaces. Do not let independently built clients invent competing badge or tier rules.
- At each phase boundary record changed requirements, evidence, risks and unresolved decisions.
- Resolve policy conflicts in favour of the stricter existing engine/credential protection until an authorised decision changes it.
- Freeze the pilot curriculum before invitations; corrections create a new version with an explicit migration/retake policy.
- Maintain a release note distinguishing source-present, workspace-tested, deployed and verified-live behaviour.

## 4.3 Camelot team assembly

Proposed roles are responsibilities to assign, not fictional staffed positions. One person may hold compatible roles; independent security/credential decisions require appropriate separation.

| Seat | Human responsibility | Supporting SPC / discipline |
|---|---|---|
| 0 | Programme sponsor and authorised release decision | STRATEGOS |
| 1 | Curriculum and solution architecture | ATLAS |
| 2 | Student experience and accessibility | KLARITY |
| 3 | Individual identity and invitation engineering | ADA |
| 4 | Backend and capability enforcement | CODE DJ |
| 5 | Database ownership and migrations | ADA |
| 6 | Worked-example author and novice walkthrough | SOCRATES |
| 7 | Technical assurance and gate integrity | ADA / SPARTAN |
| 8 | Security, privacy and safeguarding review | ARES / applicable protection doctrine |
| 9 | Cost controls and measured token economics | Programme finance owner / bounded optimisation |
| 10 | Quest evidence and authorised assessment | Existing credential authority |
| 11 | Editorial and learning materials | SKRIBE |
| 12 | Testing, recovery and pilot operations | BUGMXT |

Thirteen seats are represented as seat 0 plus twelve implementation/assurance seats. Do not invent DISC assessments or numerical SPC synergy multipliers for unassessed people.

## 4.4 Eight-sprint delivery sequence

Sprint duration is a planning choice; no fixed calendar commitment is implied.

| Sprint | Deliverable | Exit evidence |
|---|---|---|
| 1 | Requirements, individual identity decision, roles, entitlement and threats | Owner-approved scope and no shared-staff-account student design |
| 2 | Cohorts, invitations, memberships, additive schemas | Safe lifecycle and concurrency contracts |
| 3 | Curriculum versioning and complete worked pack | Every gate has input, output, failure case and evidence-mode label |
| 4 | Student home, lesson pages and owned assignments | A learner can find the next gate and submit their own evidence |
| 5 | Instructor assessment and Boomerang remediation | Scoped feedback and preserved revision history |
| 6 | Quest/Ascension projections, capstones and completion records | No manufactured credentials; truthful blocked modules |
| 7 | Cost guards, isolation, recovery, accessibility and security validation | No unresolved critical identity, privacy, cost or gate bypass |
| 8 | Small invite-only pilot and release review | Observed student journey, support readiness and human go/no-go |

Use two planning increments if helpful: foundation/personal learning in sprints 1–4; assessment/assurance/pilot in sprints 5–8. This is an organising proposal, not a claim of formal SAFe or PMBOK certification.

## 4.5 Pilot acceptance checklist

- [ ] Programme owner approves dates, capacity, age policy, privacy notice, retention and funded allowances.
- [ ] Individual login and intended-recipient invitation binding work; shared staff credentials are not used by students.
- [ ] Free terms are visible; no checkout, card collection, charge or automatic paid conversion exists.
- [ ] An expired/revoked invitation fails; concurrent redemption cannot exceed seats.
- [ ] Every listed gate has an instructor-approved worked example and personal exercise.
- [ ] Guide, Quest and Ascension references match the deployed release and are version-pinned.
- [ ] Students own separate artifacts; examples cannot masquerade as student gate evidence.
- [ ] Mentor visibility is limited to assigned submissions; anonymous and cross-student access fail.
- [ ] Student actions retain original source, safety, spend, certification and release gates.
- [ ] ASPE repeat work, AISA portfolio and AISE claim limitations are visible before enrolment.
- [ ] Quest parity tests prove that joining a cohort neither weakens nor adds badge prerequisites; current eligible/claimed/revoked states remain authoritative.
- [ ] Learning completion, credential eligibility, credential award and deployment status are distinct.
- [ ] F9/F9.5/F10/F11/F12 demonstrations cannot generate operational receipts or clearance.
- [ ] Withdrawal, suspension, cohort archive and budget exhaustion preserve truthful access and records.
- [ ] Desktop, phone, keyboard and light/dark learning flows are verified.
- [ ] Current application builds, workflows and relevant tests are healthy before pilot publication.
- [ ] Authorised human release review approves the pilot; publication occurs separately.

## 4.6 Pilot measures

Measure invitation acceptance; orientation completion; first authentic F1/F2 submission; lesson retry rate; instructor response time; ASPE/AISA/AISE actual eligibility and claim outcomes; capstone completion; budget per active student; isolation/security incidents; accessibility defects; retention and withdrawal.

Set target values after the first instrumented pilot. Do not report projected completion, credential attainment or cost savings as observed results.

## 4.7 Rollout and recovery

Start with a small owner-approved cohort and named instructors. Keep public self-enrolment disabled. Verify the published student journey using isolated test identities before distributing real invitations. If a critical issue appears, suspend new admissions or funded training actions without destroying existing student work. Roll back only through a reviewed compatibility plan; additive migrations and historical evidence must remain interpretable.

**Future expansion:** Paid cohorts, institutions, peer review, verified independent practical examinations and public alumni portfolios are separate approvals. No public Sphinx supply-line switch, sale, NFT registration or automatic publication is part of this pilot.

## 4.8 Living PDD governance

This document is a versioned design baseline. A proposed update cadence is once per curriculum release and after any authoritative gate/credential rule change. A continuous monitoring service is not activated by writing this PDD; agree its owner and cadence before enabling one.

Maintain these distinct statuses: **SPECIFIED → IMPLEMENTED → WORKSPACE_VERIFIED → DEPLOYED → VERIFIED_LIVE**. A gate taught by simulation retains that mode even if the lesson is complete.

---

# ADDENDUM A — SOURCE REGISTER AND DESIGN ASSUMPTIONS

## A.1 Source register

- User brief: free invite-only cohort account, exact subscription name, Architect/Engineer training, worked examples at each gate, Guide/Ascension curriculum and Quest credentials.
- `artifacts/command-centre/src/pages/guide.tsx`: walkthroughs, stage descriptions and advisory/protected-operation caveats.
- `artifacts/api-server/src/lib/ascension.ts`: current thirteen-rung projection and real signal predicates.
- `artifacts/api-server/src/lib/badges.ts`: current artifact-count and claimed-credential conditions.
- `artifacts/command-centre/src/pages/quests.tsx`: displayed credential names and descriptions.
- `artifacts/api-server/src/lib/tier.ts`: existing tier, rate-limit and owned-session escalation controls.
- Existing process-wide Boomerang design boundary: returned work remains supporting input; review is not engine execution or release.
- ATLAS ULTRA SI authoring discipline: four-part PDD, forty-five atomic work units, declared dependencies and implementation governance.

Source inspection establishes a design baseline, not independently verified live platform availability. A live launch review must recheck these sources against the published release.

## A.2 Decisions requiring owner confirmation before launch

1. Pilot cohort name, owner, instructors, assessors, dates and size.
2. Individual identity method and invitation delivery channel.
3. Funded spend limits and handling of students who exceed allowance.
4. Age eligibility, safeguarding, privacy notice and retention/export policy.
5. Whether any advanced hardware, connector or deployment exercise may be genuinely executed.
6. Approved capstone rubric and exact wording of cohort completion records.
7. Confirm that the pilot displays existing Quest requirements and preserves current claim, revocation and pillar-award behaviour without alteration.

These unknowns do not prevent the design document. They do prevent claiming that the cohort service is ready to admit students.

## A.3 Definition of done for this document

Four parts, one exact free subscription offer, gate-by-gate worked examples, credential mapping, secure cohort/account architecture, forty-five atomic implementation work units, a dependency-aware delivery plan and truthful release criteria. **Document delivery is not platform implementation or credential issuance.**
