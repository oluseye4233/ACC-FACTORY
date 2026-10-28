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

Optional supporting tools—Boomerang, SPC Player and F0 Advisory—belong in
bottom-centred boxes beneath the current stage workspace, with expandable
explanations of purpose, outcome, usage and the exact return path.

**Why:** The user wants supporting work accessible without interrupting the main
production task or leaving users unsure how to return revised artifacts.

**How to apply:** Preserve the originating session, F-stage and applicable source
artifact when launching support. Show how returned work reaches that origin;
distinguish navigation back from actual reviewed artifact adoption. Do not
replace these boxes with extra production gates or imply advice clears a gate.

Completed origin-bound supporting work should offer the explicit primary action
“RETURN TO THE STAGE YOU LEFT WITH NEW ARTIFACT AND CONTINUE PRODUCTION”.

**Why:** The user requested a single understandable action that carries revised
work back, rather than a generic Back link that only changes location.

**How to apply:** Persist the actual returned artifact before navigating to its
exact session, stage and artifact. Keep plain navigation labelled separately.
Continue means resuming production with review and applicable evaluation, not
automatically executing an engine, adopting advice or clearing a gate.