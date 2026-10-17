# SEC REP ONE — current replacement security assessment

**Assessment date:** 2026-10-16  
**Scope:** current development repository, resolved dependencies and read-only
development database metadata. **Overall status: INCOMPLETE / NOT CERTIFIED.**

This is a newly produced replacement assessment under the user's instruction
to fill missing inputs from available specifications. The original SEC REP ONE
and its scoring rubric were not supplied. Its quoted historical 41/100 is
**not** a current measurement. No replacement composite has been invented.
Nothing here proves the published production version has the same controls.

## Actual automated observations

| Check | Initial observation | After critical dependency remediation |
|---|---|---|
| Dependency audit | 12 critical, 45 high, 42 moderate, 10 low | 0 critical, 39 high, 39 moderate, 10 low |
| Static code scan | Completed; zero reported findings | Not rerun after changes; not proof of absent runtime flaws |
| Privacy/dataflow scan | Failed with `HOUNDDOG_SCHEMA_MISMATCH` | Inconclusive; no clean privacy result |
| Development database RLS metadata | 79 public tables; 0 with row-level security enabled | No RLS changes made |

Counts are advisory instances, not unique exploitable vulnerabilities or
individual packages. Applicability and runtime/development exposure still
require triage. An audit count of zero critical dependencies is not a clean
security assessment.

### Critical advisories addressed

- **Orval:** the initial audit reported eleven critical code-generation
  injection advisories against 8.9.1. Updated to resolved 8.43.0 within major
  8. The local OpenAPI source is controlled, but vulnerable tooling should
  still be replaced rather than relying on that fact.
- **proxy-addr:** updated the vulnerable 2.0.7 resolution to the patched 2.0.8
  family, covering the reported IPv4-mapped IPv6 trust-subnet spoofing issue.
- Regenerated API clients using explicit React Query v5 and Zod v3 targets,
  preserving the existing application contracts. Added DOM iterable types for
  the generator's standards-based Headers handling.

### Remaining high advisory groups

The follow-up dependency scan still reports high advisories for:
`@xmldom/xmldom`, `brace-expansion`, `braces`, `browserslist`, `fast-uri`,
`form-data`, `http-proxy-middleware`, `js-cookie`, `multer`, `postcss`,
`protobufjs`, `source-map-js`, `undici`, `vite` and `ws`.

These need parent/dependency-chain review, compatible updates and applicability
checks. Some involve build/development code or platform-specific paths; that
does not justify blanket dismissal. The scanner supplied no fixed-version
recommendation for its `braces` finding; do not fabricate one or bypass package
security controls. Broad untested package replacements were not made as part
of this critical-patch change.

## Upgrade PDD critical-control assessment

| Required control (Upgrade §4.7) | Evidence available now | Current conclusion |
|---|---|---|
| Tenant database RLS | Read-only metadata query found no public table with RLS enabled | Absent in checked development database; API ownership checks do not satisfy database RLS |
| Azure Key Vault and rotation | User explicitly deferred Azure as Class B; existing secret controls retained | Documented deferral, not satisfied and not a claim that environment secrets meet the requirement |
| Provider/subprocessor DPAs | No executed agreements supplied or verified | UNVERIFIED; software or chat authorization cannot manufacture legal agreement |
| Artifact encryption / client-managed key option | Artifacts are handled as structured JSON in application data; storage-provider encryption/key control was not attested in this assessment | UNVERIFIED; JSON representation alone does not establish whether storage is encrypted at rest |
| Injection screening, tool allowlists and Track R release probes | Existing guards are not a completed independent Track R release adapter | Full required release control not demonstrated |

The CODE DJ card's defensive-containment requirements and ADA's least-privilege,
STRIDE and data-protection checks guide this assessment. Their self-described
certification/scores are not runtime evidence. The newly supplied ARES card is
strategic/adversarial reasoning, not an independent security audit service.

## Required next work

1. Triage and fix remaining high dependencies in compatible families; verify
   affected upload, proxy, provider and generated-client paths.
2. Design tenant-scoped database roles and RLS with transaction-scoped tenant
   context, background-job behavior and negative isolation tests. Do not turn
   RLS on blindly under an owner/bypass role.
3. Resolve privacy-scanner failure or obtain an equivalent scoped review; keep
   its result INCONCLUSIVE until there is actual evidence.
4. Record legal/encryption/rotation evidence from their accountable owners.
5. Add real Track R and provider health/recovery adapters before claiming
   regulated/Standard readiness or full F12 staged-release operation.

## Operational consequence

Existing usable platform features are not disabled by this assessment. However,
this document cannot clear the full security, independent-verification,
SHORT SPRINTS, IMPRIMA or F12 release gates. The database, provider target,
named authenticated approval authority and observed rollback evidence remain
separate controls. Replit publication is still a user action.
