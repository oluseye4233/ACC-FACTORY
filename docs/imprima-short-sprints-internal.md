# IMPRIMA Internal and SHORT SPRINT Internal

These explicit internal-assessment options run alongside private preparation
and the original protected workflows. They are not automatic fallbacks for
failed external or database security gates.

## Using the internal options

1. Open IMPRIMA or SHORT SPRINTS in the Operations workspace.
2. Choose **IMPRIMA Internal** or **SHORT SPRINT Internal**.
3. Select an owned, saved session-backed source.
4. For IMPRIMA, enter the title/project, confirm the human author, and choose
   document formats. Output remains **DRAFT**.
5. For SHORT SPRINT, select SC ONE with an F4 Micro PDD or SC TWO with an F5 SPC,
   and supply the proposed manifest and host target.
6. Run the internal assessment. Read the overall result and each check.
7. Download the files, `internal-evaluation.json`, or the ZIP. The integrity
   manifest records internal mode, source hash and report/file hashes.
8. Reload the workspace to inspect the saved, owner-scoped assessment.
   Corrections create a new preparation; they do not overwrite archived bytes.

## Evaluations actually performed

- Existing source/manifest safety screening, including refusal paths.
- Source-version binding.
- Comparison of **already recorded scores on the exact selected source**:
  JCSE against 45 and MATHMON against 70. These are the existing FORGE
  VERIFIED comparison thresholds, not a new certificate.
- For SHORT SPRINT, the existing deterministic JSON contract adapter checks
  manifest shape, and the existing sprint eligibility policy evaluates the
  available facts. Manifest tool count is bound to the manifest hash.
- Facts requiring certified or measured evidence remain UNKNOWN. Manifest
  declarations do not establish source certification, elapsed build time,
  independent review, absence of critical issues or agent runtime behaviour.

No fresh model evaluation, KLARITY/SOCRATES editorial review, independent
verification pack, agent execution or deployment is performed.

## State interpretation

| State | Meaning |
|---|---|
| PASS | The particular bounded check met its criterion. |
| FAIL | A performed comparison or policy check failed. |
| NOT_RUN | Required evidence/check is absent; never interpreted as PASS. |
| INCONCLUSIVE | Missing evidence prevents a conclusive overall assessment. |

The report is FAIL if any check fails, otherwise INCONCLUSIVE if a check is
NOT_RUN or INCONCLUSIVE, otherwise PASS. A report PASS is internal only.
Preparation lifecycle states remain PREPARED_DRAFT / PREPARED_PROPOSAL;
verificationStatus stays UNVERIFIED, forgeVerified stays false, and
releaseAllowed stays false.

## Parallel operation and security

The original protected tables, role/RLS requirements, approval commands,
external receipts, custody and release paths are unchanged. Internal mode
uses the existing private preparation store, owner checks and create-only
private file archive. It does not claim the original workflow's stronger
database isolation and cannot satisfy external release gates.

Internal outputs cannot grant Final approval, marketplace qualification,
certification, custody, stage advancement or deployment. Existing
preparations without mode metadata remain ordinary PREPARATION records.

Deployment requires republishing the application; no new schema migration,
production security installation or production data mutation is needed for
this addition. Existing startup migration/verification protections remain.
