---
name: Preparation versus protected workflows
description: Limited publishable private preparation is distinct from SQL-protected approval, certification and release.
---

Keep the private preparation lane separate from the full protected workflow.
Never make missing SQL security objects silently select a superuser fallback
for protected operations.

**Why:** The managed Publish plan omitted custom guards. A useful release can
still transform already owner-accessible saved sources into private drafts and
proposal packages, without claiming approval, certification, qualification or
deployment. That is an explicit limited profile, not a weaker implementation
of the protected workflow.

**How to apply:** Use the existing authenticated owner-scoped artifact model
for preparation metadata and create-only private objects for bytes. Describe
its application-level isolation honestly. Never let a preparation advance
stages, issue a certificate, qualify a marketplace listing or claim Final.
The full lane keeps its database guards and remains closed when they fail.
Do not assert SPARTAN full-product FFS or FORGE certification for this subset.

The user requested explicit **IMPRIMA Internal** and **SHORT SPRINT Internal**
options operating in parallel with the original externally governed versions.
Use internal evaluation states honestly: absent evidence stays NOT_RUN /
INCONCLUSIVE, and internal results must not satisfy external verification,
Final approval, custody, marketplace qualification or release gates.

**Why:** Internal assessments should provide useful private working outputs
while independent verification remains a separate standard, not be disguised
as equivalent certification or an automatic response to failed protections.

**How to apply:** Preserve separate mode labels and the caveat in saved reports
and downloadable packages; never promote an internal PASS into an external
receipt or claim a model/editorial check ran when only recorded scores were
inherited.
