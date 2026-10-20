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
