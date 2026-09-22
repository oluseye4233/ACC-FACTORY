---
name: Exemplar Library open marketplace
description: Durable separation between the internal open library and the paid Sphinx marketplace
---

The Exemplar Library is the open marketplace for authenticated backend users.
It accepts staff-contributed SPC, MA, MPDD, and PDD content. Contributions copy
artifact content into an independent library record rather than depending on
the source session or artifact lifecycle.

**Why:** Harness sessions and their artifacts can be deleted, while a library
contribution must remain usable as a shared exemplar. Sphinx is a separate paid
frontend marketplace and must not be reused as the persistence or publication
channel for the internal library.

**How to apply:** New library contribution paths should write independent
library records and use staff authentication. Keep “Upload to Exemplar Library”
and “Upload to Sphinx” as distinct actions with distinct access and commercial
semantics.