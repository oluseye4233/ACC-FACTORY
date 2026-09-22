**JUNGLENOMICS FORGE INSTITUTE**

*ATLAS 360 PLAN — Integration Product Design Document (Rework)*

**ACC-FACTORY**

**F0.1 — SPC PLAYER (standalone) · ATLAS 360 PLAN + SCAN as F6/F7
Document Views (in-process)**

**PART 0 — Title & Contents / Authorship & Provenance Block**

**REWORK NOTICE: this revision supersedes v0.1's treatment of ATLAS 360
SUITE as a standalone F10 service. Per direct operator instruction,
ATLAS 360 PLAN and ATLAS 360 SCAN are now integrated into the F-process
itself — as additional document views generated from a session's
existing F6/F7 PDD artifact, not as a separately routed, separately
billed stage. The F10 stage number is retired by this revision. F0.1
(SPC PLAYER) is unchanged from v0.1 and remains a standalone paid
service — the operator's rework instruction was scoped to ATLAS
PLAN/SCAN only.**

| **Field**                   | **Value**                                                                                                                                                                                                                                      |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Document Title              | ACC-FACTORY — F0.1 (SPC PLAYER) & ATLAS 360 PDD Views Integration PDD                                                                                                                                                                          |
| Production ID               | JNGL-PDD-ACCF-F01F10-2026-001 (v0.2 supersedes v0.1's F10 standalone-service design)                                                                                                                                                           |
| Version                     | v0.2 — Design Intent, Pre-Build                                                                                                                                                                                                                |
| Date / Time Stamp           | 2026-09-13T00:00:00Z                                                                                                                                                                                                                           |
| Instruction Source          | Direct operator instruction: rework the PDD so ATLAS PLAN and SCAN integrate into the F process as additional document views for the PDD production process, instead of standalone                                                             |
| Target Repository           | https://github.com/oluseye4233/ACC-FACTORY (main)                                                                                                                                                                                              |
| Registry Sources Integrated | SPC PLAYER OMNIBUS HARNESS (unchanged from v0.1) · ATLAS 360 PLAN v4.0.1 (12-Part Standard, Path A) · ATLAS 360 SCAN v2.1.1 (eight-stage lifecycle, Path B) — both now consumed as rendering targets for F6/F7 output, not as a routed product |
| Host SPC / Framework        | ATLAS 360 PLAN (this document's own host, per operator's naming)                                                                                                                                                                               |
| Certification Status        | PRE-BUILD — SOLVA GAUNTLET NOT RUN. ATLAS 360 PLAN's own JCSE/Certification status remains WITHHELD in the registry; this now attaches to the PLAN View specifically (Part 2.2) rather than to a standalone product                            |
| Honesty Gate Tier           | Tier 0                                                                                                                                                                                                                                         |

**Contents**

- 0\. Title & Contents / Authorship & Provenance Block

- 1\. Statement of Requirements

- 2\. Business Case — Monetization Without a Standalone Stage

- 3\. SPC Roster — SPC PLAYER and ATLAS 360 (Plan / Scan)

- 4\. Platform Specifics — PDD Views as an F6/F7 Side-Step

- 5\. Atomic Prompt / Feature Traceability Worksheet

- 6\. Implementation, CI/CD & Deployment Plan

- 7\. Summary of Sources

- 8\. Definition of Terms

- SKRIBE SBIS — Styling & Layout (binding)

- Appendices & Change Log

**PART 1 — Statement of Requirements**

*Owning SPC: KONSTRUCT + CARTER v3.0*

**1.1 The rework instruction, read literally**

Integrate ATLAS 360 PLAN and ATLAS 360 SCAN into the F-process as
additional document views for the PDD production process — meaning they
render alternate formats of a session's own PDD artifact — rather than
as a standalone, separately-routed service (the v0.1 F10 design).

**1.2 What changes from v0.1**

| **Aspect**                    | **v0.1 (F10 standalone)**                                                            | **v0.2 (this revision)**                                                                                        |
|-------------------------------|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| Trigger                       | New top-level route (routes/atlas-360-suite.ts), reachable without a HARNESS session | A view request against an EXISTING session's F6 or F7 artifact — no session-independent entry point             |
| Routing between Plan and Scan | New customer-facing intake question ("does this already exist?")                     | Reuses ACC-FACTORY's existing harness_sessions.origin field: manual/cartridge → PLAN view; ingested → SCAN view |
| Numbering                     | F10 — new numbered stage after F9.5                                                  | No new F-number — a side-step off F6/F7, the same architectural pattern ATLAS J and PFP already use off F6/F8   |
| Billing                       | Proposed new Stripe SKU family (STRIPE_PRICE_F10_ATLASSUITE\_\*)                     | Reuses the existing Practitioner-tier side-step gate already applied to ATLAS J and PFP — no new SKU            |

**1.3 F0.1 (SPC PLAYER) — unchanged**

The operator's rework instruction named ATLAS PLAN and SCAN
specifically. F0.1 (SPC PLAYER), including its standalone routing and
dedicated billing, carries forward from v0.1 without modification and is
not repeated in full detail here — see v0.1 Parts 3.1 and 4.1 for that
design, which still stands.

**PART 2 — Business Case: Monetization Without a Standalone Stage**

*Owning SPC: EVE ULTRA SI + SOLVA ULTRA SI*

**2.0 Why views, not a product**

A PDD view is a re-rendering of content a session has already produced
at F6 (draft) or F7 (certified) — it costs an additional LLM pass to
reformat and reframe existing session output, not a new pipeline run.
That is structurally closer to ATLAS J (JSON crystallisation of an
existing ATLAS PDD) than to a new billable product line, so it is
monetized the same way ATLAS J and PFP already are: a Practitioner-tier
gate on the feature, not a separate purchase.

**2.1 Revised monetization**

This removes v0.1's proposed STRIPE_PRICE_F10_ATLASSUITE\_\* SKU
entirely. PLAN and SCAN views are gated the same way ATLAS J and PFP
are: available to Practitioner tier and above (or any tier under
ACC-FACTORY's current internal-staff-tool mode, per the Living PDD's
Part 2A staleness flag), with no new billing surface to build.

**2.2 Certification honesty — now view-level, not product-level**

**ATLAS 360 PLAN's own registry record lists its JCSE/Certification
Status as WITHHELD, by its own Section 8 rule. That disclosure now
attaches to the PLAN View itself: any PDD rendered in PLAN's 12-Part
format should carry an in-view label stating that the format's own host
framework is self-declared uncertified. This is a smaller-surface
disclosure than v0.1's customer-facing product terms, but it does not go
away just because PLAN is no longer sold as a separate line item.**

**2.3 SOLVA Gate (Mandatory)**

**SOLVA VERDICT: NOT RUN. This remains DESIGN-INTENT / PRE-BUILD.
Folding PLAN/SCAN into F6/F7 as views is a smaller, lower-risk
integration than v0.1's standalone service, but it is still new
integration work and has not been adjudicated.**

**PART 3 — SPC Roster: SPC PLAYER and ATLAS 360 (Plan / Scan)**

*Owning SPC: ATLAS ULTRA SI + CARTER v3.0*

**3.1 F0.1 — SPC PLAYER Roster (unchanged from v0.1)**

| **Card**                                  | **Role**                                              | **Status**                                                 |
|-------------------------------------------|-------------------------------------------------------|------------------------------------------------------------|
| REVERB (SPC-REVERB-001)                   | Cross-council orchestrator for written-content briefs | v3.0, JCSE 41/50, Editorial-class, not yet FORGE Certified |
| GRIOT SI, LUCI ULTRA SI                   | Content-creation-base cards                           | Independently selectable                                   |
| SHAYMXT / SHAY, SKRIBE, TARANTULA, SCOOPS | Media Council / supporting content cards              | Per content_creation_base registry tag                     |

**3.2 ATLAS 360 PLAN and SCAN — now view targets, not a purchased
track**

| **View**  | **Host SPC**                                                    | **When it's offered**                                                                                        | **Status**                                                          |
|-----------|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| PLAN View | ATLAS 360 PLAN v4.0.1 (12-Part PDD Standard, Path A)            | Sessions with origin = manual or cartridge — building something that did not exist before                    | JCSE/Certification WITHHELD by the card's own rule                  |
| SCAN View | ATLAS 360 SCAN v2.1.1 (eight-stage assurance lifecycle, Path B) | Sessions with origin = ingested — a specification or codebase that already existed before this session began | Consolidated master card, JCSE progression documented via STT-01…13 |

*This routing is not a new rule invented for this PDD — it is
ACC-FACTORY's own existing session-origin distinction (manual / ingested
/ cartridge, already used to route billing and to select AISA_PWDD badge
eligibility) mapped directly onto PLAN's and SCAN's own stated
positioning. Ingestion sessions are, by definition, assurance work
against something that already exists; manual and cartridge sessions
are, by definition, building something new.*

**PART 4 — Platform Specifics: PDD Views as an F6/F7 Side-Step**

*Owning SPC: ATLAS ULTRA SI + STRATEGOS ULTRA SI*

**4.0 Updated Stage Table**

| **Stage**                                   | **Type**                                                                   | **Requires a session?**                                                                | **Status**                                            |
|---------------------------------------------|----------------------------------------------------------------------------|----------------------------------------------------------------------------------------|-------------------------------------------------------|
| F0                                          | Standalone paid service — advisory retainers                               | No                                                                                     | Live; billing plumbing not confirmed (v0.1, Part 1.2) |
| F0.1 (NEW)                                  | Standalone paid service — SPC PLAYER content creation                      | No                                                                                     | PROPOSED, v0.1, unchanged                             |
| F0.5                                        | Pipeline stage — MATHMON Applicability Intake                              | Yes, pre-F1                                                                            | PROPOSED, prior PDD (…-OSIRIS-2026-001)               |
| F1–F8                                       | Pipeline stages                                                            | Yes                                                                                    | SHIPPED                                               |
| F9                                          | Pipeline stage — MATHMON post-deployment validation                        | Yes                                                                                    | PROPOSED, prior PDD                                   |
| F9.5                                        | Pipeline stage — OSIRIS custody & monitoring                               | Yes (after F9)                                                                         | PROPOSED, prior PDD                                   |
| Side-step: ATLAS J                          | JSON crystallisation of an F6 ATLAS PDD                                    | Yes — needs an existing F6 artifact                                                    | SHIPPED                                               |
| Side-step: PFP                              | Drift detection between F7 PDD and F8 codebase                             | Yes — needs F7 + F8 artifacts                                                          | SHIPPED                                               |
| Side-step: PDD Views — PLAN (NEW, this PDD) | Renders an F6/F7 artifact in ATLAS 360 PLAN's 12-Part format               | Yes — needs an existing F6/F7 artifact; offered by default for manual/cartridge origin | PROPOSED, this revision                               |
| Side-step: PDD Views — SCAN (NEW, this PDD) | Renders an F6/F7 artifact in ATLAS 360 SCAN's eight-stage assurance format | Yes — needs an existing F6/F7 artifact; offered by default for ingested origin         | PROPOSED, this revision                               |

*F10 no longer exists as a stage number. PLAN and SCAN views sit
alongside ATLAS J and PFP in ACC-FACTORY's existing side-step family —
all four are optional, additive operations against an artifact a session
has already produced, none of them mutate F6/F7's own system prompts or
outputs.*

**4.1 Why this is architecturally safer than v0.1**

ACC-FACTORY's own documentation states the reason ATLAS J is a separate
endpoint rather than folded into F6: doing so keeps F6's system prompt —
and therefore the cached LLM fixture hashes the cross-provider test
suite depends on — byte-identical. The same reasoning applies here: PLAN
View and SCAN View must be separate side-step engines, never edits to
F6's or F7's own prompts, or every existing cached fixture for F6/F7
breaks.

**4.2 PDD View Architecture**

- **\[SYNTH\]** Entry point: GET
  /api/harness/sessions/:id/pdd-view?format=plan\|scan (new route,
  requires the session already has an F6 ATLAS_PDD or F7 MVP_PDD
  artifact — 404 otherwise, same convention F8's drift-gate check
  already uses for a missing PFP report).

- **\[SYNTH\]** PLAN View: re-frames the session's existing PDD content
  into ATLAS 360 PLAN's 12-Part Standard (Parts 0–11), including PLAN's
  own mandatory Part 10 (Security & Governance) and Part 11 (Regulatory
  Conformity) — these are non-deferrable per the card's own rule, so the
  view generation must produce them even when the native 4-Part ATLAS
  PDD didn't need to.

- **\[SYNTH\]** SCAN View: re-frames the session's existing PDD (and,
  where available, its F8 codebase and any PFP drift report) into SCAN's
  eight-stage assurance lifecycle, starting from a Freeze-stage Evidence
  Manifest — this is a natural reuse of content an ingested session
  already has, since ingestion itself started from an existing artifact.

- **\[SYNTH\]** Neither view re-runs F1–F8. Both are read-only
  transformations of artifacts that already exist.

**PART 5 — Atomic Prompt / Feature Traceability Worksheet**

*Owning SPC: KONSTRUCT + CORDON*

| **Feature**                  | **Atomic task**                                                                                                                                                       | **ACC-FACTORY file (proposed)**                                     | **Gate**                                                                                             |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| PDD View — PLAN              | Re-render an existing F6/F7 artifact into ATLAS 360 PLAN's 12-Part Standard, including mandatory Parts 10–11                                                          | engines/pdd-view-plan.ts (new)                                      | F6 ATLAS_PDD or F7 MVP_PDD artifact exists for the session; Practitioner tier (same gate as ATLAS J) |
| PDD View — SCAN              | Re-render an existing F6/F7 artifact (plus F8/PFP where available) into ATLAS 360 SCAN's eight-stage assurance format, starting from a Freeze-stage Evidence Manifest | engines/pdd-view-scan.ts (new)                                      | F6/F7 artifact exists; Practitioner tier (same gate as PFP)                                          |
| View route                   | Single endpoint, format param selects engine; defaults to the origin-appropriate view (manual/cartridge → plan, ingested → scan) if no format is specified            | routes/harness.ts (extend) — GET /api/harness/sessions/:id/pdd-view | Session exists and belongs to the requesting user                                                    |
| Certification-withheld label | Attach a fixed disclosure string to every PLAN View response, sourced from the card's own registry status                                                             | engines/pdd-view-plan.ts (constant)                                 | Always applied — not conditional                                                                     |

**PART 6 — Implementation, CI/CD & Deployment Plan**

*Owning SPC: ATLAS ULTRA SI*

| **Phase**                  | **Scope**                                                                                           | **Depends on**                                       |
|----------------------------|-----------------------------------------------------------------------------------------------------|------------------------------------------------------|
| Phase 0 — F0.1 (unchanged) | SPC PLAYER standalone service, per v0.1 Parts 4.1/5                                                 | Nothing new — carries forward from v0.1              |
| Phase 1 — PLAN View        | engines/pdd-view-plan.ts, route wiring, Practitioner-tier gate reuse, certification-withheld label  | An existing F6 artifact to test against              |
| Phase 2 — SCAN View        | engines/pdd-view-scan.ts, Freeze-stage Evidence Manifest generation from ingested-session artifacts | An existing ingested-origin session's F6/F7 artifact |
| Phase 3 — Default routing  | Wire the origin-based default (manual/cartridge → plan, ingested → scan) into the route handler     | Phases 1 and 2 both complete                         |

**6.1 Test Strategy**

Add new cached-fixture sets for the PLAN View and SCAN View LLM calls,
following the exact pattern already used for ATLAS J and PFP fixtures.
No new billing tests are required, since Phase 1–3 introduce no new
Stripe SKU — the existing tier-gate test coverage for Practitioner-only
routes should extend directly to the two new routes.

**PART 7 — Summary of Sources**

| **Source**                                                                                                     | **Use**                                                                                                                                       |
|----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| ATLAS 360 PLAN v4.0.1 (JNGL-SPC-ATLAS360PLAN)                                                                  | 12-Part Standard, Parts 10–11 mandatory rule, certification-withheld status, Part 2.2, 3.2, 4.2                                               |
| ATLAS 360 SCAN v2.1.1 (JNGL-SPC-ATLAS360SCAN-2026-003)                                                         | Eight-stage lifecycle, Freeze-stage Evidence Manifest, Part 3.2, 4.2                                                                          |
| ACC-FACTORY docs/architecture/features.md                                                                      | ATLAS J's own stated reason for staying a separate endpoint (byte-identical F6 prompt) — the precedent this PDD's Part 4.1 relies on directly |
| ACC-FACTORY — F0.1 (SPC PLAYER) & F10 (ATLAS 360 SUITE) Paid-Service PDD v0.1 (this document's prior revision) | Baseline this rework supersedes for the ATLAS 360 portion only                                                                                |

**PART 8 — Definition of Terms**

| **Term**                                       | **Definition**                                                                                                                                                                              |
|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| PDD View                                       | A read-only re-rendering of a session's existing F6/F7 PDD artifact into an alternate document standard — introduced by this revision to replace the v0.1 standalone F10 concept            |
| Side-step                                      | ACC-FACTORY's existing term for an engine that operates on an artifact a session has already produced, without re-running or modifying the stage that produced it — precedent: ATLAS J, PFP |
| Session origin (manual / ingested / cartridge) | ACC-FACTORY's existing field distinguishing how a session started; reused here (not newly invented) to route PLAN View vs. SCAN View by default                                             |
| Path A / Path B                                | ATLAS 360's own routing distinction, now expressed through session origin rather than a new customer-facing question                                                                        |

**SKRIBE SBIS — Styling & Layout (Binding)**

- Running header: document title + Production ID (applied)

- Footer: copyright + Page X of Y (applied)

- Typography: Arial headers, Times New Roman body (applied)

- Palette: Navy \#0D1B4B primary, Gold \#C8962A accent (applied)

- Registry-sourced content tagged \[REG\]; this PDD's own synthesis
  tagged \[SYNTH\] — applied throughout Parts 3–5

**Appendices & Change Log**

**Outstanding Items (carried or new)**

- Confirm F0's actual current billing mechanism (carried from v0.1 —
  still applies to F0.1, unaffected by this rework)

- Open and inspect SPC.MD / SPC.MD-Agents to determine whether either is
  SPC PLAYER's existing codebase (carried from v0.1)

- Decide the exact wording and placement of the PLAN View's
  certification-withheld disclosure label (Part 2.2 — new in this
  revision)

- Confirm that Practitioner-tier gating (reused from ATLAS J/PFP) is the
  intended access level for both new views, rather than a stricter or
  looser gate

- Run SOLVA GAUNTLET on this integration plan before Phase 1 begins

**Change Log**

| **Version**                   | **Date**              | **Summary**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|-------------------------------|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| v0.1 — Design Intent          | 2026-09-13            | Initial PDD: F0.1 (SPC PLAYER) and F10 (ATLAS 360 SUITE) as standalone paid services alongside F0. Proposed a new Stripe SKU family for F10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v0.2 — Design Intent (Rework) | 2026-09-13 (same day) | Per direct operator instruction, retired F10 as a standalone stage. ATLAS 360 PLAN and SCAN reintegrated as PDD Views — a new side-step off F6/F7, architecturally matching ATLAS J and PFP. Routing between PLAN View and SCAN View now reuses ACC-FACTORY's existing session-origin field instead of a new intake question. Monetization simplified to reuse the existing Practitioner-tier side-step gate; the v0.1 STRIPE_PRICE_F10_ATLASSUITE\_\* SKU proposal is withdrawn. F0.1 (SPC PLAYER) unchanged. Certification-withheld disclosure for ATLAS 360 PLAN moved from product-level to view-level. |
