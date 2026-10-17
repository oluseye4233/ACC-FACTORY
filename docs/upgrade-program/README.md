# ARK upgrade integration control

## Current checkpoint

Initial source indexing and dependency sequencing are complete. Supplemental
sources are recorded in `source-intake-update.md`; the Command Deck trace
contract now has durable development storage and transactional artifact-save
capture; see `trace-capture-checkpoint.md` for coverage and limitations.
The baseline MVP is now published and its public health/readiness checks
respond successfully. This does not mean the wider upgrade program or the
authenticated feature paths are fully verified. Keep existing production data
and security controls; no Azure migration or public Sphinx launch is implied.

The next development slice is the session verification workbench: immutable
pre-registered JSON contracts, a real bounded deterministic Track E runner,
hash-bound evidence and metadata-only VTE failure intake. See
`verification-checkpoint.md` for exact limits and remaining dependencies.
This is not full XVL/VTE, F12, SHORT SPRINTS or IMPRIMA activation, and no
published activity is inferred from development tests.

The user subsequently authorized deriving missing inputs from available
specifications. `governance-gap-resolution.json` defines explicit successor
SP-17–SP-20 policies and the conservative SC ONE 90-minute ruling. Original
missing text is not represented as recovered. `derived-spc-contracts.md`
records the supplied cards, their limits and the project-authored adapter
contracts. `SEC-REP-ONE-reassessment.md` is a new scoped assessment, not the
missing historical report. It records critical patches and outstanding risks.

The SC ONE/SC TWO structural eligibility evaluator and boundary tests now exist
with an owner-only read-only preflight on the session verification page.
It does not accept owner claims as certified facts or clear a release.
The panel can inspect both circuits, target/profile options, current source
hashes, per-rule findings and diagnostic JSON snapshots. Gate/route-setting,
durable decisions and full verification profiles remain unfinished.
`bugmxt-debugging-checkpoint.md` records the applied five-layer review,
spec-drift fixes and remaining evidence limits.

The controlling documents are ARK Upgrade 1.0, XVL 1.1, VTE 1.0,
SHORT SPRINTS 1.1 and IMPRIMA 1.1. XVL 1.0 and SHORT SPRINTS 1.0 are
historical inputs, not additional work to build twice.

`source-index.json` contains 243 atomic prompts and 129 invariant entries:
125 specified rules and four missing source texts (SP-17 through SP-20).
Every entry points to its source file and line. Source hashes identify the
exact input versions. The combined dependency graph has no cycles; 18 distinct
Command Deck prompt references were unresolved in that initial index. The
subsequently supplied Command Deck PDF now supplies their source, but its
wrapped atomic tables still require normalization into the combined graph.

Run `node scripts/src/index-ark-upgrades.mjs` from the repository root to
rebuild the source index. Run `node --test scripts/src/index-ark-upgrades.test.mjs`
to check the parser and dependency ordering. Re-indexing never overwrites
`progress.json`, which is the evidence ledger, not a generated completion claim.

## Build order and release gates

| Order | Integration | Prerequisite / exit gate |
| --- | --- | --- |
| 0 | Reconcile register conflicts, missing SPCs, security findings, infrastructure and approval authorities | Preserve unresolved policy decisions; do not infer missing SP rules |
| 1 | Security remediation and Command Deck MAX trace/consent/capture contracts | Obtain SEC REP ONE and Command Deck MAX; define tenancy before RLS; establish secret rotation, artifact protection and provider agreement evidence |
| 2 | XVL 1.1: immutable evidence, verifier independence, track adapters, floors, approval registry, premise integrity | Trace contract and real verifiers; no self-assessed scores presented as independent verification |
| 3 | VTE 1.0: signed Stream E bridge, failure lifecycle, stable held-out splits, repair regression and human approvals | XVL events and Command Deck contracts; no content export before consent/security/license gates |
| 4 | ARK readiness / release / F12: Track A and separate HRI components, outcome rollups, release plans, staged rollout, rollback and incidents | Security closure, XVL checks, VTE incident bridge and actual deployment adapters; no simulated rollout claims |
| 5 | SHORT SPRINTS 1.1: eligibility, named approvals, verification packs, skipped-stage lineage, promotion and outcomes | XVL, F12, custody and release controls; resolve 90-minute eligibility conflict; firmware must retain F9 |
| Parallel after 1–2 | IMPRIMA 1.1: source adapters, canonical document model, protected spans, claim review, rendering, private versioned library and approval-controlled export | ADA/SKRIBE/KLARITY/SOCRATES specifications, storage/key decision, real rendering and golden-file validation |

This is a subsystem sequence, not permission to implement a subsystem
monolithically. The source index provides the dependency order for individual
prompts across documents. Its depth is a lower bound: unavailable external
contracts, human decisions and legal evidence are additional prerequisites.
Security Track R depends on XVL, so security remediation and the foundational
XVL adapter work must proceed together; security closure is a gate, not a
claim that all security work can precede every XVL component. The baseline MVP
is published; the larger upgrade program is not complete.

## Live-platform benchmark

On 2026-10-16, the deployment service reported a successful, public deployment
at https://command-center.atanda.ai. Read-only live checks found `/api/healthz`
and `/api/health` responding, with database and engine health reported as OK.
`/api/readyz` and `/api/launch-readiness` report database available, AI
configuration present, and `buildReady: true`. This does not verify an AI
provider call, every feature, or independent certification.

The production database contains 26 sessions, 123 artifacts, 189 Exemplar
library rows, and 6 Command Deck trace rows. The public Sphinx catalog reports
`publicOpen: false` and no items. The current published JavaScript bundle does
not include the recently implemented light/dark theme control, so that change
is not yet live.

Those checks verify service and database reachability only, not authentication,
tenant isolation, stage enforcement or any of the upgrade invariants. The
registry still has 129 of 129 invariant rows marked `UNVERIFIED`; no row has
been promoted to `ACTIVE` or `INACTIVE` without evidence tied to that rule.

Use these separate axes in `progress.json`:

- **ACTIVE:** demonstrated on the published version, with dated evidence.
- **INACTIVE:** confirmed disabled or absent on that version, with evidence.
- **UNVERIFIED:** not checked, inaccessible, or only demonstrated in development.
- **SPECIFIED / ENFORCED:** enforcement is a separate axis. Under the register,
  ENFORCED requires a passing I1-or-higher test recorded in XVL.

Do not convert every untested invariant to INACTIVE. Do not mark a development
feature ACTIVE on production merely because its implementation or tests exist.
Capture deployed version, evidence reference, scope, verification date and
independence level before advancing a row. The original uploaded register
remains unchanged.

## Fundamental missing inputs

The lists below describe the initial intake. See `source-intake-update.md`
for supplied cards, version mismatches, and the selected infrastructure ruling.

### Contracts and security

- COMMAND DECK MAX PDD v1.0, particularly trace/capture, consent, security,
  analytics and export contracts. Eighteen atomic prerequisites point to it.
- SEC REP ONE source report and any subsequent remediation/reassessment evidence.
  Its findings are reported by these PDDs; they are not independently verified
  findings from this intake.
- The source text for SP-17–SP-20 (Omnibus Alpha v1.0 or relevant v10.x PDD).
- The Azure migration/deployment specification if Azure is the target.
- Approved provider/subprocessor agreements and authority for release/repair
  approvals. Code cannot sign legal agreements or invent named approvers.

### Full SPCs / companion specifications not located

Full definitions were not located in the attachment inventory or relevant
repository implementations for HIVE MATRIX LABS, OSIRIS, ARES, ADA ULTRA SI,
SKRIBE, the publishing-oriented KLARITY, SOCRATES, CORDON, SPEC BUILDER v9.1,
STRATEGOS or KONSA. Registry summaries and inline role prompts are not complete
SPCs. Existing OSIRIS custody code is useful implementation, not a substitute
for the missing telemetry/signing contract.

ATLAS 360 PLAN v3.0.0 is present, but the requested PDD standard references
v4.0.1. The SPARTAN MVE full portability card was not located. ERB ULTRA SI
and its recertification specification, plus TRACES evalsets and license, are
also needed for their specific XVL branches.

Existing source assets include CELL, BUGMXT, CODE DJ, HOST DJ, VIBE,
ATHENA, MECHA, SPHINX, SPARTAN, ATLAS and MATHMON. Presence does not certify
the versions or prove a callable service exists.

### Infrastructure decision — Class B follow-on

UPG-SEC-002 specifies **Azure Key Vault with rotation**. On 2026-10-15 the
user explicitly authorized bypassing Azure requirements for the current MVP
as a **Class B follow-on build**. Azure setup is not a core launch gate.
Keep Replit hosting, the existing database and existing secret controls.
Do not migrate credentials or claim that Replit controls fulfill the original
Azure-specific requirement. Vault-dependent privileged operations remain
closed until verified. Other mandatory security, ownership, consent and
release checks are unchanged.

## Republishing

The baseline MVP is published and its public health/readiness endpoints respond.
The light/dark theme change is still local and requires another publish. After
that publish, verify the served client bundle. Authenticated create/save/reopen
and ownership-negative paths remain unverified; do not mark their invariants
ACTIVE until they are checked on the published version. Never publish
automatically.
