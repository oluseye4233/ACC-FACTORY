# SPARTAN private preparation release

## Release boundary

This is a working, deliberately limited preparation release, not activation of
the complete IMPRIMA or SHORT SPRINTS product. It uses SPARTAN's inventory,
classification and platform-adaptation approach as an analyst overlay. No
FORGE, JCSE, full-product FFS=100%, independent-security or compliance
certification is asserted.

Production activity remains **INACTIVE until this build is published and its
authenticated operations are observed there**. A passing preview is not live
evidence.

### Available in the preparation lane

- Authenticated owners select existing session-backed saved sources.
- IMPRIMA renders source-preserving **DRAFT** HTML, DOCX and Unicode PDF files.
  The author is taken from the authenticated account profile; the human-author
  checkbox is an assertion, not independently verified identity.
- All formats use one canonical document/content hash. No LLM call, editorial
  rewrite, truthfulness score, approval or paid model run is performed.
- SHORT SPRINTS SC ONE packages the saved Micro PDD and its CELL birth package;
  SC TWO packages the saved SPC, configuration and standalone agent spec sheet.
- Saved artifact metadata survives navigation and reload. Individual files,
  an exact-byte integrity manifest and a ZIP are privately downloadable.
- Secret-like, injection-flagged and safety-sensitive sources are rejected;
  they must use the guarded review workflow rather than silently bypass it.
- The API bounds source/output sizes, rejects non-owner sources and downloads,
  limits each account to 30 preparations in a rolling day, and serializes
  concurrent archival commits per owner.

### Explicitly unavailable in preparation

Final approval/publication, YES eligibility rulings, stage skipping, source
qualification, signed verification packs, marketplace qualification, external
handoffs, live deployment, traffic control and rollback execution.

Every preparation manifest has `releaseAllowed: false`. It does not modify
session stage state or write to the SQL-protected workflow tables.

These omitted user-facing capabilities are **outside this narrow release
profile**, not renamed as serving-scale/Class C work. The original full-product
requirements remain open; this document does not claim their fidelity gate.

## Compatibility assessment of the supplied ARK RLS package

The supplied package is Tier 0 and introduces `imprima`, `short_sprints`, `app`
and `ark_meta` schemas, separate login credentials, organisation/user context
and claim-based publisher/approver roles. The running platform uses existing
public-schema workflow tables and locally resolved authenticated user IDs.
Installing the package verbatim would create a second data model rather than
protect the already-built features.

| Package concern | Adaptation / current result |
| --- | --- |
| Restricted application permissions | New development migration removes DELETE/TRUNCATE on protected tables and UPDATE on immutable files/audit events from the existing restricted operations role. No data is replaced. |
| Fail-closed verifier | Shared read-only readiness checks role attributes, five forced-RLS tables, owner/admin policy bindings, exact trigger/table/function attachments and restricted permissions. |
| Transaction-local identity | Existing authenticated actor transaction remains authoritative for the full workflow. There is no authentication migration or invented organisation mapping. |
| Immutable storage | Full SQL Final/file update guards remain. Preparation bytes use create-only private App Storage objects; metadata is saved as a new, unverified, non-FORGE artifact. |
| Startup migration runner | **Not adopted.** Managed Publish owns production schema changes. No production DDL, deploy-build migration or startup self-healing is added. |
| Organisation/delegate/approver tables | Not imported or claimed active. They require an explicit data/authentication mapping before integration. |
| Destructive security fixtures | Not run against customer data. Automated fixtures are scoped to unique test owners; no live certificate or provider evidence is invented. |

## Stack adaptation

| Component | Treatment |
| --- | --- |
| Source selection, private save/reload/download, real output formats and integrity | User-facing capabilities retained in the preparation profile. |
| New SQL schema required for basic file preparation | Platform-native equivalent: existing owner-scoped artifact metadata plus private App Storage. **Not equivalent to independent database RLS protection**, and never used as a fallback connection into guarded tables. |
| Host-specific Unicode font installation | Hash-pinned DejaVu Sans is also archived in App Storage for hosts without the workspace font path. Font notice: `docs/licenses/dejavu-font.md`. |
| Independent verification and deployment infrastructure | Remains separate and unavailable without genuine approved verifier/provider connections. |
| Orphaned-file recovery and higher-volume controls | Scale follow-up; complete before increasing the 30/day limit or after observed orphan accumulation. Never delete files from an uncertain commit without proving they are unreferenced. |

## Full workflow remains fail-closed

The full operations endpoints still require all database guards. When they
are absent, the UI shows the failed checks and disables the protected workflow;
the server rejects its commands before processing sources or spending money.
Preparation endpoints are distinct and do not call that transaction wrapper
with a superuser fallback.

The current proposed Publish diff is additive and reports no structural data
loss, but still omits required custom SQL security objects. Therefore it does
**not** authorize full-workflow activation. The preparation profile does not
depend on those omitted objects.

## Release and upgrade gates

1. Publish the tested preparation profile using normal managed Publish.
   Do not select any option that overwrites production data with development
   fixtures. No production database change has been made by the agent.
2. In production, authenticate normally, create one private preparation, reload
   it, download its files and compare the manifest hashes. Confirm other-account
   access is rejected and the protected-workflow status is truthful.
3. Mark preparation activity ACTIVE only after those actual production
   observations. Keep the full workflow inactive if any SQL check fails.
4. Enable Final only after production SQL guards and named approval/immutable
   version tests pass. No release status is inferred from a policy name alone.
5. Enable genuine SHORT SPRINTS release only with approved independent
   source/pack verifiers and real custody/provider deployment-health-rollback
   evidence. Receipts alone do not execute a deployment or route traffic.

## Verification

Workspace type checks and production frontend build pass. Full regression
suite: **806 passed, 40 skipped**, plus preparation-template and daily-quota regressions
added after browser testing. Preparation service tests simulate missing
database guards without altering shared development security, check both
circuits and all three formats, validate ZIP/file hashes after JSONB persistence,
reject cross-owner access and unsafe/Final requests, and prove no stage or
protected workflow record is created.

Signed-in browser testing confirmed private IMPRIMA draft and SC TWO creation,
reload and real downloads; ZIP/file hashes and protected content matched.
Missing guards were simulated only in workspace GET responses, not creation or
download responses. Anonymous downloads returned 401 and another authenticated
account received 404. Both screens fit a 390px viewport. SC ONE was verified by
the persisted service tests, not this browser pass.

The browser pass found an empty model in the shared sample. The preparation
form now has its own valid sample with explicit NOT_CONFIGURED infrastructure;
the full workflow still requires a real model selection. This narrow fix is
covered by a frontend regression and a direct server schema check rather than
a second browser run.
