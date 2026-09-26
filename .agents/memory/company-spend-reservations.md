---
name: Company spend reservations
description: Contract semantics for displaying completed LLM charges alongside temporary in-flight reservations.
---

# Company spend reservations

Keep completed provider charges and temporary in-flight reservations as separate values in staff-facing cost views. The completed-spend field excludes reservations; remaining budget and warning/enforcement percentages use completed spend plus active reservations.

**Why:** A conservative estimate can block a new model call before the provider has charged the reserved amount. Combining that estimate with completed charges would mislabel estimated spend as an actual charge, while ignoring it would make the meter disagree with enforcement.

**How to apply:** Read completed ledger rows and active reservations from one database snapshot. On successful calls, the existing transaction replaces a reservation with its actual run row; on failure, release the reservation. Show both values and remaining budget distinctly in any cost view, and update the OpenAPI contract before regenerating clients.