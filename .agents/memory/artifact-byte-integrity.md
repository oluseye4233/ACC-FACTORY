---
name: Artifact byte integrity
description: Preserve serialized file bytes across JSONB persistence when manifests, exports or receipts bind SHA-256 hashes.
---

A byte-bound artifact must retain its exact serialized UTF-8 content.
Equivalent JSON values are not equivalent file bytes: PostgreSQL JSONB can
reorder object keys, so reserializing a stored object can change the file hash.

**Why:** The protected Short Sprints UI advertised creation-time hashes while
later exports regenerated two files from JSONB and produced different bytes.
Type checks and signature tests did not expose that persistence boundary;
comparison against actual UI downloads did.

**How to apply:** Archive the exact file strings before database persistence,
then verify name, byte hash and size against the immutable manifest when
exporting or assembling a release. Never repair this by quietly rewriting an
existing signed manifest. If historical original bytes cannot be recovered
and matched, fail closed and create a new proposal/version.
