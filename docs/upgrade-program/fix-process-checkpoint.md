# Fix process checkpoint

## Scope and boundaries

This batch follows the agreed backlog order. It does not change production,
historical SQL migrations, the protected ARK migration package, authentication,
subscriber entitlements or the fail-closed deployment startup chain.

## GitHub push request size — implemented

- The exact GitHub codebase POST receives a bounded 16 MiB JSON transport
  allowance, allowing JSON escaping overhead for a 2,000,000-byte source bundle.
- Other endpoints retain Express's default JSON limit.
- Source content is measured in UTF-8 bytes, not UTF-16 code units.
- Transport overflow returns JSON HTTP 413; valid parsed bundles over the
  source ceiling retain the route's HTTP 400 `BUNDLE_TOO_LARGE` response.
- GitHub push and request-parser suites: 38 tests passed.
- Full workspace typecheck passed.

GitHub itself was mocked in the route tests; no repository was created or
changed by those tests. This is not evidence of a new production deployment.

## Fresh-install migration verification — implemented and replayed

CI now invokes a loopback-only, empty `workspace_test` migration replay rather
than relying on schema push. This is not a production installer and is not
connected to deployment startup.

The historical introspection baseline is fully commented. Following approval
to preserve history, `lib/db/fresh-install/baseline.json` defines a separate
fresh-install recipe pinned to the SHA-256 of that unchanged source. It corrects
five mismatched operator classes on UUID index columns without removing indexes,
uniqueness or foreign keys.

The initial PostgreSQL 16 throwaway-cluster run exposed:

```text
operator class "int4_ops" does not accept data type uuid
```

The offending index is in
`lib/db/migrations/0000_harsh_miss_america.sql`:

```sql
CREATE UNIQUE INDEX "harness_feature_state_session_feature_idx"
ON "harness_feature_state" USING btree
("session_id" int4_ops,"feature_id" int4_ops);
```

The separate fresh baseline now executes before all 53 unchanged incremental
migrations. Its ledger row records the hash of the SQL actually executed; a
separate provenance row records the source, manifest and executed hashes. It
does not substitute the original source checksum for different executed SQL.
Existing database ledger records are not changed.

The full replay passed on the isolated PostgreSQL 16 database, including a second
migration run with no new migrations. The runner refuses non-local, differently
named or non-empty targets and has no production/startup integration.
Three runner safety/source-integrity unit tests passed.

## Dependency remediation — substantially reduced, residuals retained

A fresh `pnpm audit --json` reported 0 critical, 41 high, 37 moderate and 9 low
advisory instances across the complete dependency graph. These are package-audit
counts, not demonstrated exploits or a production reachability assessment.
The count must not be substituted for the older October 16 report.

Compatible direct-parent updates and scoped patched transitive overrides reduce
the audit to **0 critical, 1 high, 2 moderate, 0 low**. The minimum-release-age
guard remains enabled; no exclusion was added to install a newly published
package. Vite and its test-runner peers remain on major 7; application Zod and
generator target contracts remain unchanged.

Residuals, not suppressed:

- `braces`: high, no published patched release. Dependency path is
  `http-proxy-middleware -> micromatch -> braces`. The inspected proxy uses the
  default literal path filter, not a caller-supplied glob. This narrows the
  observed exposure but is not a blanket exemption for future usage.
- `sprintf-js`: moderate, no published patched release. Dependency path is
  `mammoth -> argparse -> sprintf-js`; the inspected Mammoth CLI imports
  argparse, while the platform uses Mammoth as a library. No complete dataflow
  proof is claimed.
- `postcss-selector-parser`: moderate via `@tailwindcss/typography`'s version-6
  dependency. The available fix is version 7.1.6; forcing a transitive major
  upgrade was not treated as a compatible patch.

The existing React/Clerk peer warnings remain visible; the intentionally pinned
React version was not changed as an incidental dependency fix.

Credit and preparation-file recovery are implemented in the subsequent batch
below. Grouped API/component journey checks and a shared-theme accessibility
pass are recorded in the subsequent section.
No production activation or certification is established by these local changes.

## Verification of the baseline/dependency batch

- Full workspace typecheck: passed.
- Full workspace tests against the isolated fresh-install PostgreSQL database:
  API 618 passed / 40 skipped; frontend 235 passed; scripts 35 passed.
  Total: 888 passed, 40 skipped, zero failures. Skipped tests are not counted
  as verified features.
- API bundled build and frontend production build: passed. Existing frontend
  sourcemap-location/chunk-size warnings remain non-fatal.
- Restarted development API health: HTTP 200.
- A 150 KB unauthenticated GitHub request reached authentication and returned
  JSON HTTP 401, rather than failing at the old 100 KB parser limit.
- Development sign-in page screenshot: renders successfully.
- Isolated fresh database: all five public workflow tables have RLS enabled
  and forced; both IMPRIMA immutability triggers are present. This is not
  evidence about production installation or the restricted production login.
- No historical migration file changed; the original baseline hash still
  matches the separate fresh-install manifest.

## Cartridge and private preparation recovery — implemented in development

- Cartridge claims now carry per-claim fencing tokens. Conditional link/release
  prevents stale requests and ambiguous commit responses from unlinking a paid
  package. Transient release failures receive bounded retries.
- Startup/periodic reconciliation recovers at most 100 expired, tokened,
  unlinked reservations per pass. The existing subscription switch still gates
  this worker; subscriptions have not been enabled. Un-tokened legacy rows are
  retained for review.
- New preparations persist durable upload intent before storage writes and mark
  it committed atomically with artifact metadata. Rollback/crash leaves
  recoverable provenance rather than relying on a bucket-wide scan.
- Storage recovery uses 24-hour intent/object safety windows, the writer's
  account lock, reference checks, known-state/key checks and exact-generation
  deletion. Committed, active, shared, unknown and untracked legacy files are
  retained. Default mode is report-only; actual deletion requires administrator
  opt-in. The Agent did not enable that setting or delete real storage objects.
- Two additive public migrations were applied only to the verified development
  database. The isolated fresh replay passed baseline plus 55 increments and
  confirmed a second migration run was a no-op.
- Full workspace typecheck passed. Full API regression run: 79 files passed,
  647 tests passed / 40 skipped. Final recovery safety suite, including a later
  unknown-state guard: 14 passed. CI migration safety tests: 3 passed.
- The development API rebuilt and restarted cleanly with all 56 journal entries
  applied, health HTTP 200, and the public staff access page rendering normally.
- Production schema/security installation and protected approvals/releases
  remain unchanged. See `recovery-operations.md` for rollout boundaries and
  intentional legacy-retention behavior.

## Grouped journey checks and shared-theme accessibility — verified in development

- Replayed the source-pinned baseline and all 55 increments in a new disposable
  PostgreSQL 16 database; a second migration run made no changes.
- Grouped API checks passed: 34 tests across SPC Player, Boomerang, signed-cookie
  upload integration and private preparations. Providers/storage were mocked as
  defined by the suites; no real external delivery or protected release occurred.
- All 277 frontend tests passed, including source binding/retention, standalone
  artifact selection, Boomerang components and preparation view-model checks.
  These are component/API checks, not a signed-in browser end-to-end pass.
- Shared theme fixes improve dark primary labels/buttons, light gold-button
  text, light destructive buttons, input borders and keyboard focus outlines.
  Reduced-motion preferences now suppress repeated CSS animation and smooth
  scrolling. Theme tests cover switching both ways and restoring saved dark mode.
- New palette tests enforce 4.5:1 for the tested shared text/surface pairs and
  3:1 for input/focus indicators. This does not certify every page, custom colour,
  opacity variant or third-party widget as WCAG-conformant.
- Frontend typecheck and production build passed. The standalone build needs
  PORT and BASE_PATH, which the managed artifact supplies; rerunning with those
  settings succeeded. Existing sourcemap and large-chunk warnings remain visible.
- Both managed services restarted successfully; API health returned HTTP 200,
  and a desktop screenshot confirmed the public staff-access page renders.
  Protected pages and mobile interaction were not browser-verified in this pass.
- No production changes, entitlement changes or security-check exceptions were
  made. Report-only private-file recovery and protected workflow gates remain.

Remaining scope includes the separately tracked recovery wake-up/alert work,
residual dependency advisories, broader page-by-page accessibility/browser review
and deferred feature extensions. This checkpoint does not claim those are done.

## Guided progression and Quest visibility — implemented in development

- Forward-facing controls opt into a slow, shadow-only pulse/glow. Applied to
  dashboard entry/resume/Guide/Quest links, training guidance and eligible cockpit
  continuation. Ordinary/destructive actions are not automatically animated;
  disabled, aria-disabled and busy buttons do not glow.
- The existing reduced-motion preference suppresses the repeating effect.
  Hover/focus uses a steady glow while the keyboard focus outline remains.
- Dashboard, Training, Quests and the shared F-stage cockpit display recorded
  badge and senior-certificate requirements from the existing badge API.
  Counts and status are refreshed on mount, focus and every minute.
- Progress caps each requirement independently, so excess work in one category
  never substitutes for another. Percentages describe counted requirements,
  not eligibility decisions. Pending claims, revoked credentials, unknown
  progress and request failures are explicit. No award or Quest rule changed.
- Frontend typecheck, production build and all 291 frontend tests passed.
  Existing non-fatal chunk-size and sourcemap warnings remain.
- A browser verification attempt reached the staff access gate but had neither
  an authenticated session nor a secure staff-code login helper. It stopped
  without reading credentials or bypassing authentication. Therefore signed-in
  appearance, live API-to-UI comparison and mobile/reduced-motion browser checks
  remain unverified; automated component/palette tests are not a substitute.
- No production mutation, security change or credential issuance occurred.

## Progress-bar accessibility and development-service recovery

- Restored failed managed web/API workflows after identifying and stopping
  leftover server processes occupying their existing ports. No port mappings,
  deployment commands or production processes were changed.
- Fixed the shared progress component so its accessible value/state matches
  its visual fill, including non-percentage maxima. Unknown/non-finite progress
  remains indeterminate; zero stays a measured zero; invalid maxima and
  out-of-range inputs cannot produce invalid transforms or inconsistent values.
- The original Quest requirement bars and senior-architect project bar now use
  this accessible control with explicit labels and count descriptions.
  The mobile navigation landmark now has an explicit name.
- Seven new component tests passed. All 298 frontend tests, frontend typecheck
  and production build passed. Existing build warnings remain non-fatal.
- Both managed services are running and API health returned HTTP 200. The public
  staff-access preview renders correctly. Signed-in browser verification remains
  unconfirmed, as described above; no authentication bypass was added.
- No Quest thresholds, entitlement rules, database protections or production
  activation settings changed.

## Keyboard navigation — implemented and component-tested

- Shared navigation now provides a first-focus skip link that focuses the
  existing main landmark without adding a permanent tab stop. Existing landmark
  IDs and deliberate tab settings are preserved.
- The F-stage cockpit now exposes a main landmark too. Main content has scroll
  clearance for the sticky header.
- Desktop and mobile destinations expose `aria-current="page"`; parent/detail
  routes and the two query-selected operations views are distinguished.
- Mobile destinations are real links, close the navigation sheet on selection
  and retain the existing student/staff/admin visibility rules. The sheet has
  a screen-reader description.
- Twelve new tests cover keyboard skip activation, current-page matching,
  mobile selection and student navigation restrictions. All 310 frontend tests,
  typecheck and production build passed.
- This is component-level verification. The previously documented signed-in
  browser verification gap and remaining dependency/build warnings are unchanged.
  No production, role, credential or protected workflow changes were made.

## On-demand work areas and reactive entry routing

- Route components now load on demand; authentication and identity providers
  stay eager and persistent outside the route-loading boundary. The entry
  JavaScript file fell from about 2,158 KB to 452 KB (uncompressed build output;
  this is not a measured page-load time or total network-transfer claim).
- The existing loading view is an accessible status. Module-download failures
  show explicit connection/reload guidance; no automatic reload loop or hidden
  fallback was added.
- New routing tests exposed a gate that read the URL without subscribing to
  route changes. The gate now subscribes to pathname and query updates, allowing
  student and authenticated invitation redirects to settle while retaining
  invitation/source context and the existing session checks.
- All 327 frontend tests, frontend typecheck and production build passed.
  Tests cover authenticated tool deep links, public routes during session lookup
  failure, named cohort exports, persistent identity, student redirects,
  invitation retention and module-download errors.
- One browser pass confirmed public status/marketplace/tools settled, the
  protected SPC Player URL retained its query behind staff access, the gate's
  theme toggle worked and the student sign-in entry settled. No credentials or
  protected tool execution were used. Authenticated tool behaviour remains
  component-tested, not proven through a signed-in browser session.
- The public certificate-verification page rendered, but the browser reported
  one HTTP 401 resource request and a LOG OUT control. Fully anonymous state
  could not be established for that page; it needs a separate investigation.
- The deferred session-detail chunk remains about 680 KB and still triggers
  the existing size warning. Sourcemap-location warnings also remain visible;
  limits and tooling were not weakened to hide them.
- Deployment startup/security settings, entitlements, Quest rules and production
  were not changed.

## Public verification header and stage-by-stage loading

BUGMXT logic/outcome and execution-assurance guidance, plus CODE DJ
dependency-order/fidelity guidance, were applied as analyst checklists.
This is not a claim that an SPC engine ran, issued a certificate, or independently
approved the platform.

### Public certificate verification — resolved in development

- Root cause: the shared header treated "not a student" as sufficient to mount
  staff spending components and logout controls, even when no authenticated
  session existed. These components requested the correctly protected spending
  API from an anonymous page.
- The header now requires authenticated staff before mounting spend widgets or
  staff logout. Anonymous visitors see public verification/status links and a
  staff sign-in link. Authenticated staff/student navigation rules remain.
- The certificate input now has an explicit accessible label.
- A fresh browser context confirmed `/api/auth/session` returned
  `authenticated:false`, and verification browsing/submission made no company
  spend requests and produced no unexpected 401 response.
- An intentionally nonexistent certificate retained its `?cert=` query/input
  and returned the expected public 404 with a visible NOT FOUND result.
  A separate anonymous spending request still returned HTTP 401. No API guard
  was removed or made public.
- The settled 402px navigation drawer fit both public links without overflow.
  An initially clipped screenshot was captured during its entrance animation;
  a focused bounds/animation check confirmed no persistent layout defect.

### F-stage bundle — resolved in this build

- Stage interfaces now load individually, after existing stage/artifact selection
  checks, inside a local accessible loading boundary. The cockpit stays mounted.
  Software/Firmware routing and protected release gates were not changed.
- The session-detail chunk fell from about 680 KB to 54 KB; the largest output
  JavaScript chunk is now the roughly 452 KB entry file. This production build
  emitted no oversized-JavaScript-chunk warning. Sourcemap warnings remain.
- All 329 frontend tests and typecheck passed; the production build passed.
  Existing stage-selection/gating tests now await loaded workspaces rather than
  assuming synchronous import completion.
- Signed-in stage interfaces remain component-tested, not browser-verified in
  this batch. No inference engines, protected workflow actions, production
  settings, database schema or private-file deletion settings were changed.

## Scheduled recovery wake-up and failed-pass visibility

- Added authenticated `POST /api/cron/recover-abandoned-resources` and a matching
  target in the existing scheduled driver. It calls the existing bounded,
  fenced/provenance-checked workers; subscription gating and report-only storage
  defaults remain unchanged. Request bodies cannot opt into deletion.
- Both lanes are attempted independently. Exceptions or returned storage-object
  errors yield HTTP 503 and no successful heartbeat; the actual CLI driver exits
  nonzero. Responses expose status/counts, not private object keys or exception
  messages.
- Registered the target with existing durable cron health monitoring: five-minute
  expected cadence, twenty-minute stale threshold, evaluated by the existing
  fifteen-minute background monitor. Existing administrator alert configuration
  and deduplication apply. This does not implement a separate per-item failure
  ledger or an independent infrastructure-outage alert service.
- Verification: API and scripts typechecks passed; the complete API regression
  suite passed 665 tests with 40 skipped. New tests exercise authentication,
  disabled/unconfigured lanes, report-only defaults, lane/object failures,
  success-only heartbeats, and real scheduled CLI transport/exit status against
  a local fixture server. No cloud deletion or production mutation was tested.
- The managed development API rebuilt and started cleanly; health returned 200
  and an unauthenticated call to the new route returned 401 without running jobs.
- External activation remains pending: publish this build and configure/confirm
  the authenticated five-minute schedule. No Scheduled Deployment, production
  secret, security role, migration, billing flag or cleanup opt-in was changed.
  Setup and limitations are in `recovery-operations.md`.

## Development workflow ownership and per-record recovery alerts

### Development port conflicts — resolved

The failing managed workflows coexisted with older, healthy development listeners.
The listeners' executable identity and working directories were checked before
targeted termination. The existing managed web/API workflows were restarted;
artifact port configuration and production were not changed. A failed workflow
alone was not treated as evidence of a production outage.

### Repeated record failures — implemented in development

This supersedes the earlier limitation that only scheduled-pass health is
tracked. Additive public migration `0056_ordinary_iron_monger.sql` adds a durable
per-record failure ledger and per-recipient alert delivery state. It was applied
in development only; the protected ARK security schemas/rules were not modified.

- Credit episodes are bound to exact reservation tokens; preparation episodes
  are bound to immutable upload intents. Overlapping replicas count at most one
  failure per absolute five-minute period. Three observed failed periods qualify
  for an administrator notification; successful recovery/inspection resolves the
  episode, and delayed pre-resolution failures cannot reopen it.
- An exhausted immediate credit-release retry records one failure. Lost fencing
  ownership is not a failure. A failed credit batch is retried diagnostically in
  bounded, independently fenced per-record operations so one bad row cannot
  roll back successful recovery of other rows.
- Alert dispatch rechecks live ownership/state. Messages contain resource IDs,
  lane, counts and dates, not file paths, claim tokens or raw provider errors.
- Each recipient has durable delivery state with fenced leases, retries and a
  stable provider idempotency key. Successful recipients are not repeated because
  another recipient failed. Failed/dry-run mail does not consume the alert.
  Provider acceptance is not a guarantee of inbox delivery or unlimited
  exactly-once semantics.
- Scheduled and in-process recovery attempt dispatch. Scheduled notification
  failures return 503 without a healthy heartbeat. Empty recipient configuration
  is deferred explicitly. Real email configuration/production delivery remain
  unverified; private cleanup remains report-only by default.

### Verification and rollout boundary

- Workspace typechecks passed. Focused recovery checks passed, followed by the
  complete API suite: 82 test files, 686 tests passed, 40 skipped.
- Real PostgreSQL tests use isolated resource IDs and future-dated episodes so
  they cannot stamp real operator alerts or be mailed by a running dev worker.
  Provider/storage calls were mocked; no real email or cloud deletion was tested.
- Publish the additive schema and code together through the supported process.
  Confirm the external five-minute schedule, administrator recipients and email
  provider configuration before declaring production recovery alerts active.
- Administrator inspection UI and a reviewed retention policy for historical
  delivery metadata are separate optional follow-ups, not destructive cleanup
  enabled by this change.

## Dependency advisories — patched typography; two upstream issues remain

- A targeted typography override replaces vulnerable selector-parser 6.0.10
  with patched 7.1.6. Compatibility regression tests and the production web build
  pass; React/Vite pins and release-age safeguards remain unchanged.
- Audit now reports one high (`braces`) and one moderate (`sprintf-js`), with no
  upstream patched releases available. Neither advisory was suppressed.
- Executable boundary checks confirm the proxy default uses literal-path
  matching even for deeply nested request braces, and DOCX library extraction
  does not load the CLI's argparse/sprintf-js chain. These observations do not
  fix the vulnerable packages or authorize new uses of them.
- See `dependency-advisories.md` for remaining risk, test scope and recheck steps.
  Production and protected database authorization were not changed.
- Verification: workspace typechecks passed, followed by a final frontend
  typecheck after adding its regression test. The managed workspace test run
  passed 686 API tests (40 skipped), 332 web tests and 37 scripts tests, including
  both new dependency-boundary checks. The production web build passed.
  The restarted web workflow is running and API health returns 200.
  An anonymous `/guide` screenshot rendered the expected staff access gate;
  it does not verify the signed-in guide or other authenticated workflows.

## Accessibility and mobile forms — first focused pass

- Staff entry now has a main landmark, a named form, native required fields,
  pending-state semantics, and an announced error linked to the access-code
  field. Phone padding and vertical spacing allow the card to fit narrow or
  short viewports. Existing login payloads and authentication remain unchanged.
- The shared header hides its long subtitle below the small-screen breakpoint
  and reduces control spacing on phones without removing navigation or access
  controls. Public certificate search stacks its field/button on phones and
  exposes a named live results region and busy state.
- Cohort creation stacks fields on phones, wraps validation/action controls,
  and connects its existing validation guidance to a named form. Cohort
  eligibility, budgets and draft activation rules were not changed.
- Verification: 339 frontend tests passed, frontend typecheck and production
  build passed, and API health returned 200. New component checks cover form
  labels, required fields, login payload preservation, error announcements,
  pending states, cohort guidance and certificate loading announcements.
- Screenshots confirmed public verification at 320px and staff entry at 390px
  render without visible horizontal clipping. These are anonymous screens;
  authenticated cohort layout was checked at component level only. This is not
  a complete site-wide accessibility audit, screen-reader/device certification,
  or verification of the remaining signed-in F-stage/Player/Boomerang flows.
- Production, protected database/security rules and queued recovery-dashboard
  and retention work were not changed.

## Authenticated workspace accessibility — component-level pass

- SPC catalog choices are native toggle buttons with pressed-state semantics,
  usable with Space and Enter. Catalog search, the manual deck selector and
  move/remove controls now have accessible names. Reorder targets are larger
  and the ordinal no longer overlays them. Source locking and deck limits
  remain unchanged.
- Boomerang creation has persistent visible labels, unique field IDs per mounted
  form, native length/required attributes matching existing validation, and
  pending-state semantics. Return/review fields have accessible names, case
  disclosures expose expansion state, and return-validation errors announce.
  Existing origin fingerprints, owner visibility, version checks and
  advisory-only acceptance/release boundaries remain unchanged.
- Preparation forms are named and expose saving state. The sprint manifest
  has an associated label and announced JSON errors; rejected saves and saved
  results use alert/status semantics. IMPRIMA option fields stack on phones,
  and saved-preparation paging controls can wrap. These remain private
  preparations, not protected certification, execution or release workflows.
- Session verification has an accessible name when its visible text is hidden
  on phones; the mobile harness drawer has a description.
- Verification: all 345 frontend tests passed, plus frontend typecheck and
  production build. Tests cover keyboard SPC selection, named deck controls,
  source retention, Boomerang label uniqueness and expansion/review controls,
  preparation JSON errors and rejected saves, and existing session routing.
  Managed web/API workflows are running and API health returned 200.
- Browser verification remains limited: anonymous `/spc-player/new` correctly
  renders the staff access gate at 390px. It does not show the authenticated
  workspace. No signed-in browser check or full screen-reader/device audit is
  claimed, and no production/security configuration was changed.

## Certificate lookup failure handling

- Registry 404s and explicit invalid responses remain distinct from connection,
  permission, rate-limit and server failures. Failures now say verification is
  unavailable, without declaring the certificate invalid or exposing raw errors.
- A retry button rechecks the current certificate. Submitting the same ID also
  rechecks rather than leaving the previous response unchanged. Background retry
  exposes the loading/busy state instead of displaying a stale verdict.
- Nine additional regression cases cover failure classification, retry controls,
  same-ID submission, loading, explicit invalid responses and successful recovery.
  The full run passed the other 42 test files; a missing enum in the existing test
  mock caused one new case to fail. After preserving real module exports in that
  mock, all 16 tests in the affected file passed. Frontend typecheck and production
  build passed; pre-existing nonfatal sourcemap warnings remain.
- Managed development workflows are running, health returns 200, and the public
  missing-certificate endpoint returns 404 with its expected JSON response. The
  390px screenshot shows the public loading layout without visible clipping;
  final failure/retry/success states were checked through component tests.
- No production configuration, certificate issuance, security checks or protected
  database permissions were changed.

## Quest section failure recovery

- Quest badges and Context Craft now expose independent error/retry states.
  A failed section does not hide the other section's successful results.
- Context Craft shows Loading or Unavailable instead of a false zero earned.
  Successful empty responses retain the existing zero display.
- Failed badge requests, including failed refreshes with cached data, withhold
  senior/download/claim areas until status can be loaded. Retry buttons disable
  and announce busy state during their requests. Recovery restores current
  status, including revoked-badge appeal guidance, without submitting a claim.
- Eight new page tests cover independent failures, stale cached results,
  concurrent retries, recovery, loading, absent responses and successful empty
  responses. All 362 frontend tests passed, frontend typecheck and production
  build passed. Existing nonfatal sourcemap warnings remain.
- Development web/API workflows are running and health returns 200. The 390px
  anonymous screenshot shows the expected staff gate, not the signed-in Quest
  page. Changed states were verified through component tests; no authenticated
  browser verification or production activation is claimed.
- Quest eligibility, certification rules, mutation payloads and protected
  database/security checks are unchanged.

## Certificate navigation synchronization

- Certificate lookup now subscribes to router query changes rather than reading
  the URL only on mount. Back, Forward, pushState and replaceState keep the input
  and lookup request aligned; removing the certificate clears the result and
  disables the request. Unsubmitted typing does not change the active lookup.
- New searches preserve the current pathname, unrelated query parameters and
  fragment. Same-ID submission still rechecks the current certificate.
- Four navigation tests use the real router subscription, including actual
  jsdom history Back/Forward. All 20 tests across navigation and the affected
  accessibility test file passed. Frontend typecheck and production build passed.
  The restarted web workflow is running, API health returns 200, and the public
  verification page renders at 390px without visible clipping. The separate
  workspace-wide test workflow was still running at this checkpoint; no final
  result for that run is claimed.

## Stabilization progress report — 2026-10-20

This is a newly defined, equal-weight checklist of recent stabilization work:
7 of 10 items complete in development = **70%**. It is not a percentage of the
whole product, the task backlog, feature activation, or production readiness.
Implementation with scoped verification counts as complete; open verification
work is listed separately. Keep this denominator explicit in later updates.

| Item | Status |
| --- | --- |
| Public verification avoids staff-only spending requests | Complete in development |
| First accessibility/mobile form pass | Complete in development |
| SPC Player, Boomerang and preparation accessibility pass | Complete at component level |
| Typography dependency advisory patch | Complete in development |
| Certificate failure classification and retries | Complete in development |
| Quest section failure handling and retries | Complete in development |
| Certificate URL/history synchronization | Complete in development |
| Remaining braces and sprintf-js advisories | Open; unresolved upstream findings |
| Signed-in browser verification of changed journeys | Open |
| Broader platform accessibility/responsive audit | Open |

Excluded from this denominator: production rollout/confirmation, protected
IMPRIMA/SHORT SPRINTS installation, independent XVL/VTE/full F12, Azure,
external schedules/mail activation and all other project backlog work.

### Dependency follow-up — 2026-10-20

A fresh registry audit still has one high braces advisory and one moderate
sprintf-js advisory, with no patched releases listed. Both existing
dependency-boundary checks passed; neither finding is resolved or suppressed.
See `dependency-advisories.md` for checked versions and scope. No application,
dependency or security changes were made in this review. Checklist progress
remains **7/10 (70%)**. The separately queued signed-in verification and Quest
evidence-form work were not duplicated.

## Public dependency-status accessibility and narrow-screen pass

- The dependency panel is a named region with busy state. Overall status is
  announced atomically, request failures and confirmed database outages are
  explicit alerts, and dependency labels/values use definition-list semantics.
- Status controls and rows wrap on narrow screens; long messages, timestamps
  and deferred requirements can break rather than force horizontal overflow.
- Readiness meaning remains unchanged: an unreachable check is unknown, not a
  confirmed outage, and dependency readiness is not feature/certification
  readiness. No credentials, scheduler configuration or database roles changed.
- Six new component cases plus four existing readiness-view tests passed.
  Frontend typecheck and production build passed, and the managed full-workspace
  typecheck also finished successfully. The separate full test workflow was
  still running; its final outcome is not claimed here.
- A full-page 320px public `/status` screenshot shows wrapped controls and
  deferred requirements without visible horizontal clipping. Managed web/API
  services are running and API health returns 200.
- The wider platform accessibility audit is still **in progress**, not complete:
  this public-panel check is not a site-wide audit or real screen-reader/device
  certification. The original equal-weight checklist stays **7/10 (70%)**.

### Remaining closure criteria

1. Dependency advisories: a compatible patched release or separately reviewed
   replacement is required; existing reachability tests alone cannot close this.
2. Signed-in journey verification: complete the separately queued authorized
   browser pass for Quest, Player, Boomerang and preparation.
3. Wider accessibility/responsive audit: verify remaining routes and interaction
   states across narrow/desktop viewports and keyboard/screen-reader use; record
   route-specific gaps rather than marking the whole audit done from one panel.

The separately queued Quest evidence-form work has not been duplicated. The
three remaining checklist criteria and that queued implementation mean this is
not the last fix and not a declaration of production readiness.
