# ATANDA AutoCommand — delivery contract and launch acceptance

## Priority and boundaries

AutoCommand is the active priority. Unrelated fixes are paused. It belongs in the existing ACC
application at `/autocommand`; the separate atanda.ai source is required to add its navigation link.
The existing production floor remains unchanged. No production security repairs or database
administration are authorized by this implementation.

This is a specification service, not deployment, certification, copyright registration or an
executable agent hosting promise. Customers do not navigate individual F-stage screens.

## Products

| Product | USD per package | Product-specific contents |
| --- | ---: | --- |
| Basic AI Agent | $10 | MA + Micro PDD |
| Advanced AI Agent | $25 | SPC + SPC Cheat Sheet |
| AI-native Web Application | $50 | SPC + PDD + MVP PDD |

Every package also contains an F0 business document in editable DOCX for human completion,
general implementation guidance, ownership/creator declarations and provenance. All project
artifact titles start with the project name. Firmware, RobotWare and ChipWare stay unavailable.

The first package is free **per verified email address**, across accounts. Normalize case and
surrounding whitespace; do not invent Gmail-specific dot or plus-address normalization. A unique,
durable claim and transactional reservation are required at checkout. Saving a draft does not claim
the promotion or reserve a final price. A client-supplied email or shared staff handle is not verification.

## Intake milestone

The storefront has public product information and private, individually authenticated saved intakes.
Intake captures Prompt/Intake/Cartridge, F0 document type, product, project name, specification,
destination email, contact name and phone, owner, creator and optional company branding.
Input documents and logos enter through IMPRIMA Portal endpoints and private App Storage.
Original file bytes must not be stored in JSONB or exposed as public objects.

This milestone must not collect money, claim a promotion, start paid generation, simulate stage
progress, send mail or claim a completed package. The readiness response explicitly disables those
operations until their implementations and acceptance checks are complete.

## Automatic production milestone

1. Bind an immutable intake snapshot, owner declarations and accepted price to an order.
2. Resolve the exact applicable F-stage plan for the selected product.
3. Persist job, stage inputs, outputs, source hashes and state transitions before advancing.
4. Use the existing F-engine/Agent Creator capabilities; SPC Cheat Sheet is the first Agent Creator step.
5. Keep GRO, Honesty Gate and ZPOS requirements. Report internal assessments honestly; missing
   independent verification is not PASS. Do not invent facts to fill missing user requirements.
6. F8 produces implementation guidance within this specification-only profile, not an unpromised
   codebase or deployment. Basic/advanced paths skip inapplicable stages with explicit reasons.
7. F9–F12 never run. Standard-floor feature states and gates must not be marked complete by this profile.
8. Persisted progress drives the visual stage display. Reload/disconnection must not restart paid work.
9. Unknown provider outcomes require reconciliation, not blind redispatch. Bound retries and cost.

## Payment and publication milestone

- Separate Stripe **one-time** checkout from dormant recurring subscriptions.
- No client-supplied amount, success URL parameter or email alone establishes payment.
- Verify signed events and bind provider session, order, amount, currency and payment status.
- Enforce promotion uniqueness and concurrent submission idempotency in PostgreSQL.
- Show failure/remediation/refund handling explicitly. Free orders get a zero-value order record,
  not a fabricated Stripe payment receipt.
- Reconcile automatic email fulfillment with the existing subscriber-bound single-use IMPRIMA
  publication authorization. Do not bypass it by adding an unprotected attachment endpoint.
- Render professionally branded documents with author, owner, publisher, exact-version provenance
  and bottom-right `ATANDA.IMPRIMA` date/time stamps. Editable F0 content remains DOCX.
- General Cheat Sheet covers IDEs, vibe coding apps, LangChain, AWS, OpenAI Agents, Google Gemini
  Studio, Microsoft Copilot/Azure and Claude Skills, without claiming those targets were deployed.
- Deliver the exact authorized package and paid receipt to the selected target email. Record real
  provider success separately from package-ready state. Send required control copies using the
  subscriber's configured notification context. Failed/dry-run mail is never SENT.
- Buyer ownership is a recorded declaration/contractual term, not an automatic legal determination.
  No buyer package is submitted to SPHINX without separate rights confirmation and qualification.

## Launch acceptance

- Real verified-customer sign-in, draft persistence, cross-owner isolation and file validation.
- Concurrent first-free claims across two accounts with the same verified email.
- Free and each paid tier, webhook replay, delayed payment, cancellation and rejected payment.
- Each product produces every promised artifact, with correct names and editable F0 DOCX.
- Restart/disconnect recovery with no duplicate paid calls or delivery.
- Honest failed-governance remediation and no public exposure of private artifacts.
- IMPRIMA authorization, exact bytes, stamp/layout, recipient and control-copy delivery.
- Mobile, dark mode, keyboard navigation and reduced-motion behavior.
- atanda.ai navigation handoff verified in that website's own source.

**Not ready to publish as a paid service until the automatic production and payment/publication
milestones pass.** Public source-only demonstrations must retain the intake-only launch notice.

## Intake milestone verification — 2026-10-30

Implemented in the development build:

- Public `/autocommand` catalog, ACC landing/navigation entry and individual sign-in/registration.
- Verified-email private intake drafts with server validation, owner-scoped reads and idempotent saves.
- IMPRIMA intake uploads to private storage, document extraction and retained source filenames.
- Contact/ownership fields, optional company branding, target guidance choices and unavailable products.
- Explicit checkout/generation/delivery unavailability, without fabricated stage progress.
- Customer logout returns to AutoCommand and removes the private workspace from view.

Checks performed:

- OpenAPI code generation and shared-library type checks passed.
- API and frontend type checks passed; frontend production build passed.
- Twelve targeted backend tests passed, covering catalog, unavailable products, identity rejection,
  private persistence, concurrent duplicate saves, owner isolation, input validation and foreign files.
- Development browser journey passed: individual verified identity, real text-document upload,
  save, reload, reopen with exact filename and contact details, and phone-width dark-mode readability.
- Focused logout privacy verification passed after adding the missing customer logout control.

The browser test helper rejected a reserved `.test` sign-in address. The approved helper succeeded
with a unique reserved `example.com` test identity; authentication was not weakened or bypassed.

Still outstanding within the original AutoCommand scope: automatic generation and recovery,
Agent Creator integration, actual stage-progress tracking, editable package rendering,
one-time payments/promotion enforcement, IMPRIMA authorization and email fulfillment/receipts.
Existing protected publication controls were not repaired or bypassed. The separate atanda.ai
navigation has not been changed. No production migration, paid generation or publication occurred.
