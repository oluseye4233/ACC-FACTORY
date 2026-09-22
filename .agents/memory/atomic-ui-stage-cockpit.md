---
name: ATOMIC UI stage cockpit
description: The durable interaction model for ATANDA workflow stages
---

ATANDA workflow stages follow the ATOMIC UI principle: the complex engine stays
under the hood while each stage is presented as one clear, full-page operating
context. Every implemented stage must show where the user came from, what they
are doing now, and where they can go next, with progress visible at the top.

**Why:** The user explicitly chose a car-cockpit model so operators can move
through a complex F-stage workflow without needing to understand the underlying
engine architecture.

**How to apply:** Reuse the shared cockpit pattern for new workflow surfaces.
Expose real upload/download and connected-feature actions without adding fake
controls or bypassing server gates. Derive color from ATANDA brand assets and
keep text/background contrast legible.