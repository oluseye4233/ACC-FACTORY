---
name: F8 verification evidence
description: The trust boundary and wording for CI/IDE evidence attached to F8 code bundles.
---

F8 CI and IDE PASS evidence is currently operator-submitted. The application
records the run or workspace reference, command, and summary, but does not run
or independently validate the external tests. A verified child therefore means
that an operator-submitted PASS record was accepted, not that a CI provider
cryptographically attested to the result.

**Why:** No CI or IDE provider is queried by the current verification flow, so
describing the result as independently verified would overstate what the system
knows.

**How to apply:** Keep this limitation visible in F8 UI and downstream wording.
If provider-backed validation is added, bind the successful run to the tested
repository commit or file content before treating it as provider-verified.