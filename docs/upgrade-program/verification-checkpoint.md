# XVL / VTE contract-verification checkpoint

## Latest local validation — SHORT SPRINTS preflight, 2026-10-16

- Full workspace regression: **775 passed, 40 skipped** (API 565, frontend
  178, scripts 32). Targeted policy/API coverage now comprises 28 tests.
- Shared code generation, full workspace typecheck and both production builds
  passed. A subsequent focused frontend typecheck also passed after binding
  typed selectors outside JSX to satisfy preview instrumentation.
- The actual Vite-transformed preflight module returns HTTP 200. Public
  `/status` still renders database availability and incomplete-upgrade notices.
- Authenticated API regressions cover foreign/missing sessions, unknown query
  assertions, forged legacy certification, bounded source transport, JSON
  contract presence, deterministic selection and source-content hash changes.
- API still reports all 48 migrations applied; this read-only feature adds no
  schema migration or provider call. No gate decision, route, release state or
  artifact certification is changed.
- Signed-in UI verification passed using the existing staff-access flow:
  default options, circuit/source isolation, missing F5 source, refreshed F5
  selection, rapid option changes, firmware/Regulated requirements, JSON
  download and privacy assertions, reload defaults, light/dark and 390px phone
  layout. Existing Track E controls remained reachable.
- Browser fixture inspection confirmed unchanged session/stage state and
  artifact content/legacy flags. All created identities, records and private
  temporary auth/download files were cleaned up. The initial selection/export
  interval did not have a complete request-method trace; do not claim one.
- No production publication or full activation is inferred.

## Latest validation — 2026-10-16 successor-policy and security patch

- Supplied CODE DJ, ADA ULTRA SI, CODON and CORDON STUB guidance has been
  reconciled in `derived-spc-contracts.md`; supplied certification claims are
  not certifications of this implementation.
- Full workspace typecheck passed. Full tests: **759 passed, 40 skipped**
  (API 549, Command Centre 178, scripts 32).
- Frontend and API production builds passed; whitespace/diff check passed.
- API and frontend workflows restarted successfully. API reports all 48
  committed migrations applied. Public `/status` renders database availability
  and explicitly retains the incomplete-upgrade notices.
- Critical dependency advisories reduced from 12 to zero. Remaining 39 high
  advisories, absent development RLS and incomplete privacy assessment are
  disclosed in the replacement SEC REP ONE.
- No production publication, full release-gate activation or live enforcement
  claim is made by this checkpoint. Earlier validation below is historical.

## Status and limits

Available in the development build, not yet observed on the published platform:
an owner-only verification workbench linked from each session's **Verification**
button. This is the first functional verification slice, not activation of the
whole XVL/VTE, F12, SHORT SPRINTS or IMPRIMA program.

### What actually runs

1. Register a stage-bound, immutable acceptance contract before generating the
   target artifact. The server hashes its rules and records registration using
   database wall-clock time after acquiring a session lock.
2. Generate a new artifact in the existing cockpit. Older artifacts cannot earn
   a verdict under a later contract. Ownership, stage and time ordering are
   checked again on the server.
3. Run the local deterministic JSON-contract adapter. It supports JSON Pointer
   existence, type, scalar equality and string/array length checks. It accepts
   at most 100 rules and 512,000 bytes of serialized artifact JSON. Errors and
   oversize artifacts are INCONCLUSIVE, never PASS.
4. Persist an immutable snapshot with artifact, evalset, adapter/version and
   evidence hashes, server-derived PASS/FAIL/INCONCLUSIVE and independence I2.
   This I2 designation describes the deterministic test mechanism, not the
   quality of the owner's chosen contract or independent scientific review.
5. Record a metadata-only Stream E verdict. FAIL/INCONCLUSIVE atomically opens
   an OPEN VTE failure case and its trace. Replaying an identical request reuses
   its snapshot and does not duplicate traces or failures.
6. Inspect or download the returned partial contract evidence JSON. Histories
   contain the latest 200 entries per category. No raw artifact output enters
   the evidence snapshot, trace or failure case. Expected values remain in the
   owner's private acceptance contract.

This adapter uses no model, external provider, shell or generated executable
code. It is **not** the Google ADK reference adapter, a cross-family judge,
red-team run, human panel or external audit.

### What deliberately does not happen

- A contract PASS does not change existing artifact verification flags, confer
  Evidence-Backed stage conformity, promote a stage or clear a release.
- A later PASS does not automatically close an earlier failure as repaired.
  Approved repair pairs, held-out regressions and proposals remain unfinished.
- No corpus capture, training export, scientific-validity claim or public
  marketplace qualification is enabled.
- These are application-immutable snapshots, not an externally signed WORM
  archive. Required custody/signing and human authority remain separate.
- Azure remains Class B. Its deferral does not certify the missing controls.

## Remaining activation dependencies

**XVL/VTE:** profile floors, gate selection and enforcement, independent model
identity/rubric adapters, real red-team and human-review adapters, conflict
checks, waivers/authority, approved repair/regression loop and consent/ethics
controls must precede full activation.

**F12:** the Upgrade PDD requires real release health signals, a deployment
target capable of staged traffic/version rollback, named approval authority and
linked incident/F0 operations. Existing delivery receipts are not evidence that
traffic was rolled back. Replit Publish remains a user action.

**SHORT SPRINTS:** depends on those verified release/handoff/operate gates,
route-specific verification packs and resolution of the source's conflicting
eligibility rule. It cannot skip F9.5 or F10–F12.

**IMPRIMA:** the user subsequently authorized project-authored adapter contracts
using the available KLARITY, SOCRATES and PLAN governance material. See
`derived-spc-contracts.md`; these enable continued engineering without claiming
the historical originals were recovered. Named approvals, real rights/factual
review and upstream release gates still need implementation and evidence.

The definition gaps for SP-17–SP-20 and sprint eligibility now have explicit
successor policy in `governance-gap-resolution.json`. A scoped replacement
SEC REP ONE assessment exists, including actual critical dependency patches
and outstanding findings. External legal, scientific and provider approvals
cannot be synthesized by code.

## Progress accounting

Development verification: workspace typechecks passed; the complete automated
suite passed 744 tests with 40 explicitly skipped tests (537 API, 178 frontend,
29 scripts passed). The API and production frontend build succeeded. Both
development services restarted cleanly with all committed migrations applied.
These checks do not certify the skipped paths or any production behavior.

Authenticated development browser checks confirmed registration, refusal of
older artifacts, real FAIL/PASS evidence, persistence after reload, partial
JSON download, unchanged artifact release flags and an earlier failure staying
OPEN after a later PASS. Light/dark desktop views were checked. A 390px phone
overflow was fixed and rechecked successfully, including internally scrolling
raw evidence. An optional 320px check exposed residual action-row overflow;
the action row now wraps, but that final narrow-width adjustment was not
browser-rechecked. All browser fixtures were cleaned up.

`progress.json` records affected prompts as PARTIAL locally. Live activities and
invariant enforcement remain UNVERIFIED until the published version is
observed and tested. The supplied invariant registry is not rewritten to imply
completion. The existing public baseline remains distinct from this new build.
