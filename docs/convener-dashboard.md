# FORGE FIELD ENGINEER — Convener Dashboard

## Entry and responsibilities

Open **Convener** in the main navigation or **Convener dashboard** in the Teaching section of `/learn`.
The dedicated entry is `/convener`; each class opens `/teach/cohorts/<cohort-id>`.

An administrator creates a class and becomes its owner. Owners control admission,
membership and class lifecycle. A named, active instructor assigned to an active,
unexpired cohort can use its teaching and convener workspace. Being a trainee,
knowing a cohort identifier or being an unrelated administrator does not grant
access to that cohort's teaching data.

## Running a class

1. Create a draft with a title, end date, capacity, programme budget and per-trainee
   allowance. Zero inference allowance is supported.
2. Activate it under **People** and issue invitations for named email addresses.
   Invitation links are single-use and bound to the verified invitee's email.
   Existing copy-link/email-client invitation controls remain available.
3. Use **Review** for submitted course work. **Performance** reports required
   lessons completed, submitted assignments, revision requests and recent review
   feedback for each trainee. Percentage is course progress, not an independent
   quality score or certification decision.
4. **Draft follow-up** uses that feedback and a deterministic recommendation to
   prefill a plan. Review it, choose the trainee and optional lesson, set a due
   date, then save. Edit or mark the plan in progress/completed later.
5. Use **Meetings** to create or edit a future session before the cohort ends.
   Choose all active trainees or named trainees and optionally enter an HTTPS
   meeting link. Calendar downloads use a stable event identity. Cancelled events
   remain visible and have cancellation calendar downloads. This does not
   provision a Teams/Zoom meeting or synchronize a calendar account.
6. In **Cohort Library**, explicitly share a curated reference or one of your own
   active Exemplars. Confirm authorization to share it with this class.
   The saved content is a cohort-specific snapshot; changing the source later
   does not rewrite that snapshot. Archive old entries and share a new snapshot
   when needed. Sharing never publishes or qualifies a Sphinx listing.
7. In **Email**, review the recipient selection, subject and message, optionally
   attach a meeting's authoritative details, and confirm sending. Individual
   recipient addresses are resolved server-side and are not exposed to the class.

## What trainees see

The selected membership on `/learn` has a **From your convener** section with
that trainee's follow-ups, addressed meetings and active cohort references.
Support records are read-only there. They do not expose other trainees' plans
or participant identifiers. Revoked memberships retain their own follow-up
records but no longer receive the cohort library or meeting schedule.

## Email configuration and truthfulness

The existing email adapter requires `RESEND_API_KEY` and `EMAIL_FROM` in the
appropriate environment. Never put a key or password in source code, messages,
meeting URLs or invitations. Delivery is disabled when configuration is absent;
a dry run is never reported as sent.

Message creation has a cohort-scoped request identifier and per-recipient records.
A replay of the same request returns the same record without redispatch.
New bulk sends have a 30-second cohort cooldown.

- **Pending:** not yet attempted.
- **Sending / outcome uncertain:** dispatch began; automatic redispatch is
  deliberately suppressed because an interruption does not prove non-delivery.
- **Accepted by provider:** provider acceptance, not proof of inbox delivery.
- **Failed:** provider did not accept the email, or the recipient had no address.

Keep the compose tab open while sending. A timed-out request can be checked using
the same request ID; do not create another send merely because the response was
lost. There is no automated retry of uncertain outcomes or provider delivery
webhook reconciliation in this version.

## Security and publication

New records are stored in additional public `learning_*` tables through a new
committed Drizzle migration. Existing ARK RLS SQL, protected-workflow checks,
application roles, auth walls and historical migrations are unchanged.

Closed/expired cohorts remain readable to the owner but new convener mutations
are blocked. Training remains free and invite-only. Neither course completion,
coaching, a shared example nor instructor review awards or overrides Quest
badges, certification, marketplace approval or release authority.

This is a workspace build. Publication is user-initiated and must succeed before
these screens are live. A successful build alone does not resolve a publishing
service-initialization failure.
