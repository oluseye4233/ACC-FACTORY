# AutoCommand: durable order and pipeline foundation

## Customer capability in this build

An individually verified customer can save a brief, prepare a production order,
and reopen its saved progress after reload. Preparing the same draft again
returns the same order. The server freezes the validated input, source-file
hashes, verified identity, standard USD price and versioned stage plan.
Changing a brief requires a new draft/order; it does not rewrite the original.

Only F1 intake validation completes during preparation. This validates identity,
owned source references and intake shape; it is not a generated specification,
governance evaluation, payment, free-offer redemption or publication.

| Package | Saved applicable sequence |
| --- | --- |
| Basic | F1, F0, F2, F3 MA, F4 Micro PDD, F8 implementation guidance |
| Advanced | F1, F0, F2, F3, F4, F5 SPC, SPC Cheat Sheet, F8 implementation guidance |
| Web application | F1, F0, F2, F3, F4, F5 SPC, SPC Cheat Sheet, F6 PDD, F7 MVP PDD, F8 implementation guidance |

The SPC Cheat Sheet follows SPC creation and precedes remaining package steps.
F8 is a bounded specification-guidance adapter here, not a promise of executable
or deployed code. F9–F12 remain outside this offering. Final packaging must also
include the general implementation cheat sheet and editable F0 DOCX.

## Runner boundary

The server-only runner is deliberately disconnected from customer dispatch:

- Automatic production readiness remains false.
- There is no customer run, checkout or download-bypass endpoint.
- No production adapters or payment/free-order authorization grant are installed.
- Tests inject explicitly fake adapters and authorization; no provider is called.
- Each external dispatch intent is committed before adapter invocation.
- A duplicate caller cannot take a dispatch that is already in flight.
- Completed steps are retained and reused, not regenerated.
- An exception or uncertain result stops for review. Age does not permit retry.
- A process interrupted during dispatch remains in-flight-or-uncertain.
- Dispatch completion uses the claim token and expected state.
- Changed snapshots, incompatible plans and missing stage rows fail closed.
- All stage completion ends at **awaiting publication**, never delivered.

Adapter implementations still must enforce budget reservation, durable provider
run accounting, correct engine preconditions, actual saved artifact provenance,
output validation and current governance requirements. Artifact-reference
metadata alone is not proof of those checks.

## Still needed for commercial activation

1. Implement and verify the real product-specific stage adapters and outputs.
2. Connect durable paid/free-order grants, once-per-verified-email promotion
   claims, one-time payment confirmation and idempotent payment events.
3. Connect final exact-byte package rendering and authorization to the existing
   IMPRIMA Portal scoped email and control-copy system. Do not add another mail
   service or treat payment as publication consent.
4. Finish output, receipt, recovery and delivery acceptance with checkout closed
   until the end-to-end offering is confirmed.

The development migration adds only the AutoCommand order/step tables.
No production security installation or production migration was performed.
