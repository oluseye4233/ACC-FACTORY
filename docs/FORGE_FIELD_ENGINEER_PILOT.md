# FORGE FIELD ENGINEER — pilot operator guide

This is a free, invite-only training capability, not a paid-tier promotion. Programme funding pays for bounded inference; there is no checkout or card requirement.

## Start a cohort
1. Sign in using the existing **staff entrance**. Use **Training** in navigation or the FORGE FIELD ENGINEER dashboard action.
2. Create a cohort with a clear title, capacity, future end date, total funded USD allowance and per-student funded USD allowance. Zero funding is valid for read-only/reflection training, but cannot fund model calls. A conservative reservation must fit the remaining allowance before a model call starts.
3. Activate the cohort. Invite individual verified email addresses as STUDENT or INSTRUCTOR. The owner remains the administrator; an assigned instructor can review only that cohort's submitted work.
4. Copy each newly generated invitation link immediately and send it privately to its named recipient. Links are returned once, stored server-side only as hashes, expire after seven days or the cohort end, and can be revoked. Creating an invitation does **not** automatically send an email.
5. Students use **Student sign-in**, not the staff code. They sign in or register their own verified individual account, open their invitation, and explicitly accept the free programme terms. A new account alone does not grant training admission.
6. Students read the Guide/Quest orientation, then follow the worked lessons. Actual-platform exercises require their own matching artifact IDs; simulations/reflections cannot attach artifacts. The Architect/Engineer track selects its required lessons.
7. In the cohort review queue, give written feedback and mark each submitted version learning-complete or revision-required. Acceptance is blocked if its source artifact changed. Review does not mint badges, certificates, release evidence or protected execution.
8. Mark a student's course complete only after all currently required lessons are reviewed complete against current sources. Suspend/revoke access when necessary; records and portfolio export remain available. Cohort completion stops new funded activity.

## Existing Quest authority
- ASPE: three owned SPCs and four owned MA birth packages.
- AISA: one owned ATLAS PDD, one Micro PDD and one MVP PDD; no new certification predicate.
- AISE/AISE_BUILD: the existing claim endpoints, URL categories and public HTTPS checks remain authoritative.
- AISA_PWDD and Context Craft retain their existing production predicates.
- No new badge prerequisite chain, originality test, instructor sign-off or course-completion requirement is added to those predicates. Qualifying normal engine artifacts still count when students use worked examples for guidance.
- Lesson approval does not add synthetic artifacts or platform events. Quest status may differ from course progress.

## Operational boundaries
Advanced F9–F12 training is simulation/tabletop only. Student access does not enable institution/admin features, release/deployment operations, external webhook delivery or commercial billing. Ordinary earned credential claims remain available without an active course.

Company-wide inference limits still apply. Cohort and per-student allowances cover the **whole cohort lifetime**, not a fresh monthly allowance. Completed charges and live reservations remain separate; failed calls release reservations. With multiple memberships, the learner's selected membership is checked on the server before charging its cohort. Membership and cohort state are rechecked when reserving funds.

Unfinalised training reservations remain held even after a timeout: a timeout does not prove the provider charged nothing. An interrupted call with no final usage needs operator reconciliation; the app does not silently return those funds or present them as completed spend.

Use synthetic examples and avoid real sensitive information in exercises. Submit only work intended for the cohort's instructors. Instructors cannot browse unrelated private student libraries.

## Publish checklist
- Include the additive learning schema migration in the normal managed database Publish/schema-change flow. No production database was manually changed by this feature build.
- Ensure the existing managed Clerk configuration is available in the published environment. Staff sign-in is preserved as a separate path.
- After publishing, verify the individual student sign-in domain, invite redemption, cohort review and portfolio download on the published URL before distributing pilot invitations.
- Create and fund the real pilot cohort deliberately; test fixtures are not a production cohort.
