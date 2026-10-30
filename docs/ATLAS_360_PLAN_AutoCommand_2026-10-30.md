# AutoCommand — ATLAS 360 PLAN

## Document control

| Field | Record |
| --- | --- |
| Product | ATANDA AutoCommand |
| Document | Dedicated living PromptWare Design Document and delivery plan |
| Baseline | 1.0 — 30 October 2026 |
| Commissioning organization | ATANDA |
| Prepared by | Replit Agent, applying ATLAS methodology for ATANDA review |
| Human approver | To be designated by ATANDA |
| Current scope | Specification-package storefront inside the existing ACC |
| Current release status | Development intake milestone verified; paid service NOT READY |
| Evidence boundary | Repository implementation and recorded development checks; no new production audit |
| Certification | No independent JCSE score, FORGE certification or legal certification issued |

This is a project-specific PLAN, not a declaration that every requirement is implemented.
It preserves the existing ARK production floor. It does not authorize production security
changes, deployment, external publication or paid provider testing.

## Reading guide

- Part 1 — Cheat Sheet: product, prices, package contents and immediate decisions.
- Part 2 — Executive Summary: customer experience, requirements, architecture and risk.
- Part 3 — Atomic Prompt Worksheet: 45 dependency-ordered work items in five phases.
- Part 4 — Implementation Plan: delivery sequence, responsibilities and launch acceptance.
- Addenda — Current sitemap, evidence register, decisions and living-document updates.

---

## PART 1 — CHEAT SHEET

### 1.1 Atomic solution summary

ATANDA AutoCommand turns a customer's brief into a governed, attributed specification package
through one customer-facing intake and an automatic, product-specific F-stage workflow.
The customer buys an outcome rather than operating each production stage.

Positioning: **AI-DRIVEN FAST CONSULTING.**

Customer promise: describe the intended product, identify its owner and creator, choose a
package, authorize the order, then receive the authorized specification package and receipt.
Do not advertise immediate delivery times until measured production evidence supports them.

### 1.2 Product and fee schedule

| Package | Standard price, USD | Product-specific artifacts |
| --- | --- | --- |
| Basic AI Agent | $10 per package | MA specification + Micro PDD |
| Advanced AI Agent | $25 per package | SPC specification + SPC Cheat Sheet |
| AI-native Web Application | $50 per package | SPC specification + PDD + MVP PDD |

Every package also contains:

- One selected F0 business-document draft in editable DOCX, explicitly for human completion.
- A General Implementation Cheat Sheet explaining application of the specifications.
- Declared owner and creator, project-first artifact titles, provenance and publication metadata.
- An order record; a provider-backed payment receipt for paid orders or a zero-value order
  acknowledgment for the free promotion.

The first package is free **once per verified customer email address**, for any of the three
available package types. The destination email is not the promotion identity. Saving a draft does
not claim the free package. Normalize email case and surrounding whitespace; do not silently
merge provider-specific aliases or punctuation.

Firmware, RobotWare and ChipWare remain inactive, visible future choices. F9 is a future
offering; F10, F11 and F12 are outside this specification-package product.

### 1.3 Five customer benefits

- One intake instead of repeatedly operating technical F-stage screens.
- Defined package contents and one-time pricing, separate from recurring subscriptions.
- Editable business material and portable implementation guidance.
- Transparent attribution: an individual's owner/creator or company owner/member creator.
- Visible governance and honest limitations rather than unsupported certification claims.

### 1.4 Current status

| Capability | Development status | What this means |
| --- | --- | --- |
| Public catalog and ACC navigation | Implemented and browser checked | Products and standard prices can be viewed |
| Individual verified-email access | Implemented and browser checked | Shared staff codes do not identify customers |
| Private intake and source uploads | Implemented and browser checked | Drafts and original filenames persist |
| Corporate intake and ownership fields | Implemented; backend validation covered | Company owner and individual creator remain distinct |
| Customer logout | Implemented and browser checked | Private workspace disappears after logout |
| Automatic F-stage orchestration | Not connected | No automatic generation currently starts |
| Agent Creator package integration | Not connected for AutoCommand | Existing capabilities are not an AutoCommand completion |
| First-free enforcement and one-time payment | Not connected | No charge or free-offer claim currently occurs |
| AutoCommand package handoff to existing IMPRIMA email | Not connected | Portal email exists; AutoCommand does not yet submit finished packages |
| Separate atanda.ai navigation | Not changed | Requires that website's source project |

“Implemented” in this table means the development build, not live-production acceptance.

### 1.5 Production card

| Dimension | AutoCommand decision |
| --- | --- |
| Storefront | Existing ACC route `/autocommand`; separate atanda.ai link |
| Primary input | Prompt, document intake or cartridge-context brief |
| Current F0 choices | Business analysis, business plan, business case, feasibility study, product brief |
| Product engine | Existing F capabilities through a new product-specific orchestrator |
| Agent preparation | Existing Agent Creator capability, limited to the purchased specification deliverable |
| Publisher | IMPRIMA Portal, with reviewed order-bound authorization |
| Payments | Stripe one-time orders, independent of dormant subscription billing |
| Files | Private App Storage; queryable metadata in PostgreSQL |
| Operator control | Bounded cost, persisted progress, auditable exceptions and recovery |
| Token economics | NOT MEASURED for completed AutoCommand packages |

No generic ATLAS benchmark or ZPOS percentage is presented as a measured result for this product.

---

## PART 2 — EXECUTIVE SUMMARY

### 2.1 Business context and scope

ACC already contains a governed specification-driven production floor. AutoCommand packages
that capability for customers who want a usable set of specifications, not a tutorial in
internal stages. It is a consulting-product storefront, not a replacement production system.

The McDonald's/drive-through analogy explains the service model: a small, understandable menu
and a coordinated fulfillment process. It is positioning, not evidence of equivalent operational
speed, market impact or economics.

The initial offering stops at a specification package and implementation guidance. An MA or SPC
specification is not a hosted agent, an installed integration or an independently tested application.
Do not add a deployment promise merely because Agent Creator or F8 is used internally.

### 2.2 Intended customer journey

1. Enter AutoCommand from the ACC landing page or the future atanda.ai navigation link.
2. Select Basic Agent, Advanced Agent or AI-native Web Application.
3. Choose Prompt, Intake or Cartridge context and supply the specification.
4. Choose the F0 business-document type and intended production-guidance targets.
5. Enter destination email, contact name, phone, owner and creator.
6. Optionally add the company name and upload its logo through IMPRIMA intake.
7. Sign in with an individually verified email and confirm rights to the source material.
8. Receive a server-calculated quote; apply first-free eligibility or complete one-time payment.
9. Observe persisted progress through the applicable specification-production stages.
10. Receive the authorized package and order/payment acknowledgment at the designated email.

Steps 8–10 are the target design, not current behavior. Any unresolved publication confirmation
is an explicit customer action, never a hidden bypass of existing controls.

### 2.3 Atomic intake requirements

| Input | Contract |
| --- | --- |
| Project name | Required; becomes the leading element of produced artifact titles |
| Package type | Exactly one of the three currently offered products |
| Intake mode | Prompt, Intake or Cartridge |
| Specification | Required description of intended behavior, constraints and desired outcome |
| Intake document | Required in Intake mode; TXT, MD, PDF or DOCX through IMPRIMA |
| Cartridge context | Existing SPC/reference context; current save is not execution of the cartridge compiler |
| F0 document type | One supported editable business draft |
| Guidance targets | One or more supported environments; guidance is not deployment |
| Destination email | Explicit delivery address, distinct from verified purchaser email |
| Contact details | Contact name and phone |
| Owner and creator | Both required; company owner/member creator for corporate packages |
| Corporate branding | Optional company name and PNG/JPEG logo |
| Rights declaration | Authority to use and request processing of supplied material |

Current development limits: specification up to 40,000 characters; cartridge context up to
20,000 characters; document file up to 5 MB; logo up to 2 MB. Publish these constraints in the UI.
Do not silently truncate a larger source into a materially different specification.

### 2.4 Proposed automatic production profile

The orchestrator must use explicit adapters to existing engines. Calling a shared LLM helper
with an F-stage label is not proof that the corresponding engine, checks and persistence ran.
Adapter outputs must identify source artifacts and the evidence actually produced.

| Stage | Specification-only responsibility | Application |
| --- | --- | --- |
| F1 | Validate and bind the intake; diagnose requirements | All products |
| F0 | Draft the selected business document using the intake | All products |
| F2 | Structure the atomic specification | All products |
| F3 | Prepare the MA or applicable precursor capability model | Basic required; other paths adapter-dependent |
| F4 | Produce the Micro PDD | Basic package |
| F5 | Synthesize the SPC | Advanced and web packages |
| F6 | Produce the PDD from an eligible F5 artifact | Web package |
| F7 | Produce the MVP PDD under the chosen scope | Web package |
| F8 | Produce specification-implementation guidance | All products, through a reviewed specification-only adapter |
| F9–F12 | Hardware verification, external handoff and deployment | Excluded |

This matrix is the proposed routing contract. Engineering must validate each adapter's actual
preconditions before implementation. An inapplicable stage is visibly “Not required for this
package,” not PASS and not a completed standard-floor gate.

F8 in the standard floor may create editable code. AutoCommand does not promise a codebase in
its initial package menu. The specification-only F8 profile therefore needs an explicit adapter;
do not weaken or bypass the normal Code DJ or drift requirements to emulate one.

For an Advanced Agent, save the SPC Cheat Sheet before subsequent Agent Creator preparation.
Do not automatically launch the created agent or fast-track it to F10–F12 in this offering.

### 2.5 Graphical production display

The customer sees a single order page with the product-specific path, current stage, completed
outputs, skipped stages with reasons, and any action required. It is driven by persisted job state.

```workflow
Intake + verified identity
Quote + order authorization
Confirmed payment or reserved free offer
Applicable F1 / F0 / F2–F8 adapters
Validated, attributed specification package
IMPRIMA authorization + delivery
Confirmed email outcome + receipt
```

Never use a timer-driven animation as evidence that a stage completed. Distinguish READY,
DELIVERY_PENDING and SENT. Reconnecting or opening another tab loads the same order state.

### 2.6 Package artifact contracts

| Artifact | Minimum content and format |
| --- | --- |
| F0 business draft | Editable DOCX; assumptions, missing facts and human-completion areas marked |
| MA | Governed instructions, intended capability, constraints and provenance |
| Micro PDD | MA-linked requirements, interface expectations, scope and implementation guidance |
| SPC | Governed specification with explicit source lineage and limits |
| SPC Cheat Sheet | Nine required fields listed below |
| PDD | Structured requirements, design, implementation approach and acceptance criteria |
| MVP PDD | Bounded launch scope, exclusions, dependencies and acceptance evidence |
| General Cheat Sheet | Target-specific application instructions and safety cautions |
| Manifest | Order reference, exact filenames, artifact types, versions, hashes and attribution |
| Order acknowledgment | Actual price/promotion record; genuine paid receipt reference where applicable |

SPC Cheat Sheet fields: SPC name; project filename; synthesized-SPC lineage; date/time;
Junglenomics skill sets; SAVANT colonization guidance for selected targets; constraints and
ethical integrations; author; owner. Unavailable lineage, skills or evidence are marked unrecorded,
not invented.

All project titles start with the project name. Rework creates a new immutable package version
and retains the previous source and evidence. Use a distinguishable upgraded/version label.

### 2.7 General Cheat Sheet coverage

- IDE: file roles, import/application steps, editable inputs and tests still required.
- Vibe coding app: requirements handoff, constraints to retain and iterative review.
- LangChain: specification-to-agent mapping, tools boundary and evaluation responsibilities.
- AWS: target identification, permissions, secrets and deployment decisions left to the customer.
- OpenAI Agents: instructions, tool scope, environment configuration and verification.
- Google Gemini Studio: prompt/configuration mapping and target capability limitations.
- Microsoft Copilot/Azure: integration outline without weakening the ethical framework.
- Claude Skills: skill organization, allowed resources and execution boundaries.

Guidance must be current, source-aware and explicit about unverified target assumptions.
No target credentials are collected by this specification service. Avoid copying secrets into
generated guides or pretending a generic guide proves successful installation.

### 2.8 Governance and evidence

| Control | Required role | Truthful evidence boundary |
| --- | --- | --- |
| GRO | Ethical constraints and harmful-use handling | Recorded policy or actual assessment, not a blanket safety guarantee |
| Honesty Gate | Assumptions, limitations, unverified claims and evidence | Never manufacture evidence or hide missing inputs |
| ZPOS | Token/context management without silently discarding requirements | No measured-savings claim until measurements exist |
| JCSE | Applicable internal specification-quality assessment | Internal estimates are not independent certification |
| MATHMON | Applicable internal coherence/applicability assessment | Inconclusive or missing evidence cannot become PASS |
| SAVANT | Preserve safeguards while adapting guidance to target environments | Packaging choices do not establish target enforcement |
| KLARITY / SKRIBE | Professional publication layout and editorial requirements | Deterministic layout is not proof an SPC evaluator executed |
| CODE ONE+ / CODE DJ / CODE ORACLE | Existing F8 capabilities where relevant to an approved adapter | Their names alone do not establish executed code verification |

When a check fails, stop the affected path and offer bounded remediation. Re-run only the
affected dependent work against the corrected artifact version. Unknown provider outcomes
require reconciliation before another paid call. Do not grant gate exemptions to maintain speed.

This document applies SPC doctrine as a planning overlay. It does not assert that every
doctrinal check is already enforced by the current engine code.

### 2.9 Payment, promotion and reconciliation

One-time AutoCommand orders must not depend on enabling all recurring subscriptions.
Server-owned amounts are 1,000 / 2,500 / 5,000 cents in USD. Product and price are snapshotted
before checkout. A return URL saying “success” is never payment confirmation.

For paid orders, verify the Stripe signature and the session/order binding, amount, currency
and paid status. Webhook replay and concurrent completion paths must settle once. A customer
can return after a delayed payment and find the same reconciled order.

For the free offer, a normalized verified-email key must be unique across accounts. Reserve
eligibility transactionally, bind it to the order and commit it under the approved fulfillment
policy. Failed or uncertain generation must not automatically release the claim for repeated
paid calls. A reviewed recovery path decides when an unused claim may be restored.

Before selling, approve tax display, refund terms, failed-delivery handling, abuse limits and
the free-claim settlement policy. No provider test charge is authorized by this document.

### 2.10 IMPRIMA authorization — launch-critical decision

**Mandatory reuse: IMPRIMA.PORTAL already has an email-based system.** AutoCommand must
connect to that existing system, not build a separate mail service, duplicate notification
settings or introduce a parallel publication-code flow.

Reuse the existing publication preparation, emailed code, redemption, exact-byte attachment,
subscriber/organization email configuration and notification/control-copy capabilities.
The implementation already routes through `emailTransport`, checks real send results and
supports publication attachments. Extend that established workflow only where the AutoCommand
order/package contract requires it. “Not connected” in this PLAN refers to AutoCommand's
handoff, not absence of IMPRIMA email functionality.

The target experience calls for automatic email fulfillment. The existing Portal contract uses
subscriber-bound, single-use publication authorization. Payment does not automatically establish
authority to publish a particular version to any arbitrary recipient.

Two policy-compatible designs require review:

- Option A: approve a dedicated, single-use order publication grant. It records verified buyer,
  rights declaration, immutable order snapshot, authorized destination and final package hash.
  Only the reviewed fulfillment service may consume it once for that exact package.
- Option B: retain the existing final-version publication code after the package is ready.
  This adds a final confirmation step; marketing must not call delivery completely hands-off.

Option A is the recommended target for the requested experience, **not an approved or installed
exception**. Until it is reviewed and the protected publication prerequisites are satisfied,
fully automatic paid fulfillment remains closed. Do not add an attachment endpoint that evades
existing Portal checks.

A different destination email requires a reviewed recipient-verification/authorization rule and
anti-abuse controls. The promotion still belongs to the verified purchasing email.

### 2.11 Publication and ownership

The publication package identifies owner, creator, publisher, project, exact artifact version,
publication reference and date/time. Use ATANDA.IMPRIMA bottom-right timestamps, page numbering
and professional templates. Logo use is optional; unbranded packages remain fully readable.

Individual orders record the individual's declared ownership and creation role. Corporate
orders record the company as owner and the requesting member as creator. Authority to act for
the company must be declared; the system cannot infer a legal employment/IP assignment.

A copyright notice, attribution stamp and receipt document the transaction and declarations;
they do not automatically establish copyright eligibility, transfer third-party rights, prove
human authorship or register copyright. Terms and applicable legal review remain necessary.

Every authorized package delivery also triggers the subscriber's configured notification/control
copy workflow. Managed or subscriber-configured email transport must report actual success.
Treat failed or dry-run mail as not delivered. Protect copy-recipient authorization and privacy.

Buyer packages are private by default. Do not automatically list them on SPHINX. Any future
marketplace switch requires separate owner consent, rights confirmation and qualification.

### 2.12 Architecture and operational state

Keep the storefront, order service, orchestration, document rendering and delivery responsibilities
separate while reusing the existing ACC infrastructure.

| Component | Responsibility |
| --- | --- |
| Customer UI | Catalog, atomic intake, order progress and understandable recovery actions |
| Verified identity | Server-verified primary email; never inferred from contact input or staff cookie |
| Order service | Immutable accepted request, product, amount, promotion and payment references |
| Worker/orchestrator | Claims work with fencing; invokes only the declared applicable adapters |
| Stage ledger | Versioned inputs, outputs, state, evidence and model-call references |
| Package renderer | DOCX and other agreed editable deliverables, manifest and branding |
| Existing IMPRIMA.PORTAL fulfillment | Reuse email, authorization, exact-version package, control copy and delivery status |
| Operations view | Failed/uncertain jobs, cost, provider and delivery reconciliation |

Target order states: DRAFT, AWAITING_AUTHORIZATION, AWAITING_PAYMENT or PROMOTION_RESERVED,
QUEUED, RUNNING, NEEDS_INPUT, NEEDS_REMEDIATION, RECONCILIATION_REQUIRED, PACKAGE_READY,
AWAITING_PUBLICATION_AUTHORIZATION, DELIVERY_PENDING, SENT, DELIVERY_FAILED and CANCELLED.
These are proposed states, not currently installed order endpoints.

Long work must survive browser closure. Use durable jobs, bounded leases with ownership tokens,
idempotent stage keys and a reviewed wake-up mechanism compatible with autoscaling. An
in-process timer alone does not guarantee asleep deployments will resume work.

Store bytes in private App Storage. Store metadata, hashes and state in PostgreSQL. Do not
expose source documents or company logos as public objects merely to simplify rendering.
Define access checks, retention, abandoned-upload recovery and audit redaction explicitly.

### 2.13 Non-functional acceptance targets

- Zero duplicate charges or duplicate free claims in the defined concurrency tests.
- No cross-customer draft, file, order, manifest or package access.
- Reload and reconnect preserve job identity without redispatching uncertain provider work.
- Every promised package item is present, named correctly and opens in the intended editor.
- WCAG-oriented keyboard access, clear focus, readable contrast and reduced-motion behavior.
- Mobile/light/dark states remain usable for intake, progress and errors.
- No guaranteed turnaround SLA until pilot latency and delivery evidence are collected.
- Per-order, per-customer and company-wide spend controls must bound generation and remediation.
- Logs and monitoring exclude raw secrets and unnecessary personal/source content.

### 2.14 Risk register

| Risk | Consequence | Required mitigation |
| --- | --- | --- |
| Paid checkout opens before fulfillment | Customer charged without a promised package | Keep checkout closed until end-to-end acceptance |
| Publication authorization is bypassed | Unauthorized disclosure or weakened governance | Approve exact-version grant or retain final OTP |
| Duplicate free claims | Unbounded subsidized generation | Durable unique verified-email reservation |
| Unknown provider result is retried | Duplicate cost and inconsistent outputs | Reconcile first; no blind redispatch |
| Full floor gates are relabeled | False certification or invalid stage state | Separate specification-only profile and evidence |
| Incorrect corporate attribution | Misstated rights or author identity | Distinct owner/creator and authority declaration |
| Unvalidated source or logo | Extraction/render failure or unsafe content | Validate formats, limits and private references |
| Email provider failure | Package-ready falsely shown as sent | Persist recipient/control-copy outcomes separately |
| External navigation assumed complete | Customer cannot reach the service | Verify atanda.ai change in its own source |
| Retained abandoned files | Privacy and storage exposure | Reviewed retention and provenance-bound recovery |

### 2.15 Assessment and token economics

No independent JCSE score, FORGE tier, compression-fidelity result or governance certification
has been produced for this PDD. Reviewer fields remain NOT ASSESSED until evidence is recorded.
Do not copy the ATLAS skill's generic 50/50 or token-reduction benchmarks into product claims.

For token economics, collect provider input/output/cached usage, stage cost, retries, package type,
input size and outcome. Compare equivalent inputs and accepted outputs before estimating causal
ZPOS savings. Distinguish document-length reduction from provider-billed tokens and actual dollars.
No paid generation or token-measurement experiment was run to create this document.

---

## PART 3 — ATOMIC PROMPT WORKSHEET

### 3.1 Execution discipline

The following 45 prompts are implementation instructions, not 45 claimed completed operations.
Each prompt has one logical operation, a declared input, a verifiable output and explicit
dependencies. Supporting tests verify that operation; they do not authorize another feature.

Common System: work only within the approved AutoCommand scope and existing security boundaries.
Common Constraint: never infer a missing identity, approval, evidence result or production gate PASS.
Common Format: return the named artifact with source references and unresolved facts marked.
Common Example: an unavailable stage is NOT_REQUIRED with a reason, never a fabricated PASS.

These common Context Craft pillars apply to every card. The card supplies its Role,
Instruction, Data/Input, Output and acceptance condition. Dependencies are work-item identifiers,
not customer F-stage labels.

Priority legend: RED/P0 launch-critical; YELLOW/P1 core; GREEN/P2 operational refinement;
BLUE/P3 later enhancement. No color overrides a failed prerequisite.

### Phase 1 — Foundation (8 prompts)

#### AC-001 | RED / P0 | Scope architect
Instruction: Freeze the specification-only product boundary.
Input: User's AutoCommand brief and this PLAN.
Output: One approved scope record.
Acceptance: F9–F12 and deployed-agent promises are explicitly excluded.
Dependencies: None.

#### AC-002 | RED / P0 | Product analyst
Instruction: Define the package deliverable matrix.
Input: Approved scope record.
Output: One versioned product-to-artifact matrix.
Acceptance: Each product includes its specific artifacts, editable F0 DOCX and general guidance.
Dependencies: AC-001.

#### AC-003 | RED / P0 | Identity architect
Instruction: Define the promotion identity key.
Input: Verified-email identity contract.
Output: One normalization and uniqueness specification.
Acceptance: Contact/destination email cannot establish first-free eligibility.
Dependencies: AC-001.

#### AC-004 | RED / P0 | Governance architect
Instruction: Define the automatic-publication authorization contract.
Input: Existing IMPRIMA rules and intended email journey.
Output: One reviewed grant-or-final-code decision record.
Acceptance: No payment event alone authorizes arbitrary artifact disclosure.
Dependencies: AC-001.

#### AC-005 | RED / P0 | Integration architect
Instruction: Map the applicable engine adapters.
Input: Deliverable matrix and current engine preconditions.
Output: One product-specific routing contract.
Acceptance: Every invoked stage has real preconditions; skipped stages have reasons.
Dependencies: AC-002.

#### AC-006 | YELLOW / P1 | Privacy analyst
Instruction: Define the intake data dictionary.
Input: User fields and current intake schema.
Output: One versioned field/validation dictionary.
Acceptance: Owner, creator, contact and destination retain distinct meanings.
Dependencies: AC-002, AC-003.

#### AC-007 | RED / P0 | Security reviewer
Instruction: Record launch-blocking publication dependencies.
Input: Current protected-workflow status and authorization decision.
Output: One prerequisite register.
Acceptance: Unknown or failed safeguards remain closed without owner-role fallback.
Dependencies: AC-004.

#### AC-008 | YELLOW / P1 | Program lead
Instruction: Baseline the project acceptance matrix.
Input: Scope, package matrix, routing and prerequisite register.
Output: One requirements-to-evidence matrix.
Acceptance: Every MUST requirement has a named acceptance test and accountable role.
Dependencies: AC-002, AC-005, AC-006, AC-007.

### Phase 2 — Customer and commercial core (12 prompts)

#### AC-009 | YELLOW / P1 | Storefront engineer
Instruction: Expose the approved package catalog.
Input: Versioned product matrix and fee schedule.
Output: One public catalog response.
Acceptance: Active prices are $10/$25/$50; the three future products cannot be ordered.
Dependencies: AC-002.

#### AC-010 | RED / P0 | Authentication engineer
Instruction: Bind customer access to a verified individual identity.
Input: Server-verified primary-email identity contract.
Output: One authenticated customer context.
Acceptance: A shared staff cookie or request-body email cannot substitute for verification.
Dependencies: AC-003.

#### AC-011 | YELLOW / P1 | Intake engineer
Instruction: Validate the atomic intake payload.
Input: Field dictionary and one customer submission.
Output: One normalized valid payload or explicit validation error.
Acceptance: All required names, product choices, source-mode fields and rights are checked.
Dependencies: AC-006.

#### AC-012 | RED / P0 | Document intake engineer
Instruction: Persist an authorized source upload.
Input: Verified customer, file bytes and declared purpose.
Output: One owner-bound private upload reference.
Acceptance: Unsupported, oversized or foreign files never become eligible inputs.
Dependencies: AC-010, AC-011.

#### AC-013 | RED / P0 | Persistence engineer
Instruction: Save an idempotent private intake draft.
Input: Valid payload, verified identity and request key.
Output: One durable DRAFT record.
Acceptance: Replaying the same payload produces the same ID; changed payload conflicts.
Dependencies: AC-010, AC-011, AC-012.

#### AC-014 | RED / P0 | Privacy engineer
Instruction: Isolate the customer workspace view.
Input: Current verified identity and saved drafts.
Output: One owner-scoped workspace response.
Acceptance: Reload restores own drafts; logout or account switching removes private content.
Dependencies: AC-013.

#### AC-015 | RED / P0 | Commerce engineer
Instruction: Calculate the accepted order quote.
Input: Immutable intake snapshot and current server-owned catalog version.
Output: One expiring quote record.
Acceptance: A client cannot change product amount, currency or promotion identity.
Dependencies: AC-009, AC-013.

#### AC-016 | RED / P0 | Promotion engineer
Instruction: Reserve the first-free entitlement.
Input: Verified-email key and accepted order reference.
Output: One durable unique promotion reservation.
Acceptance: Concurrent accounts sharing that verified email cannot reserve twice.
Dependencies: AC-003, AC-015.

#### AC-017 | RED / P0 | Payments engineer
Instruction: Create a one-time paid checkout session.
Input: Accepted non-free quote and order reference.
Output: One provider checkout reference.
Acceptance: Recurring subscription activation is not required for this order.
Dependencies: AC-015.

#### AC-018 | RED / P0 | Payments verifier
Instruction: Reconcile a provider payment event.
Input: Signed event and matching order/session evidence.
Output: One idempotent payment-state transition.
Acceptance: Unpaid, mismatched or replayed events cannot authorize duplicate fulfillment.
Dependencies: AC-017.

#### AC-019 | RED / P0 | Order engineer
Instruction: Authorize an eligible production job.
Input: Accepted order with confirmed payment or valid free reservation.
Output: One immutable QUEUED job.
Acceptance: An unauthenticated or unpaid order never enters paid generation.
Dependencies: AC-004, AC-007, AC-016, AC-018.

#### AC-020 | YELLOW / P1 | Customer-experience engineer
Instruction: Render the order-entry experience.
Input: Catalog, identity, draft and authorized-order APIs.
Output: One accessible customer ordering page.
Acceptance: UI state mirrors real responses without simulated purchase or eligibility.
Dependencies: AC-009, AC-014, AC-015, AC-019.

### Phase 3 — Automatic specification production (10 prompts)

#### AC-021 | RED / P0 | Orchestration engineer
Instruction: Claim a queued job with fenced ownership.
Input: Durable job state and worker identity.
Output: One time-bounded ownership claim.
Acceptance: A stale worker cannot mutate a newer worker's claim.
Dependencies: AC-019.

#### AC-022 | RED / P0 | Requirements adapter engineer
Instruction: Produce the normalized F1 requirements artifact.
Input: Claimed job and immutable source snapshot.
Output: One persisted F1 result with source binding.
Acceptance: Missing requirements are identified rather than invented.
Dependencies: AC-005, AC-021.

#### AC-023 | YELLOW / P1 | Business-document adapter engineer
Instruction: Produce the F0 business draft.
Input: F1 requirements and selected F0 document type.
Output: One structured editable-business-draft content artifact.
Acceptance: Assumptions and human-completion fields are explicitly marked.
Dependencies: AC-022.

#### AC-024 | RED / P0 | Atomic-specification engineer
Instruction: Produce the F2 atomic specification.
Input: Bound requirements and applicable supporting F0 context.
Output: One persisted atomic specification.
Acceptance: The result preserves source constraints and unresolved facts.
Dependencies: AC-022, AC-023.

#### AC-025 | YELLOW / P1 | Basic-agent adapter engineer
Instruction: Produce the Basic Agent artifact set.
Input: Basic-product job, atomic specification and declared adapter contract.
Output: One linked MA/Micro PDD artifact set.
Acceptance: The companion points to the exact MA source and neither implies hosting.
Dependencies: AC-005, AC-024.

#### AC-026 | YELLOW / P1 | SPC adapter engineer
Instruction: Produce the SPC specification artifact.
Input: Advanced/web job and atomic specification.
Output: One source-bound governed SPC.
Acceptance: The artifact includes provenance and explicit constraints.
Dependencies: AC-005, AC-024.

#### AC-027 | RED / P0 | Agent Creator adapter engineer
Instruction: Produce the SPC Cheat Sheet.
Input: Exact saved SPC and declared ownership/target metadata.
Output: One durable nine-field Cheat Sheet.
Acceptance: It exists before subsequent Agent Creator preparation and invents no lineage.
Dependencies: AC-026.

#### AC-028 | YELLOW / P1 | Web-specification adapter engineer
Instruction: Produce the web-application PDD artifact set.
Input: Web-product job, eligible SPC and applicable F6/F7 preconditions.
Output: One linked PDD/MVP PDD artifact set.
Acceptance: Scope and acceptance criteria are traceable to the exact F5 SPC.
Dependencies: AC-005, AC-026.

#### AC-029 | RED / P0 | Governance evaluator
Instruction: Evaluate the generated artifact set.
Input: Applicable artifact set, original constraints and recorded evidence.
Output: One honest internal evaluation record.
Acceptance: Missing evidence remains inconclusive; failed criteria cannot be relabeled PASS.
Dependencies: AC-025 or AC-027, AC-028 when the web product requires it.

#### AC-030 | YELLOW / P1 | F8 guidance adapter engineer
Instruction: Produce the General Implementation Cheat Sheet.
Input: Evaluated artifact set and selected production-guidance targets.
Output: One project-specific implementation guide.
Acceptance: Guidance excludes unperformed deployment, code verification and F9–F12 claims.
Dependencies: AC-005, AC-029.

### Phase 4 — Publication and operations (8 prompts)

#### AC-031 | RED / P0 | Artifact integrity engineer
Instruction: Validate the package deliverable inventory.
Input: Purchased product and saved artifact set.
Output: One complete inventory or explicit missing-item failure.
Acceptance: Every promised item is present with a project-first title.
Dependencies: AC-002, AC-030.

#### AC-032 | YELLOW / P1 | Publication rendering engineer
Instruction: Render the attributed specification package.
Input: Validated inventory, declared identities, branding and publication template.
Output: One immutable package with exact-version manifest.
Acceptance: The F0 draft opens as editable DOCX; required stamps and attribution are visible.
Dependencies: AC-031.

#### AC-033 | RED / P0 | IMPRIMA authorization engineer
Instruction: Consume the approved publication authorization.
Input: Exact package hash and reviewed order grant or final-version code.
Output: One version-bound publication authorization outcome.
Acceptance: Wrong owner, recipient, version or reused authorization is denied.
Dependencies: AC-004, AC-007, AC-032.

#### AC-034 | RED / P0 | Delivery engineer
Instruction: Submit the authorized package through existing IMPRIMA.PORTAL email delivery.
Input: Authorized package, destination, order/payment acknowledgment and existing email context.
Output: One persisted recipient-delivery result.
Acceptance: Existing Portal email is reused; failed or dry-run mail never becomes SENT.
Dependencies: AC-018 for paid orders, AC-033.

#### AC-035 | RED / P0 | Notification engineer
Instruction: Submit the required copy through the existing IMPRIMA control-copy workflow.
Input: Authorized exact package and existing subscriber notification context.
Output: One independent control-copy outcome.
Acceptance: Copy failure remains visible without falsely repeating customer delivery.
Dependencies: AC-033, AC-034.

#### AC-036 | YELLOW / P1 | Progress engineer
Instruction: Render the persisted production timeline.
Input: Authorized customer's order/stage/delivery ledger.
Output: One reconnectable graphical status view.
Acceptance: Inapplicable stages and package-ready versus email-sent states remain distinct.
Dependencies: AC-021, AC-029, AC-034.

#### AC-037 | RED / P0 | Recovery engineer
Instruction: Reconcile an interrupted production attempt.
Input: Durable claim, stage ledger and provider/delivery references.
Output: One safe resume, hold or operator-review decision.
Acceptance: Uncertain paid work is not blindly redispatched.
Dependencies: AC-021, AC-029, AC-034.

#### AC-038 | GREEN / P2 | Operations engineer
Instruction: Expose the exception work queue.
Input: Failed, held or uncertain orders and redacted evidence.
Output: One authorized operator view.
Acceptance: Each actionable exception has ownership, reason and bounded recovery options.
Dependencies: AC-035, AC-037.

### Phase 5 — Launch validation and living baseline (7 prompts)

#### AC-039 | RED / P0 | Security acceptance lead
Instruction: Verify customer isolation and authorization.
Input: Test identities, private files, orders and publication contracts.
Output: One security acceptance evidence packet.
Acceptance: Cross-owner access and unauthorized publication fail under actual request contexts.
Dependencies: AC-014, AC-033, AC-038.

#### AC-040 | RED / P0 | Commerce acceptance lead
Instruction: Verify the commercial settlement matrix.
Input: Free and paid order scenarios, concurrency and signed-event fixtures.
Output: One payment/promotion acceptance report.
Acceptance: Duplicate charges, duplicate claims and unpaid fulfillment are absent in tested cases.
Dependencies: AC-016, AC-018, AC-034, AC-037.

#### AC-041 | RED / P0 | Package acceptance lead
Instruction: Verify each promised product package.
Input: One accepted representative package for each product.
Output: One three-product artifact acceptance report.
Acceptance: Contents, editability, names, ownership, guide coverage and actual delivery match the order.
Dependencies: AC-032, AC-034, AC-035.

#### AC-042 | YELLOW / P1 | Accessibility acceptance lead
Instruction: Verify the customer-facing journey's usability.
Input: Current intake, checkout, progress and recovery screens.
Output: One responsive/accessibility acceptance report.
Acceptance: Keyboard, phone-width, light/dark and reduced-motion scenarios remain usable.
Dependencies: AC-020, AC-036.

#### AC-043 | RED / P0 | Release manager
Instruction: Assemble the publish-readiness decision.
Input: Security, commerce, package, usability and recovery evidence.
Output: One human-reviewable GO/HOLD record.
Acceptance: Every mandatory blocker is closed or the outcome remains HOLD.
Dependencies: AC-039, AC-040, AC-041, AC-042.

#### AC-044 | YELLOW / P1 | Website integration owner
Instruction: Add the approved atanda.ai navigation handoff.
Input: Approved destination and access to the separate website source.
Output: One verified public AutoCommand link change.
Acceptance: Desktop and mobile links reach the intended storefront without an auth/404 redirect.
Dependencies: AC-043.

#### AC-045 | GREEN / P2 | Living-PDD custodian
Instruction: Record the accepted release baseline.
Input: Human release decision and published verification evidence.
Output: One updated living PDD baseline.
Acceptance: Planned, development-verified and production-accepted capabilities remain distinguishable.
Dependencies: AC-043, AC-044.

### 3.2 Dependency and execution notes

Alternative dependencies are product branches, not permission to skip a required deliverable.
AC-019 requires the payment branch for paid orders or the promotion branch for free orders;
it does not require a free order to complete a paid checkout. AC-029 requires the applicable
Basic or Advanced/Web path; the web path also requires its PDD/MVP PDD result.
AC-034 uses a real paid acknowledgment only when payment exists.

Current intake implementation provides evidence relevant to AC-009 through AC-014.
These prompts are not automatically marked fully accepted: review their requirements against
the final contracts, corporate/file edge cases and eventual production request contexts.
The other prompts remain planned unless explicitly supported by later evidence.

---

## PART 4 — IMPLEMENTATION AND GO-LIVE PLAN

### 4.1 Delivery strategy

Keep one accountable AutoCommand workstream. Pause unrelated work, but include prerequisite
security, identity, publication or billing work that directly enables this product.

Do not re-platform the application to implement the storefront. Reuse the existing React/Vite
frontend, Express API, PostgreSQL, private App Storage, model usage ledger, Stripe connection and
IMPRIMA/Agent Creator capabilities through reviewed contracts.

### 4.2 VIBE DJ — tool-selection rationale

| Tool or capability | Proposed role | Reason and limitation |
| --- | --- | --- |
| Replit workspace | Primary implementation and development preview | Existing ACC code and managed workflows are here |
| CODE ONE+ / CODE DJ / CODE ORACLE | Existing F8 capability analysis and reviewed adapter work | Do not imply this document executed those engines |
| Existing model routing | Accounted generation behind the product adapters | Explicit context, budget reservation and usage records required |
| TypeScript/Vitest toolchain | Application engineering and regression checks | Does not change the customer F8 output-language policy |
| Browser testing | Critical customer acceptance | Use supported test identities, not shared staff access |
| PDFKit / DOCX tooling | Professional portable publication | Maintain common ATANDA templates and exact artifact bytes |
| Customer IDE/vibe/agent tools | Guidance destinations | No service-side deployment or credentials implied |

Selection criteria: stack alignment, governance preservation, integration complexity, speed,
maintainability, cost and verifiable outcomes. No arbitrary playlist percentages or tool-licence
commitments are assigned. No need to introduce another hosting platform for the initial product.

### 4.3 ORCHESTRA coordination

The product owner approves scope and commercial terms. Engineering owns contracts and adapters.
Security/publication reviewers own authorization decisions. QA attaches evidence to specific
versions. The release manager may publish only after the human GO record.

Use one versioned API and shared product definitions. Separate visual work from payment,
authorization and orchestration edits to avoid conflicting changes. Merge dependent work in
dependency order. Record interface decisions before parallel work begins.

### 4.4 Camelot responsibility map

The following are proposed responsibilities, not claims that twelve autonomous agents ran.

| Seat | Responsibility | Advisory methodology |
| --- | --- | --- |
| 0 | ATANDA product sponsor and scope approval | SPHINX/product oversight |
| 1 | Architecture and living PDD | ATLAS |
| 2 | Customer experience and accessibility | Customer-design lead |
| 3 | Business document and proposition | STRATEGOS |
| 4 | Ethical boundaries and honest evidence | GRO / Honesty Gate review |
| 5 | Identity, privacy and isolation | Security lead |
| 6 | Orchestration and recovery | Platform engineering |
| 7 | Technical integration and contracts | ADA |
| 8 | Agent specification preparation | Agent Creator / applicable SPC expertise |
| 9 | Token/cost measurement | ZPOS analyst |
| 10 | Commerce and reconciliation | Payments lead |
| 11 | Editorial quality and document design | SKRIBE / KLARITY |
| 12 | QA evidence and release acceptance | Human release authority |

Assign named accountable people before production. Missing source cards or unexecuted SPCs
must be recorded as unavailable/not run, not impersonated as certified assessments.

### 4.5 Dependency-ordered sprint sequence

| Sprint | Outcome | Completion evidence |
| --- | --- | --- |
| 1 | Scope, product matrix and authorization decisions | AC-001–AC-008 approved |
| 2 | Secure storefront and private intake | AC-009–AC-014 accepted; current development baseline exists |
| 3 | One-time orders and first-free reservation | AC-015–AC-020 settlement tests; checkout still gated |
| 4 | Durable production and Basic Agent path | Fenced worker, F1/F0/F2 and linked MA/Micro PDD evidence |
| 5 | Advanced and Web production paths | SPC Cheat Sheet-first flow and eligible PDD/MVP PDD outputs |
| 6 | Package rendering and IMPRIMA authorization | Editable files, manifest, stamps and version-bound authorization |
| 7 | Existing IMPRIMA email handoff, recovery and operations | Recipient/control-copy results, reconnect and uncertain-call handling |
| 8 | Final acceptance and publication | AC-039–AC-045 evidence and human GO |

These are outcome-based sprint boundaries, not promised calendar durations. The present
development intake was delivered before this formal plan; reconcile it against Sprints 1–2
rather than falsely declaring all foundational decisions approved.

### 4.6 Milestones and subscriber-visible unlocks

- M1 — Intake: customers compare products and save verified private briefs. Development verified.
- M2 — Authorized orders: customers receive a real quote and free/paid order reference.
  Do not expose payment collection until fulfillment acceptance permits it.
- M3 — Automatic specification production: customers see real applicable-stage progress and
  recover an interrupted session without losing or duplicating work.
- M4 — Package publication: customers receive the exact attributed, professionally rendered
  specification package through approved IMPRIMA authorization.
- M5 — Commercial go-live: free and paid customers can complete the full accepted journey;
  atanda.ai provides the verified entry link.

The unlock notice for each milestone must describe actual customer capability and remaining
limits, not just announce an engine label as “active.”

### 4.7 A / B / C scope classification

| Category | Scope |
| --- | --- |
| A — target initial offering | Three specification packages, first-free policy, automatic applicable stages, authorized publication and receipts |
| A — currently development-usable subset | Public catalog, individually verified private drafts and IMPRIMA intake uploads |
| B — later extension | Measured turnaround targets, richer corporate templates and additional output adapters after the initial product is stable |
| C — excluded/future | Firmware, RobotWare, ChipWare, F9 offering and any F10–F12 deployment through AutoCommand |

Category A target scope is not a claim that all A functionality is presently active or production
accepted. Do not lower the published product promise to hide missing paid fulfillment.

### 4.8 Launch decision and publication checklist

- Product contents, pricing, promotion and refund/tax terms approved by ATANDA.
- Individual verified identity and cross-customer isolation accepted.
- All three package paths produce their complete promised deliverables.
- Automatic stage adapters preserve real preconditions and evaluation evidence.
- Durable jobs survive disconnect/restart without duplicate paid calls.
- Concurrent free claims, webhook replay and delayed payment are reconciled safely.
- Publication authorization decision approved and implemented without weakened checks.
- Required protected-workflow prerequisites accepted under the correct request context.
- Editable F0 DOCX, manifest, author/owner fields and ATANDA.IMPRIMA stamps verified.
- Customer and configured control-copy delivery outcomes recorded separately.
- Accessibility, phone/light/dark, errors and recovery accepted.
- Cost bounds and operational exception ownership enabled.
- Separate atanda.ai entry link verified in its own source project.
- Human GO decision recorded before publishing the paid service.

Current decision: **HOLD FOR PAID GO-LIVE**. Development intake may be demonstrated with its
explicit intake-only notice. This PDF does not change that decision or publish the application.

---

## ADDENDUM A — CURRENT AND TARGET SITEMAP

| Surface | Current development behavior | Target behavior |
| --- | --- | --- |
| ACC landing `/` | AutoCommand promotional entry and navigation link | Clear package storefront promotion alongside existing offerings |
| `/autocommand` | Catalog, launch limits, verified private intake and saved drafts | Intake, quote and entry to accepted orders |
| `/autocommand/login` | Individual customer sign-in | Same verified customer identity |
| `/autocommand/register` | Individual identity registration | Verified email before promotion/payment authorization |
| Order/progress surface | Not implemented | Durable customer-owned order timeline; route to be agreed |
| Package/publication surface | Not implemented for AutoCommand | Version-bound authorization and truthful delivery status |
| Operator exception surface | Not implemented for AutoCommand | Authorized recovery/reconciliation queue |
| atanda.ai AutoCommand tab | Not changed in this project | Link to the approved ACC storefront URL |
| Existing F-stage pages | Retained | Standard production floor remains independently available |
| SPHINX marketplace | No automatic AutoCommand listing | Separate consent and qualification if later offered |

Paths for future order/progress and operator surfaces are design decisions, not claims that
routes already exist.

## ADDENDUM B — EVIDENCE REGISTER

Baseline evidence reviewed for this PLAN:

- `docs/autocommand-delivery-contract.md` — current product contract and recorded verification.
- `artifacts/api-server/src/lib/autocommand/catalog.ts` — prices, future choices and explicit
  disabled checkout/production/delivery readiness.
- `artifacts/api-server/src/lib/autocommand/intake.ts` — validation, private draft persistence,
  duplicate-request handling and owner-bound upload references.
- `artifacts/api-server/src/routes/autocommand.ts` — current public catalog and verified private
  intake/upload route surface.
- `lib/db/src/schema/autocommand.ts` — intake drafts and upload metadata, not a completed order ledger.
- `artifacts/command-centre/src/pages/autocommand.tsx` and `autocommand-auth.tsx` — customer UI.
- `artifacts/api-server/test/autocommand.test.ts` — twelve targeted backend tests recorded passing.
- `artifacts/api-server/src/lib/imprima-portal.ts` and `email-delivery.ts` — existing email-based
  publication codes, scoped transport, exact-byte attachments and control-copy integration to reuse.

Recorded development checks: OpenAPI code generation; shared/API/frontend type checks; frontend
production build; browser catalog and disabled checkout; verified test customer text upload,
draft save/reload/reopen with exact filename; phone-width dark readability; focused logout privacy.

Those checks are not payment, full automatic-generation, completed package or real email-delivery
acceptance. Corporate logo rendering, every document format and production acceptance require
their own evidence. No new live-platform inspection or provider invocation was performed for this PDF.

## ADDENDUM C — DECISIONS STILL REQUIRED

| Decision | Recommended direction | Required owner |
| --- | --- | --- |
| Automatic IMPRIMA authorization | Reviewed single-use, order/version/recipient-bound grant | Product sponsor + security/publication authority |
| Different recipient email | Verified or explicitly authorized destination with anti-abuse checks | Privacy/security lead |
| Free-claim settlement/recovery | Durable reservation; reviewed release after reconciled failure | Commerce owner |
| Failure/refund and tax policy | Clear pre-checkout terms, genuine acknowledgments | ATANDA commercial/legal owner |
| Adapter eligibility | Separate specification-only contracts, no standard-floor gate spoofing | Architecture/engine owners |
| Operational wake-up | Durable autoscale-compatible job resumption | Platform operations |
| Retention and deletion | Defined customer/source retention and provenance-bound cleanup | Privacy/operations |
| Human release authority | Named approver for the final GO/HOLD record | ATANDA sponsor |
| External website handoff | Update atanda.ai in its own source project | Website owner |

## ADDENDUM D — LIVING-PDD UPDATE RULE

Update this PDD whenever a milestone is accepted, an interface or commercial term changes,
a new safeguard is required, or production evidence changes the known status.

Each revision records the changed requirement, supporting evidence, date, responsible role,
customer-visible effect and unresolved dependencies. Maintain separate columns for planned,
development-verified and production-accepted capabilities.

Retain prior baselines and exact package provenance. Do not replace an earlier HOLD with GO
because code exists or because this document was rendered professionally. A human release
decision requires the actual acceptance evidence.
