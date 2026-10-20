---
name: Development workflow ownership
description: Managed workflow failures can coexist with older serving development processes.
---

A failed managed workflow with an address-in-use error does not by itself prove
the preview is down: an older development server can still own the expected
port and return healthy responses.

**Why:** workflow ownership became detached from already-serving development
processes, and restarting the failed workflow alone attempted a second listener.
Changing artifact ports or adding replacement workflows would hide, not resolve,
the ownership conflict.

**How to apply:** verify the listening process identity, working directory and
HTTP response before stopping anything. Stop only the positively identified
obsolete development listener, then restart the existing managed workflow.
Do not kill unrelated Node processes or infer a production outage from this.
