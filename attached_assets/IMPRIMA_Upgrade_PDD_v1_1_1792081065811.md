# IMPRIMA — Document Design, Creation and Publication Engine

*Upgrade PromptWare Design Document (PDD) v1.1 for the ATANDA Command Centre and the ARK Harness · Built under ATLAS 360 PLAN v4.0.1 · JNGL-PDD-IMPRIMA-2026-001 · Monday 12 October 2026, 14:49 CDT · Tier 0 · JCSE not asserted · Confidential — Internal*

# PART 0 — Title and Contents Page

*Owning SPC: ATLAS 360 PLAN*

| Field | Value |
| --- | --- |
| Document | IMPRIMA — Document Design, Creation and Publication Engine. Upgrade PDD, Version 1.1 |
| Supersedes | v1.0 of 12 October 2026, 14:37 CDT (same Production ID) |
| Production ID | JNGL-PDD-IMPRIMA-2026-001 (assigned this pass; uniqueness checked only against IDs visible in the project documents) |
| Upgrade target | ATANDA Command Centre (ACC) running the ARK Harness F0–F11, plus the SPC Player |
| Standard | ATLAS 360 PLAN v4.0.1, 12-Part PDD (Parts 0–11), full Atomic Prompt Worksheet in Part 5 |
| Engine team | KLARITY (clarity) · SKRIBE (design and publishing) · SOCRATES (interrogation) · ADA (architecture and build) |
| Sequencing | CORDON procedure (map, sort, break ties, flag) applied by hand and checked by a script that computes waves, cycles, orphans and priority inheritance. Not run through any CORDON runtime |
| Author / Principal | OLUSEYE AMUSA — Junglenomics · Koncentric Labs Inc. · Idea Factory Limited · ATANDA Publications Forum |
| Drafting model | Claude (configured as claude-opus-5-5). AI-drafted; requires human review |
| Status | DRAFT v1.1 — Tier 0 (self-attested, no independent review) |
| JCSE | Not asserted. No score is claimed in this document |
| Honesty Gate | G3, Tier 0. Every external standard is tagged with its basis (Part 7) |
| GRO mode | HUMAN_IN_LOOP — no Final document leaves the library without a named human approval (IMP-GOV-001) |

> **Honesty note.** IMPRIMA does not exist yet. This PDD specifies it. Every capability below is a design target, not a measured result. The name IMPRIMA was confirmed by the Principal on 12 October 2026; it has not been screened (Part 9).

## This document under its own naming rule

The engine's naming convention (Part 4.4) applied to this PDD:

`IMPRIMA-Upgrade-PDD__20261012-1449CDT__ADAeM-2-0__OLUSEYE-AMUSA__DOCX.docx`

| Token | Value |
| --- | --- |
| 1. Title | IMPRIMA Upgrade PDD |
| 2. Date and time stamp | 12 October 2026, 14:49 CDT |
| 3. Project | ADAeM 2.0 |
| 4. Author | OLUSEYE AMUSA |
| 5. Format | DOCX |

## Contents

| Part | Title | What it holds | Owning SPC(s) |
| --- | --- | --- | --- |
| 0 | Title and Contents Page | Title block, naming example, contents, reading guide | ATLAS 360 PLAN |
| 1 | Statement of Requirements | Purpose, scope, artifacts, actors, requirements, invariants, reconciliation | ADA + KLARITY |
| 2 | Business Case, Users & Validation | Value case, users, indicators, validation plan, risks | SKRIBE + SOCRATES |
| 3 | SPC Roster | The four engine SPCs, separation of duties, Dev Kit | ATLAS 360 PLAN |
| 4 | Platform Specifics | Pipeline, button placement, adapters, naming, templates, scores, data model | ADA + SKRIBE |
| 5 | Atomic Prompt Worksheet (colour-coded) | Method, roll-up, critical path, 74 prompts | ATLAS 360 PLAN + CORDON |
| 6 | DJ Implementation Plan | Releases, gates, tools, codebase, hosting, risks | VIBE DJ · CODE DJ · HOST DJ |
| 7 | Summary of Sources | Source ledger and claim tags | KLARITY |
| 8 | Definition of Terms | Glossary | KLARITY |
| 9 | IP Pre-Registration Screening | Name screening plan; no search performed | SKRIBE |
| 10 | Security & Governance Control Domains | Nine domains mapped to prompts | ADA + SOCRATES |
| 11 | Regulatory Conformity Mapping | External and internal frameworks, kept apart | SOCRATES |
| App. A–C | Open decisions, Honesty Gate, version history | — | ATLAS 360 PLAN |

## Reading guide

**Size.** 74 atomic prompts in 10 features, joined by 115 dependencies and sequenced into 9 build waves. **IDs.** Every prompt is IMP-&lt;FEATURE&gt;-&lt;NNN&gt;. **Colours.** MAX palette: red P0 (needed for the first release), amber P1 (needed for a complete product), blue P2 (valuable, deferrable), grey P3. An arrow (↑) marks a priority raised by inheritance. **Tags.** [INT]† internal self-claim; [SPEC] specified, not built; [EXT-K] external, from the drafting model's knowledge, not re-read in this pass; [SYNTH] derived in this pass.

# PART 1 — Statement of Requirements

*Owning SPCs: ADA + KLARITY*

## 1.1 Purpose

The ARK Harness produces a steady stream of artifacts — Micro Agents, Micro PDDs, SPCs, ATLAS PDDs, MVP PDDs and Living PDDs — and the F0 business services and the SPC Player produce content around them. Today each one becomes a stakeholder document by hand: Markdown is drafted, a DOCX is built with a script, validated, rendered to PDF and spot-checked. That works, but it is slow, it depends on one person, and names, branding and disclosures drift between documents.

IMPRIMA makes that workflow a button. Wherever an artifact is finished, a **PUBLISH DOCUMENT** button turns it into a professionally formatted document in DOCX, PDF or HTML, named by one rule, branded by one design system, edited for clarity, questioned for honesty and approved by a named person.

## 1.2 What IMPRIMA must get right

1. **One name, every time.** Every file carries five tokens in a fixed order: Title, Date and time stamp, Project, Author, Format.
2. **Clearer, never different.** KLARITY improves the prose but never touches IDs, numbers, scores, quotes, code or worksheet prompts.
3. **Honest before handsome.** SOCRATES checks every status claim and figure before SKRIBE lays the document out. A document that claims certification without evidence is held.
4. **One source, three formats.** DOCX, PDF and HTML are rendered from the same content and carry the same content hash.

## 1.3 What can be published

| Artifact | Produced at | Adapter | Release |
| --- | --- | --- | --- |
| Micro Agent (CELL MA Birth Package) | F3 | IMP-SRC-004 | R2 |
| Micro PDD | F4 | IMP-SRC-005 | R2 |
| Super Prompt Card (SPC) | F5 | IMP-SRC-006 | R1 |
| ATLAS PDD (4-Part or 12-Part) | F6 | IMP-SRC-007 | R1 |
| MVP PDD (SPARTAN) | F7 | IMP-SRC-008 | R1 |
| Living PDD (snapshot) | F9.5 view, ATLAS Mode 4 | IMP-SRC-009 | R2 |
| F0 business-service output | F0 | IMP-SRC-010 | R2 |
| SPC Player session output | SPC Player | IMP-SRC-011 | R2 |

## 1.4 Scope

**In scope.** The PUBLISH DOCUMENT button and dialog; eight source adapters; the Canonical Document Model; the naming rule; KLARITY's clarity pass; SOCRATES's interrogation; SKRIBE's templates and design score; DOCX, PDF and HTML rendering and validation; the document library, versioning and audit; Draft and Final publishing; hand-off to F10 and F11 connectors.

**Out of scope for v1.0.** F8 codebase bundles and F9 MECHA outputs (code and signed machine artifacts, not documents); PowerPoint and slide output; external distribution such as email; translation; any change to the artifacts themselves (IMPRIMA reads a saved version and never writes back).

## 1.5 Actors

| Actor | Who | What IMPRIMA does for them |
| --- | --- | --- |
| Publisher | ACC staff member working an artifact through the F-stages | Publishes Draft or Final documents from the stage they are in |
| Author | The accountable human named on the artifact | Named in the filename and title block; answers SOCRATES's questions |
| Approver | A named person with approval rights | Reviews and approves Final documents |
| Reader | Executives, clients, investors, team members | Receives a clear, branded, honest document |
| Engine SPCs | KLARITY, SOCRATES, SKRIBE, ADA | Each does one job; none approves its own work |

## 1.6 Functional requirements

| ID | Requirement | Prompts |
| --- | --- | --- |
| FR-01 | Show PUBLISH DOCUMENT at the configured F-stages and in the SPC Player | IMP-UIX-001, 002 |
| FR-02 | Publish only a saved version, snapshotted at request time | IMP-SRC-003 |
| FR-03 | Accept all eight artifact types through adapters into one document model | IMP-SRC-001 to 011 |
| FR-04 | Name every file Title · Date-Time · Project · Author · Format | IMP-NAM-001 to 008 |
| FR-05 | Let the publisher choose formats, audience and Draft or Final, with a filename preview | IMP-UIX-003 |
| FR-06 | Edit prose for clarity to the chosen audience, leaving protected content untouched | IMP-KLR-001 to 003 |
| FR-07 | Add a glossary and summary only where missing, and label additions | IMP-KLR-004, 005 |
| FR-08 | Check status claims, figures and consistency, and issue a verdict | IMP-SOC-001 to 005 |
| FR-09 | Apply house templates, title block, colour coding and disclosure footer | IMP-SKR-001 to 007 |
| FR-10 | Render DOCX, PDF and HTML from one source and validate each | IMP-RND-001 to 006 |
| FR-11 | Show a review panel and record a named approval for Final documents | IMP-UIX-005, 006; IMP-GOV-001 |
| FR-12 | Store, version and securely serve published documents | IMP-PUB-001 to 005 |
| FR-13 | Hand files to F10 and F11 connectors when configured | IMP-PUB-006 |

## 1.7 Non-functional requirements

All targets are [SPEC]; none is measured.

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-01 | Naming conformance | 100% of files match the five-token pattern |
| NFR-02 | Format parity | All formats of one job share one content hash |
| NFR-03 | Fidelity | 100% of protected spans byte-identical after the clarity pass |
| NFR-04 | Accessibility | WCAG 2.2 AA for contrast, alt text, heading order and language |
| NFR-05 | Turnaround | A Draft for a typical SPC or PDD within a few minutes (to be measured in the pilot) |
| NFR-06 | Privacy | Files private by default, encrypted at rest, served through expiring links |
| NFR-07 | Traceability | Every document links to its source artifact's ID and version hash |

## 1.8 Invariants

| ID | Invariant |
| --- | --- |
| INV-01 | **Five tokens, fixed order.** Title · Date-Time · Project · Author · Format, in every filename and in the document's own metadata |
| INV-02 | **A human is the author.** No SPC, agent or model is ever named as author; the AI team is disclosed inside the document |
| INV-03 | **Clarity never changes meaning.** Protected spans are never edited |
| INV-04 | **No silent upgrades.** No document says built, certified, compliant or audited without evidence; SOCRATES holds it |
| INV-05 | **Separation of duties.** SOCRATES flags but never edits; KLARITY edits but never approves; SKRIBE scores layout, not truth |
| INV-06 | **Scores stay separate.** KLARITY's three figures and SKRIBE's design score are never merged into one number |
| INV-07 | **Published means immutable.** A re-publish is a new version; nothing is overwritten |
| INV-08 | **A human signs Final.** No Final document is released without a named approval |

## 1.9 Reconciliation register

| ID | Issue found | Ruling in this PDD |
| --- | --- | --- |
| XR-01 | The request says "FO business services" | **F0** (zero), the advisory, intake and diagnostic stage named in the 23 Sep 2026 SCAN. Confirmed by the Principal on 12 October 2026 (OD-IMP-02, decided) |
| XR-02 | The SPC Player Omnibus v4.0 is a Pre-Build specification | The SPC Player adapter (IMP-SRC-011) is specified against its saved-output contract; it cannot be tested until the Player runs |
| XR-03 | Worksheet colours differ: KAMBRIA uses green for P2, the MAX palette uses blue | MAX palette adopted for the ACC: P0 red, P1 amber, P2 blue, P3 grey |
| XR-04 | Brand palettes differ: KAMBRIA tokens (#1F3A5F, #16706F) vs the APF house palette | APF house palette adopted: Navy #1B2A4A, Deep Navy #0D1B40, Gold #C9A227, Teal #1F6F6B |
| XR-05 | "Living PDD" has no single F-stage | Published as a dated snapshot from wherever it is viewed; the button appears on the Living PDD view (F9.5) |
| XR-06 | ADA appears as ADA ULTRA SI and as the ADA Advanced Development Architect SPC | Same lineage; ADA ULTRA SI is used. Card scores are not repeated |
| XR-07 | KLARITY appears as KLARITY and KLARITY SI, with different self-scores in different documents (46 and 48) | Same card; no score asserted here |
| XR-08 | SKRIBE appears as SKRIBE and SKRIBE ULTRA SI (47 and 48) | Same card; no score asserted here |
| XR-09 | The Format token repeats what the file extension already says | Kept as the fifth token. Confirmed by the Principal on 12 October 2026 (OD-IMP-03, decided) |
| XR-10 | The author's display name varies across documents (Oluseye Amusa, Oluseye Shay Amusa) | The Author token uses the name on the publisher's profile; this PDD uses OLUSEYE AMUSA |
| XR-11 | SKRIBE's own card describes pricing tiers and broad export formats | Not carried. IMPRIMA is internal and limited to DOCX, PDF and HTML |

# PART 2 — Business Case, Users & Validation

*Owning SPCs: SKRIBE + SOCRATES*

## 2.1 The value case

The ecosystem's output is documents: PDDs, SPC cards, analyses, manuals. Each one is a public face of the work, and each one currently takes a manual build. IMPRIMA turns that into a repeatable step with three gains:

- **Time.** The manual Markdown → script → validate → render → check cycle becomes one dialog. [SPEC]
- **Consistency.** One naming rule, one design system, one disclosure footer, across every artifact type.
- **Integrity.** The Honesty Gate stops being a reviewer's habit and becomes a check that runs on every document.

No revenue is asserted. IMPRIMA is an internal capability. Whether it is later offered to SPHINX Marketplace creators is OD-IMP-08.

## 2.2 Users

| User | Need | What IMPRIMA offers |
| --- | --- | --- |
| ACC production staff | Turn finished artifacts into stakeholder documents quickly | Publish from the stage, with previews |
| The Principal | Consistent, honest documents under one brand | Naming rule, templates, SOCRATES verdicts, approval |
| Clients and partners | Readable deliverables | Audience profiles and the clarity pass |
| Investors and academic contacts | Credible, well-presented material | Professional layout with clear disclosure |
| Training cohorts (ARK Harness + Context Craft) | Clean handouts of worked examples | HTML and PDF from any artifact |

## 2.3 Indicators

All are [SPEC] pilot targets, not results.

| Indicator | Why it matters | Pilot target |
| --- | --- | --- |
| Naming conformance | Proves INV-01 | 100% |
| Format parity | Proves one source, three formats | 100% of jobs |
| Protected-span fidelity | Proves KLARITY never changes meaning | 100% |
| First-pass SKRIBE score of 43 or more | Layout quality without rework | Tracked; baseline in pilot |
| SOCRATES HOLD rate and override rate | Shows how often honesty issues appear and how they are resolved | Tracked; every override has a written reason |
| Time from save to Draft | The time gain | Tracked against the manual baseline |

## 2.4 Validation plan

1. **Golden set.** Publish one saved example of each artifact type and compare against hand-reviewed reference documents (IMP-QAL-001, 007).
2. **Naming and parity.** Automated checks on every pilot job (IMP-QAL-002, 003).
3. **Fidelity.** Byte-compare protected spans before and after the clarity pass (IMP-QAL-004).
4. **Seeded claims.** Plant unsupported "certified" and "compliant" claims and confirm HOLD (IMP-QAL-005).
5. **Re-publish the archive.** Run ten existing project PDDs (for example KAMBRIA v1.1 and COMMAND DECK MAX v1.0) through IMPRIMA and compare with their hand-built versions.

## 2.5 Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The clarity pass changes meaning | Medium | High | Protected spans, change report, fidelity test (IMP-KLR-002, 007; IMP-QAL-004) |
| SOCRATES over-flags and staff override by habit | Medium | Medium | Written override reasons; override rate tracked |
| A secret or personal data reaches a shared file | Low | High | Pre-render scan; CONTAINMENT hold; private default (IMP-GOV-004, 003; IMP-PUB-003) |
| Artifact text carries injected instructions | Medium | High | Text passed as delimited data with no tool access (IMP-GOV-007) |
| HTML and DOCX drift in layout | Medium | Low | Content parity by hash; layout differences accepted and documented |
| Adapters break when an artifact format changes | Medium | Medium | Adapters versioned against each artifact's schema; golden set re-run on change |

# PART 3 — SPC Roster: Skills & Contributory Roles

*Owning SPC: ATLAS 360 PLAN*

## 3.1 The engine team

Card scores in source cards are self-claims [INT]† and are not repeated here.

| SPC | Camelot seat (registry) | Role in IMPRIMA | Owns | Prompts |
| --- | --- | --- | --- | --- |
| **ADA** (ADA ULTRA SI) | Technical architecture | Architect and builder. Contracts, adapters, rendering, validation, UI, storage, security | SRC, RND, UIX, most of PUB, GOV and QAL | 37 |
| **SKRIBE** (Structured Knowledge Rendering & Intelligent Brief Engine) | #8 Master Document Architect | Document architect. Naming, design system, templates, title block, design score, versioning | NAM, SKR, part of PUB | 20 |
| **KLARITY** (Knowledge Layer for Articulate Reasoning, Insights & Technical Yield) | #6 Chief Communication Officer | Plain-language editor. Audience profiles, protected spans, clarity pass, glossary, three-axis figures | KLR | 8 |
| **SOCRATES** (Systematic Ontological Critique & Reasoning Analytical Technique for Enterprise Solutions) | #7 Philosopher-in-Residence | Interrogator. Claim extraction, Honesty Gate, consistency, dialectic questions, verdict, approval rule | SOC, part of GOV | 9 |

## 3.2 How they work together

| Step | Who leads | Who checks |
| --- | --- | --- |
| Normalise the artifact | ADA | SOCRATES (consistency) |
| Make it readable | KLARITY | SOCRATES (meaning), QAL fidelity test |
| Question it | SOCRATES | The author answers; a human resolves HOLD |
| Lay it out | SKRIBE | ADA (validation), accessibility pass |
| Render and validate | ADA | SKRIBE (design score) |
| Approve and publish | Human approver | Audit log |

The order matters: SOCRATES reads the clarified text, so it questions what the reader will actually see.

## 3.3 Dev Kit

| Card | Use here | Disclosed consequence |
| --- | --- | --- |
| ATLAS 360 PLAN | Authored this PDD | Self-scored lineage; no independent review |
| CORDON | Sequencing procedure for Part 5 | Applied by hand and checked by script; never run as software |
| CODON | Not used | IMPRIMA is new; there is no MVP to align against |
| SPARTAN | Scopes Release 1 in Part 6 | Pre-Build card |
| CODE DJ · VIBE DJ · HOST DJ | Build, tool and hosting roles in Part 6 | Roles, not yet executed |
| BUGMXT | Defect scan before each release (IMP-QAL-006) | Pre-Build card |

# PART 4 — Platform Specifics

*Owning SPCs: ADA + SKRIBE*

## 4.1 The publish pipeline

| Stage | Name | Lead | Output | Job state |
| --- | --- | --- | --- | --- |
| P0 | Request | Publisher | Formats, audience, Draft or Final; snapshot of the saved version | QUEUED |
| P1 | Normalise | ADA | Canonical Document Model (CDM); secret and personal-data scan | NORMALISING |
| P2 | Clarify | KLARITY | Clarified CDM; change report; glossary and summary if missing | CLARIFYING |
| P3 | Interrogate | SOCRATES | Publication Review Note; verdict CLEAR, CLEAR_WITH_NOTES or HOLD | INTERROGATING |
| P4 | Design and render | SKRIBE + ADA | DOCX, PDF and HTML with the five-token names | RENDERING |
| P5 | Validate | ADA + SKRIBE | Validation results, accessibility results, design score, content hash | VALIDATING |
| P6 | Approve | Human | Named approval (Final only) | AWAITING_APPROVAL |
| P7 | Publish | SKRIBE + ADA | Library record, version, signed links, trace event | PUBLISHED |

Exit states: **PUBLISHED**, **HELD** (SOCRATES HOLD, secrets found, or design score below 38) or **FAILED** (a technical error, with the reason shown).

## 4.2 Where the button appears

| Stage | What is published | Button | Note |
| --- | --- | --- | --- |
| F0 / F0.5 | Business-service output (advisory, intake, diagnostic) | Shown | Labelled service output, not a certified artifact |
| F1 | Prompt diagnostic | Hidden | Configurable; no stakeholder document by default |
| F2 | Atomic Prompt | Hidden | Configurable |
| F3 | CELL Micro Agent | Shown | |
| F4 | Micro PDD | Shown | |
| F5 | SPC | Shown | |
| F6 | ATLAS PDD | Shown | 4-Part and 12-Part layouts |
| F7 | MVP PDD | Shown | Carries the verification URL |
| F8 | Code DJ bundle | Hidden | Out of scope (code) |
| F9 | MECHA output | Hidden | Out of scope (signed machine artifacts) |
| F9.5 | Living PDD view | Shown | Publishes a dated snapshot |
| F10 | Release and export controls | Shown | Re-publishes or exports an already published document |
| F11 | Host Connector hand-off | Hidden | Receives files from IMPRIMA; does not publish |
| SPC Player | Session output | Shown | Pending a running Player (XR-02) |

**Button behaviour.** Disabled until the artifact is saved. One click opens the publish dialog; nothing is generated until the publisher confirms.

## 4.3 The publish dialog

| Field | Choice | Default |
| --- | --- | --- |
| Formats | DOCX · PDF · HTML (any combination) | DOCX and PDF |
| Audience | Executive · Technical · Client · Public | Technical |
| Mode | Draft (watermarked, no approval) · Final (named approval) | Draft |
| Title | Pre-filled from the artifact; editable | Artifact title |
| Project | Pre-filled from the ACC project; required | Current project |
| Author | Pre-filled from the publisher's profile | Signed-in user |
| Date and time | Shown as "set when rendering completes"; not editable | — |
| Filename preview | One line per chosen format, updated live | — |

## 4.4 The naming convention

**Pattern.** `<Title>__<Date-Time>__<Project>__<Author>__<FORMAT>.<ext>`

| # | Token | Source | Rule | Example |
| --- | --- | --- | --- | --- |
| 1 | Title | Artifact title, editable in the dialog | ASCII; spaces and punctuation become hyphens; at most 60 characters; empty blocks publishing | KAMBRIA-Newsletter-Engine-PDD |
| 2 | Date and time stamp | Clock at the end of rendering | YYYYMMDD-HHMM plus the publisher's time-zone abbreviation | 20261012-1437CDT |
| 3 | Project | ACC project record | Same character rules as Title; required | ADAeM-2-0 |
| 4 | Author | Publisher's profile or the artifact's named Principal | A human name, never an SPC, agent or model | OLUSEYE-AMUSA |
| 5 | Format | The format being written | DOCX, PDF or HTML, with the matching extension | DOCX.docx |

**Assembly rules.**

- Tokens are joined by a double underscore so each token can be split back out unambiguously; hyphens stay inside tokens.
- Total length is capped at 180 characters by shortening only the Title token.
- Two files with the same name in the same minute get -02, -03 appended to the Title token.
- The same five fields are written inside the document: the title block, DOCX core properties (title, creator, created), PDF document information and HTML meta tags. A file whose metadata disagrees with its name fails the naming test (IMP-QAL-002).

**Full example set for one job.**

| Format | Filename |
| --- | --- |
| DOCX | KAMBRIA-Newsletter-Engine-PDD__20261012-1437CDT__ADAeM-2-0__OLUSEYE-AMUSA__DOCX.docx |
| PDF | KAMBRIA-Newsletter-Engine-PDD__20261012-1437CDT__ADAeM-2-0__OLUSEYE-AMUSA__PDF.pdf |
| HTML | KAMBRIA-Newsletter-Engine-PDD__20261012-1437CDT__ADAeM-2-0__OLUSEYE-AMUSA__HTML.html |

## 4.5 The Canonical Document Model

Every adapter produces the same structure, so templates and renderers never need to know which artifact they came from.

| Block | Holds | Protected by default |
| --- | --- | --- |
| metadata | Five naming fields, production ID, source ID and version hash, status, Tier, JCSE line, verification URL | Yes |
| heading | Level 1–4 text | No |
| paragraph | Prose | No |
| list | Ordered or unordered items | No |
| table | Header, rows, column hints | Cells with IDs, numbers or scores |
| callout | Honesty note, warning or tip | No |
| code | Code or JSON | Yes |
| figure | Image reference and alt text | Image yes; alt text no |
| worksheet_row | ID, prompt text, owner, priority, dependencies, wave | Yes |

## 4.6 Templates and design tokens

| Token | Value |
| --- | --- |
| Navy | #1B2A4A (headings, table headers) |
| Deep Navy | #0D1B40 (title page) |
| Gold | #C9A227 (accent, rules) |
| Teal | #1F6F6B (secondary accent, links) |
| Headings | Cambria |
| Body | Calibri |
| Priority fills | P0 red · P1 amber · P2 blue · P3 grey |
| Title block | Five naming fields, production ID, status, Tier, JCSE line, confidentiality marking |
| Header and footer | Title and production ID; page X of Y; confidentiality marking |
| Disclosure footer | AI editorial team, human approver, Tier, "AI-drafted; requires human review" where applicable |
| Draft watermark | "DRAFT — not approved" on every page of Draft documents |

One template per artifact type (IMP-SKR-002). The 12-Part PDD template follows JNGL-DS-4830:2026; the SPC template follows the 15-section card; the MVP PDD template keeps SPARTAN's verification block on the title page.

## 4.7 Scores and verdicts

| Measure | Who | Scale | Effect |
| --- | --- | --- | --- |
| Clarity | KLARITY | Per KLARITY-001 | Reported |
| Truthfulness | SOLVA-LITE check (if run) | Per its card | Reported, or "not run" |
| Detectability | LDP-001 check (if run) | Per its card | Reported, or "not run" |
| Design score | SKRIBE | 0–50 on five dimensions | Below 38 holds; 38–42 one revision; 43+ proceeds |
| Verdict | SOCRATES | CLEAR · CLEAR_WITH_NOTES · HOLD | HOLD blocks Final until a human resolves or overrides with a reason |

These figures are shown side by side and never combined (KLARITY-003, INV-06).

## 4.8 Data model

| Table | Holds |
| --- | --- |
| publish_jobs | Source ID and version hash, origin stage, formats, audience, mode, state, timings |
| cdm_snapshots | The normalised CDM per job, content hash |
| clarity_reports | Change report, glossary additions, three figures |
| review_notes | SOCRATES claims, flags, questions, verdict, overrides with reasons |
| document_library | doc_id, production ID, five naming fields, formats, content hash, scores, approver |
| document_files | Per format: filename, storage key, size, validation result |
| document_versions | Version number, supersedes link, change note |
| audit_events | Actor, action, time, version hash, content hash, GRO state |

## 4.9 Integration with existing ACC systems

| System | How IMPRIMA connects |
| --- | --- |
| ARK Harness F-stages | Button and adapters read saved artifacts; IMPRIMA never writes to them |
| SPHINX EXEMPLER | Stays the system of record for artifacts; IMPRIMA stores the exemplar_id when present |
| COMMAND DECK MAX | Receives a document_published trace event (identifiers and hashes only) |
| OSIRIS (F9.5) | Living PDD snapshots carry OSIRIS's version and custody band as metadata |
| F10 / F11 | Published files can be handed to export and host connectors |

## 4.10 Stack

The house stack is assumed [INT]: Node.js 24 with TypeScript, Express 5, PostgreSQL through Drizzle ORM, Clerk authentication, and the Azure target (Container Apps, PostgreSQL row-level security, Key Vault, encrypted blob storage). Rendering reuses the existing toolchain: the Node.js docx library, validate.py, LibreOffice headless for PDF and pdftoppm for page checks. KLARITY and SOCRATES run as model calls through the ACC's configured provider.

## 4.11 GRO states

| State | When | Effect |
| --- | --- | --- |
| LIFE | Default | Normal pipeline |
| SAFE_LIFE | Legal, financial or health content (for example Nigerian legal or ERB material) | Adds a not-advice notice; approval required even for Draft |
| CONTAINMENT | Secrets found, or an artifact tries to instruct the engine | Job held; audit event; human escalation |

## 4.12 What this addresses from SEC REP ONE

The ACC security assessment found, among other things, unencrypted AI artifacts, no PostgreSQL row-level security and prompt-injection exposure. IMPRIMA's own design closes those for its own data (IMP-PUB-003, IMP-GOV-006, IMP-GOV-007). It does not fix them for the rest of the ACC.

# PART 5 — The PDD Atomic Prompt Worksheet (Colour-Coded)

*Owning SPCs: ATLAS 360 PLAN + CORDON*

## 5.1 Method

Each row is one atomic prompt: one instruction with its key constraint, one owner and a verifiable output. At build time each row expands into the house five-field form: ROLE (the owning SPC's seat), INSTRUCTION (the row text), CONSTRAINT (the invariant or rule cited), FORMAT (the record it writes, Part 4.8) and DATA (the inputs named by its dependencies).

Sequencing followed the CORDON procedure: map dependencies, sort into waves (each prompt sits one wave after its latest dependency), break ties by priority, then flag cycles, orphans and priority inversions. A script repeated every check.

## 5.2 Roll-up

| Measure | Value |
| --- | --- |
| Atomic prompts | 74 in 10 features |
| By feature | SRC 11, NAM 8, KLR 7, SOC 6, SKR 8, RND 6, UIX 7, PUB 7, GOV 7, QAL 7 |
| Dependencies | 115 |
| Build waves | 9 |
| Starting points (no dependencies) | 7: IMP-GOV-002, IMP-KLR-001, IMP-NAM-001, IMP-SKR-001, IMP-SOC-006, IMP-SRC-001, IMP-SRC-002 |
| End points (nothing depends on them) | 23 |
| Cycles | 0 |
| Orphans | 0 |
| Priority (as declared) | P0 58 · P1 15 · P2 1 |
| Priority (after inheritance) | P0 59 · P1 14 · P2 1 |
| By owner | ADA 37 · SKRIBE 20 · SOCRATES 9 · KLARITY 8 |

## 5.3 Flags and priority inheritance

The first pass found 2 priority inversions, both on IMP-RND-003 (HTML rendering, declared P1): the P0 validation step (IMP-RND-005) and the P0 parity test (IMP-QAL-003) depend on it. Under CORDON's inheritance rule it took P0, so **HTML is part of Release 1**. No inversion remains.

Two structural fixes were made during sequencing: IMP-SOC-006 (SOCRATES never edits) was an orphan and now feeds the verdict step; the golden-set test was split so Release 1 (IMP-QAL-001) depends on the three Release 1 adapters and Release 2 (IMP-QAL-007) on the other five.

**P0 load.** 59 of 74 prompts are P0. That is heavy but deliberate: naming, honesty, fidelity and approval are the point of the engine. The Principal accepted this load on 12 October 2026 (OD-IMP-07, decided).

## 5.4 Critical path

The longest chain has 9 prompts, one per wave:

IMP-SRC-002 → IMP-KLR-002 → IMP-KLR-003 → IMP-RND-001 → IMP-RND-002 → IMP-RND-005 → IMP-RND-006 → IMP-QAL-001 → IMP-QAL-007

It runs through the clarity pass and rendering, which is where build effort concentrates.

## 5.5 The worksheet

### SRC — Source Intake & Normalisation

*ADA turns every publishable artifact into one Canonical Document Model. 11 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-SRC-001 | Define the publishable\_source contract: source\_id, artifact\_type (MA, MICRO\_PDD, SPC, PDD, MVP\_PDD, LIVING\_PDD, F0\_SERVICE\_OUTPUT, SPC\_PLAYER\_OUTPUT), origin\_stage, version\_hash, project\_id, author\_ref, title, body\_ref, saved\_at. Reject any field outside the enums. | ADA | P0 | — | W1 |
| IMP-SRC-002 | Define the Canonical Document Model (CDM) JSON schema: ordered blocks of heading, paragraph, list, table, callout, code, figure, worksheet\_row and metadata; each block carries a protected flag. | ADA | P0 | — | W1 |
| IMP-SRC-003 | Accept a publish request only for a saved artifact with a version\_hash; snapshot that exact version so later edits never change a document in flight. | ADA | P0 | IMP-SRC-001 | W2 |
| IMP-SRC-004 | Build the F3 CELL Micro Agent adapter: map the five-section Birth Package and its Interface Contract into CDM blocks. | ADA | P1 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-005 | Build the F4 Micro PDD adapter: map the Cheat Sheet, Worksheet and Contract into CDM blocks. | ADA | P1 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-006 | Build the F5 SPC adapter: map the 15-section Super Prompt Card into CDM blocks, keeping the 7-pillar fields as tables. | ADA | P0 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-007 | Build the F6 ATLAS PDD adapter for both the 4-Part and the 12-Part (Parts 0–11) layouts; map worksheet rows to worksheet\_row blocks with their priority. | ADA | P0 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-008 | Build the F7 MVP PDD adapter: map the SPARTAN MVP-PDD and carry its public verification URL and certification ID as metadata, never as body text that KLARITY may edit. | ADA | P0 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-009 | Build the Living PDD adapter: publish a dated snapshot of the Living PDD at its current version hash and label the document 'Snapshot as of &lt;date-time&gt;'. | ADA | P1 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-010 | Build the F0 business-service adapter: map advisory, intake and diagnostic outputs into CDM blocks, tagging them as service output rather than certified artifacts. | ADA | P1 | IMP-SRC-002, IMP-SRC-003 | W3 |
| IMP-SRC-011 | Build the SPC Player adapter: map a saved SPC Player session output into CDM blocks with the playing SPC's name and version as metadata. | ADA | P1 | IMP-SRC-002, IMP-SRC-003 | W3 |

### NAM — Naming Convention

*SKRIBE applies the five-part name: Title · Date-Time · Project · Author · Format. 8 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-NAM-001 | Define the naming rule: &lt;Title&gt;\_\_&lt;Date-Time&gt;\_\_&lt;Project&gt;\_\_&lt;Author&gt;\_\_&lt;FORMAT&gt;.&lt;ext&gt;, five tokens in this fixed order, joined by a double underscore. | SKRIBE | P0 | — | W1 |
| IMP-NAM-002 | Build the Title token from the artifact title: transliterate to ASCII, replace spaces and punctuation with hyphens, collapse repeats, cap at 60 characters. An empty title blocks publishing. | SKRIBE | P0 | IMP-NAM-001, IMP-SRC-001 | W2 |
| IMP-NAM-003 | Build the Date-Time token at the moment rendering completes: YYYYMMDD-HHMM plus the time-zone abbreviation of the publisher's profile (default America/Chicago, e.g. 20261012-1434CDT). | SKRIBE | P0 | IMP-NAM-001 | W2 |
| IMP-NAM-004 | Build the Project token from the ACC project record. A publish request with no project is blocked until the user picks one. | SKRIBE | P0 | IMP-NAM-001, IMP-SRC-001 | W2 |
| IMP-NAM-005 | Build the Author token from the accountable human author (the signed-in publisher or the artifact's named Principal). Never use an SPC, an agent or a model name as the author. | SKRIBE | P0 | IMP-NAM-001, IMP-SRC-001 | W2 |
| IMP-NAM-006 | Build the Format token (DOCX, PDF or HTML) and the matching lower-case extension; one filename per format. | SKRIBE | P0 | IMP-NAM-001 | W2 |
| IMP-NAM-007 | Assemble the filename, enforce a 180-character limit by shortening only the Title token, and append -02, -03 on a same-minute collision. | SKRIBE | P0 | IMP-NAM-002, IMP-NAM-003, IMP-NAM-004, IMP-NAM-005, IMP-NAM-006 | W3 |
| IMP-NAM-008 | Write the same five fields into the document: the title block, DOCX core properties, PDF document info and HTML meta tags. | SKRIBE | P0 | IMP-NAM-007, IMP-SKR-003 | W4 |

### KLR — Clarity Pass

*KLARITY makes the prose readable without touching protected content. 7 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-KLR-001 | Offer four audience profiles (Executive, Technical, Client, Public), each with a target reading level, and store the choice on the publish job. | KLARITY | P0 | — | W1 |
| IMP-KLR-002 | Mark protected spans before any edit: IDs, production IDs, numbers, scores, code, worksheet prompt text, quotes, legal text and verification URLs. | KLARITY | P0 | IMP-SRC-002 | W2 |
| IMP-KLR-003 | Run the plain-language pass on unprotected prose only, to the chosen reading level. | KLARITY | P0 | IMP-KLR-001, IMP-KLR-002 | W3 |
| IMP-KLR-004 | Build or extend the Definition of Terms from terms actually used in the document; keep an existing glossary's wording and add only missing terms. | KLARITY | P1 | IMP-KLR-003 | W4 |
| IMP-KLR-005 | Add a one-page summary only when the artifact has none, and label it 'Summary added by KLARITY'. | KLARITY | P1 | IMP-KLR-003 | W4 |
| IMP-KLR-006 | Report Clarity, Truthfulness and Detectability as three separate figures (KLARITY-003). A check that was not run shows 'not run', never zero and never an estimate. | KLARITY | P0 | IMP-KLR-003, IMP-SOC-005 | W5 |
| IMP-KLR-007 | Produce a change report: every edited sentence shown before and after, for the human reviewer. | KLARITY | P0 | IMP-KLR-003 | W4 |

### SOC — Pre-Publication Interrogation

*SOCRATES questions claims, numbers and consistency before anything is published. 6 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-SOC-001 | Extract every status claim (built, tested, certified, compliant, audited, production-ready) and every figure from the CDM. | SOCRATES | P0 | IMP-SRC-002 | W2 |
| IMP-SOC-002 | Apply the Honesty Gate (G3): flag any status claim without an evidence tag, and any JCSE score not marked self-assigned. | SOCRATES | P0 | IMP-SOC-001 | W3 |
| IMP-SOC-003 | Check internal consistency: counts against tables, scales against each other (for example a JST scale stated two ways), IDs and dates. | SOCRATES | P0 | IMP-SOC-001 | W3 |
| IMP-SOC-004 | Ask the author up to five dialectic questions on the weakest assumptions and attach them to the Publication Review Note. | SOCRATES | P1 | IMP-SOC-002, IMP-SOC-003 | W4 |
| IMP-SOC-005 | Issue a verdict: CLEAR, CLEAR\_WITH\_NOTES or HOLD. HOLD blocks a Final publish until a named human resolves or overrides it with a written reason. | SOCRATES | P0 | IMP-SOC-002, IMP-SOC-003, IMP-SOC-006 | W4 |
| IMP-SOC-006 | Never edit content. SOCRATES only flags and asks; edits come from the author or KLARITY. | SOCRATES | P0 | — | W1 |

### SKR — Design System & Layout

*SKRIBE applies the house templates, title block, colour coding and design score. 8 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-SKR-001 | Define the house design tokens: Navy #1B2A4A, Deep Navy #0D1B40, Gold #C9A227, Teal #1F6F6B; Cambria headings, Calibri body; margins, header and footer. | SKRIBE | P0 | — | W1 |
| IMP-SKR-002 | Define one layout template per artifact type (eight templates), mapping CDM blocks to page styles. | SKRIBE | P0 | IMP-SKR-001, IMP-SRC-002 | W2 |
| IMP-SKR-003 | Build the title block: the five naming fields, production ID, status, Tier, JCSE line and confidentiality marking. | SKRIBE | P0 | IMP-SKR-001 | W2 |
| IMP-SKR-004 | Colour-code worksheet priorities in the MAX palette: P0 red, P1 amber, P2 blue, P3 grey. | SKRIBE | P0 | IMP-SKR-001 | W2 |
| IMP-SKR-005 | Generate the table of contents and running header (title and production ID) and footer (page X of Y). | SKRIBE | P1 | IMP-SKR-002 | W3 |
| IMP-SKR-006 | Switch wide worksheet tables to landscape sections (15840 × 12240 twips, 14400 DXA content width). | SKRIBE | P1 | IMP-SKR-002 | W3 |
| IMP-SKR-007 | Print the disclosure footer on the last page: AI editorial team, human approver, Tier and 'AI-drafted; requires human review' when applicable. | SKRIBE | P0 | IMP-SKR-003 | W3 |
| IMP-SKR-008 | Score the rendered layout on SKRIBE's five dimensions (/50). Below 38 blocks; 38–42 triggers one revision cycle; 43 or above may proceed. Shown separately from KLARITY's three figures. | SKRIBE | P0 | IMP-RND-005 | W7 |

### RND — Rendering & Validation

*ADA renders DOCX, PDF and HTML from one source and checks each file. 6 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-RND-001 | Render DOCX from the CDM and the template with the Node.js docx library, following house rules: ShadingType.CLEAR fills, column widths summing to the content width, PageBreak inside a Paragraph. | ADA | P0 | IMP-SKR-002, IMP-SKR-004, IMP-KLR-003 | W4 |
| IMP-RND-002 | Render PDF from the DOCX through LibreOffice headless so both formats share one layout; export tagged PDF. | ADA | P0 | IMP-RND-001 | W5 |
| IMP-RND-003 | Render HTML as one self-contained file with inline CSS, light and dark themes, phone-width layout and a print stylesheet. | ADA | P0↑ | IMP-SKR-002, IMP-KLR-003 | W4 |
| IMP-RND-004 | Compute a content hash from the CDM text and record it on every format, so DOCX, PDF and HTML can be proven to carry the same content. | ADA | P0 | IMP-RND-001 | W5 |
| IMP-RND-005 | Validate each file: DOCX through validate.py, PDF pages rasterised with pdftoppm for a thumbnail check, HTML through a validator and link check. | ADA | P0 | IMP-RND-002, IMP-RND-003, IMP-RND-004 | W6 |
| IMP-RND-006 | Run the accessibility pass: heading order, alt text, text contrast of at least 4.5:1 and document language, targeting WCAG 2.2 AA. | ADA | P0 | IMP-RND-005 | W7 |

### UIX — PUBLISH DOCUMENT Button

*The button, dialog, progress states and review panel inside the F-stages. 7 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-UIX-001 | Configure which stages show PUBLISH DOCUMENT: F0, F3, F4, F5, F6, F7, Living PDD view (F9.5), F10 and the SPC Player. Hidden at F1, F2, F8, F9 and F11 by default. | ADA | P0 | IMP-SRC-001 | W2 |
| IMP-UIX-002 | Enable the button only when the artifact is saved; otherwise show it disabled with the reason 'Save the artifact to publish it'. | ADA | P0 | IMP-UIX-001, IMP-SRC-003 | W3 |
| IMP-UIX-003 | Build the publish dialog: format checkboxes (DOCX, PDF, HTML), audience profile, Draft or Final, and a live preview of each filename. | ADA | P0 | IMP-UIX-002, IMP-NAM-007, IMP-KLR-001 | W4 |
| IMP-UIX-004 | Show job progress: QUEUED, NORMALISING, CLARIFYING, INTERROGATING, RENDERING, VALIDATING, AWAITING\_APPROVAL, then PUBLISHED, HELD or FAILED. | ADA | P0 | IMP-UIX-003 | W5 |
| IMP-UIX-005 | Build the review panel: page thumbnails, KLARITY change report, SOCRATES notes and verdict, SKRIBE design score and the three KLARITY figures. | ADA | P0 | IMP-UIX-004, IMP-KLR-007, IMP-SOC-005, IMP-SKR-008, IMP-KLR-006 | W8 |
| IMP-UIX-006 | Add 'Approve and publish' for Final jobs, recording the approver's name and time. | ADA | P0 | IMP-UIX-005, IMP-GOV-001 | W9 |
| IMP-UIX-007 | List publish history on each artifact: version, formats, date-time, approver and download links. | ADA | P1 | IMP-PUB-001 | W7 |

### PUB — Publication & Library

*SKRIBE and ADA store, version and hand off published documents. 7 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-PUB-001 | Create the document\_library record: doc\_id, production ID, the five naming fields, source\_id and version\_hash, formats, content hash, scores, verdict and approver. | ADA | P0 | IMP-NAM-008, IMP-RND-004 | W6 |
| IMP-PUB-002 | Inherit the source artifact's production ID when it has one; otherwise assign JNGL-DOC-&lt;TYPE&gt;-&lt;YEAR&gt;-&lt;NNN&gt;. | SKRIBE | P0 | IMP-PUB-001 | W7 |
| IMP-PUB-003 | Store files encrypted at rest and private by default; sharing is an explicit action. | ADA | P0 | IMP-PUB-001 | W7 |
| IMP-PUB-004 | Serve downloads through signed links that expire. | ADA | P0 | IMP-PUB-003 | W8 |
| IMP-PUB-005 | Make every re-publish a new version linked to the one it supersedes; never overwrite a published file. | SKRIBE | P0 | IMP-PUB-001 | W7 |
| IMP-PUB-006 | Hand published files to F10 export and F11 Host Connector destinations (for example Google Drive or SharePoint) when the connector is configured. | ADA | P2 | IMP-PUB-004, IMP-GOV-001 | W9 |
| IMP-PUB-007 | Emit a document\_published trace event to Command Deck MAX with the origin stage, identifiers and hashes only, never the body. | ADA | P1 | IMP-PUB-001 | W7 |

### GOV — Governance & Safety

*Human approval, audit, GRO states, secret and PII scanning, access control. 7 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-GOV-001 | Require a named human approval for a Final publish. Draft publishes skip approval but carry a DRAFT watermark on every page. | SOCRATES | P0 | IMP-SOC-005 | W5 |
| IMP-GOV-002 | Write an audit event for each job state change: actor, action, time, source version hash and content hash. | ADA | P0 | — | W1 |
| IMP-GOV-003 | Bind GRO states: LIFE by default; SAFE\_LIFE for legal, financial and health content (adds a not-advice notice and requires approval even for Draft); CONTAINMENT when a scan finds secrets. | SOCRATES | P0 | IMP-GOV-002 | W2 |
| IMP-GOV-004 | Scan the CDM for secrets (API keys, tokens, connection strings) and personal data before rendering; secrets hold the job, personal data is flagged for the reviewer. | ADA | P0 | IMP-SRC-002 | W2 |
| IMP-GOV-005 | Default every document to 'Confidential — Internal'; changing the marking is an explicit, logged choice. | SKRIBE | P0 | IMP-SKR-003 | W3 |
| IMP-GOV-006 | Enforce row-level security on document\_library by organisation and project. | ADA | P0 | IMP-PUB-001 | W7 |
| IMP-GOV-007 | Pass artifact text to the KLARITY and SOCRATES model calls as delimited data with no tool access, so instructions inside an artifact are never followed. | ADA | P0 | IMP-SRC-002 | W2 |

### QAL — Quality & Test

*Golden-set, naming, parity, protected-span and seeded-claim tests. 7 prompts.*

| ID | Atomic prompt | Owner | P | Depends on | Wave |
| --- | --- | --- | --- | --- | --- |
| IMP-QAL-001 | Golden set, Release 1: publish one saved SPC, ATLAS PDD and MVP PDD in DOCX, PDF and HTML and compare against reviewed reference files. | ADA | P0 | IMP-RND-006, IMP-PUB-001, IMP-SRC-006, IMP-SRC-007, IMP-SRC-008 | W8 |
| IMP-QAL-007 | Golden set, Release 2: publish one saved MA, Micro PDD, Living PDD, F0 service output and SPC Player output in all three formats and compare against reviewed reference files. | ADA | P1 | IMP-QAL-001, IMP-RND-003, IMP-SRC-004, IMP-SRC-005, IMP-SRC-009, IMP-SRC-010, IMP-SRC-011 | W9 |
| IMP-QAL-002 | Naming test: every produced filename matches the five-token pattern and its metadata matches its filename. | SKRIBE | P0 | IMP-NAM-008 | W5 |
| IMP-QAL-003 | Parity test: DOCX, PDF and HTML of one job carry the same content hash. | ADA | P0 | IMP-RND-004, IMP-RND-003 | W6 |
| IMP-QAL-004 | Protected-span test: after the clarity pass, every ID, number, score, quote and code block is byte-identical to the source. | KLARITY | P0 | IMP-KLR-003 | W4 |
| IMP-QAL-005 | Seeded-claim test: an artifact containing 'FORGE Certified' with no evidence tag must receive HOLD. | SOCRATES | P0 | IMP-SOC-005 | W5 |
| IMP-QAL-006 | Run a BUGMXT scan of the engine before each release; no open critical defect may ship. | ADA | P1 | IMP-QAL-001 | W9 |

## 5.6 External prerequisites

| Prerequisite | Needed by | Status |
| --- | --- | --- |
| Saved-artifact schemas for each F-stage | IMP-SRC-004 to 011 | Must be read from the ACC repository by ADA's seat |
| SPC Player saved-output contract | IMP-SRC-011 | Player is Pre-Build (XR-02) |
| KLARITY-001, SOLVA-LITE and LDP-001 checks as callable services | IMP-KLR-006 | Not confirmed to exist as services |
| LibreOffice headless in the hosting image | IMP-RND-002 | House toolchain; not confirmed on Azure |
| F10 / F11 connector targets | IMP-PUB-006 | Not chosen |

# PART 6 — The DJ Implementation Plan

*Owning SPCs: VIBE DJ · CODE DJ · HOST DJ*

## 6.1 Releases

| Release | Name | Scope | Exit gate |
| --- | --- | --- | --- |
| R0 | Contracts and rules | publishable_source, CDM, naming rule, design tokens, audit, GRO binding | Contracts merged; naming test passes on fixtures |
| R1 | Publish SPC, PDD and MVP PDD (SPARTAN MVP) | Button at F5, F6, F7; dialog; KLARITY, SOCRATES, SKRIBE; DOCX, PDF and HTML; library; approval | Validation steps 1–4 (Part 2.4) pass for the three types; human approver signs |
| R2 | All artifact types | Adapters for MA, Micro PDD, Living PDD, F0 output, SPC Player; glossary and summary additions; publish history | IMP-QAL-007 passes; archive re-publish (Part 2.4 step 5) done |
| R3 | Hand-off | F10 export and F11 connector hand-off | One connector tested end to end |

## 6.2 Quality gates

| Gate | Check | Blocks |
| --- | --- | --- |
| G-Name | Filename and metadata match the five-token rule | Rendering output |
| G-Fidelity | Protected spans unchanged | Interrogation |
| G-Honesty | SOCRATES verdict is not HOLD, or a human override is recorded | Final publish |
| G-Design | SKRIBE design score 43 or more (38–42 allows one revision) | Validation exit |
| G-Access | WCAG 2.2 AA checks pass | Publish |
| G-Parity | One content hash across formats | Publish |
| G-Approve | Named human approval (Final) | Release |
| G-Defect | BUGMXT scan shows no open critical defect | Each release |

## 6.3 Tools (VIBE DJ)

| Need | Tool class |
| --- | --- |
| DOCX rendering | Node.js docx library |
| PDF rendering | LibreOffice headless, tagged PDF export |
| HTML rendering | Server-side templating to one self-contained file |
| Validation | validate.py (DOCX), pdftoppm thumbnails (PDF), HTML validator and link checker |
| Accessibility | Contrast checker and heading-order linter |
| Secret scanning | Pattern-based secret scanner |
| Model calls | Configured provider through the ACC |

## 6.4 Codebase (CODE DJ)

One module, `imprima`, inside the ACC repository, with sub-modules matching the features: sources (adapters), cdm, naming, clarity, interrogate, design, render, validate, library, governance, ui. Each sub-module writes audit events and exposes the records in Part 4.8.

## 6.5 Hosting (HOST DJ)

The house target: Azure Container Apps for the API and a separate render worker (LibreOffice is heavy and should not share the API container), PostgreSQL with row-level security, Key Vault for secrets, encrypted blob storage for files. Rendering runs as a queued background job so the button never blocks the stage.

## 6.6 Delivery risks

| Risk | Response |
| --- | --- |
| Artifact schemas are undocumented | ADA's seat reads them from the repository before R1 build; adapters fail closed on unknown fields |
| LibreOffice output differs from Word | Accept PDF from LibreOffice as the reference; check DOCX in Word during the pilot |
| Model calls are slow or costly on long PDDs | Clarify and interrogate per section; reuse the ACC cost ledger |
| P0 load is heavy (59 of 74) | Accepted by the Principal on 12 October 2026 (OD-IMP-07, decided) |

# PART 7 — Summary of Sources

*Owning SPC: KLARITY*

| Ref | Source | Used for | How it was read |
| --- | --- | --- | --- |
| S-01 | KAMBRIA PDD v1.1 (JNGL-PDD-KAMBRIA-2026-001) | ATLAS 360 PLAN 12-Part layout, claim tags, KLARITY and SKRIBE roles, GRO states | Read in full in this session |
| S-02 | ATANDA COMMAND DECK MAX PDD v1.0 | F0–F11 stage names and artifacts per stage, MAX priority palette, trace event contract | Project search excerpts |
| S-03 | ATANDA Command Centre MVP-PDD (SPARTAN) | Harness engines F1–F8 and their outputs | Project search excerpts |
| S-04 | SPC PLAYER Omnibus v4.0 | KLARITY-003 three-axis scoring; Pre-Build status | Project search excerpts |
| S-05 | SKRIBE SPC | Document phases, five-dimension score, gates 38/43/47 | Project search excerpts |
| S-06 | Junglenomics SPC Platform Registry v1.0 | SOCRATES, KLARITY, SKRIBE expansions and seats | Project search excerpts |
| S-07 | BUGMXT SI SPC v1.0 | SOCRATES's interrogation method (logic and assumption questioning) | Project search excerpts |
| S-08 | ATLAS ULTRA SI SPC and ARK PDD (Mode 4 Living PDD) | Living PDD as reverse-translation of deployed code | Project search excerpts |
| S-09 | Project memory: overview, ways of working, principles | Brand palette, typography, DOCX toolchain, Honesty Gate, SEC REP ONE findings | Stored memory, not re-verified |
| S-10 | The request (12 October 2026) | Engine team, artifact types, button, naming convention | Read |

**Not read in this pass:** the ADA ULTRA SI card itself, the KLARITY SI card itself and the SPC Player's saved-output schema. Their roles here rest on the registry and on how other PDDs use them.

**Claim tags.** [INT]† internal self-claim. [SPEC] specified, not built or measured. [EXT-K] external standard named from the drafting model's knowledge, not re-read in this pass. [SYNTH] computed in this pass (Part 5 counts, waves and inheritance).

# PART 8 — Definition of Terms

*Owning SPC: KLARITY*

| Term | Meaning |
| --- | --- |
| IMPRIMA | The document design, creation and publication engine specified here (working name) |
| PUBLISH DOCUMENT | The button that starts a publish job from an F-stage or the SPC Player |
| Publish job | One request to publish one saved artifact version in one or more formats |
| Canonical Document Model (CDM) | The single structure every artifact is converted into before design and rendering |
| Adapter | The code that converts one artifact type into the CDM |
| Protected span | Content the clarity pass may not change: IDs, numbers, scores, code, quotes, worksheet prompts, URLs |
| Five-token name | Title · Date-Time · Project · Author · Format, joined by double underscores |
| Draft | A watermarked document published without approval, for internal review |
| Final | A document published after a named human approval |
| Publication Review Note | SOCRATES's flags, questions and verdict for one job |
| HOLD | SOCRATES's verdict that blocks a Final publish until a human acts |
| Design score | SKRIBE's 0–50 rating of the rendered layout |
| Content hash | A fingerprint of the document text, shared by all formats of one job |
| Living PDD snapshot | A dated, versioned copy of a Living PDD at the moment of publishing |
| Wave | A build step; every prompt sits one wave after its latest dependency |
| Priority inheritance | Raising a dependency's priority to match the prompt that needs it |

# PART 9 — IP Pre-Registration Screening

*Owning SPC: SKRIBE*

**Status: screening plan only. No trademark, copyright or domain search was performed. Nothing here is clearance or legal advice.**

| Mark | Known concern | Search plan |
| --- | --- | --- |
| IMPRIMA | Derived from the Latin "imprimatur" and close to everyday words for printing in several languages; likely to be in use by printers, publishers and software [EXT-K] | USPTO, EUIPO and WIPO in software and publishing classes; domain and app-store checks. Keep internal until cleared |
| PUBLISH DOCUMENT | Generic button label | Not a mark; use descriptively |

**Gate.** The name is confirmed (OD-IMP-01, decided). Screening is only needed if IMPRIMA is ever named outside the ACC.

# PART 10 — Security & Governance Control Domains

*Owning SPCs: ADA + SOCRATES*

**Status.** Every control is designed; none is implemented or tested. In the Conformity Status Model every row is at Mapped.

| # | Domain | Controls designed | Prompts | State |
| --- | --- | --- | --- | --- |
| 1 | Identity and access | Staff-only access; row-level security by organisation and project; named approver | IMP-GOV-006, IMP-UIX-006 | Mapped |
| 2 | Data protection | Private default; encryption at rest; expiring signed links; confidentiality marking | IMP-PUB-003, 004; IMP-GOV-005 | Mapped |
| 3 | Application security | Snapshot of saved versions; fail-closed adapters; validated output | IMP-SRC-003, IMP-RND-005 | Mapped |
| 4 | Secrets and personal data | Pre-render scan; CONTAINMENT hold | IMP-GOV-004, 003 | Mapped |
| 5 | AI safety and decision integrity | Delimited model input with no tools; protected spans; SOCRATES verdict; human approval | IMP-GOV-007, IMP-KLR-002, IMP-SOC-005, IMP-GOV-001 | Mapped |
| 6 | Content integrity | Content hash across formats; immutable versions | IMP-RND-004, IMP-PUB-005 | Mapped |
| 7 | Attribution integrity | Human author only; AI team disclosed | IMP-NAM-005, IMP-SKR-007 | Mapped |
| 8 | Logging and audit | Audit event per state change; trace event to COMMAND DECK MAX | IMP-GOV-002, IMP-PUB-007 | Mapped |
| 9 | Accessibility | WCAG 2.2 AA pass | IMP-RND-006 | Mapped |

# PART 11 — Regulatory Conformity Mapping

*Owning SPC: SOCRATES*

**Basis.** as_of 12 October 2026 (knowledge basis; no live check of any framework text). Re-verify within 90 days, by 10 January 2027. Hypothesis only: not legal advice.

## 11.1 Conformity Status Model

| State | Meaning | Who can set it | Rows here |
| --- | --- | --- | --- |
| Unmapped | Framework identified; no mapping done | Any SPC | 0 |
| Mapped | Controls mapped to prompts; no evidence attached | Drafting model | 8 |
| Self-Attested | Author asserts the control is met | Author | 0 |
| Evidence-Backed | Claims bound to implementation evidence | Independent Assessor | 0 |
| Independently Audited | Tested by an external auditor | External auditor | 0 |
| Certified by Accredited Body | Formal certificate | Accredited body | 0 |

## 11.2 External frameworks [EXT-K]

| Framework | Why it may apply (hypothesis) | Prompts | State |
| --- | --- | --- | --- |
| WCAG 2.2 | Accessibility of HTML and PDF output | IMP-RND-006 | Mapped |
| PDF/UA (ISO 14289) | Accessible tagged PDF; alignment target only | IMP-RND-002, 006 | Mapped |
| GDPR and UK GDPR | Author and approver names are personal data; personal data inside artifacts | IMP-GOV-004, IMP-PUB-003 | Mapped |
| US state privacy laws (for example CCPA/CPRA) | As above for US staff and clients | IMP-GOV-004 | Mapped |
| EU AI Act transparency duties (Article 50) | AI-generated text distributed to others | IMP-SKR-007 | Mapped |
| Copyright law | Quotes and figures carried from source artifacts | IMP-KLR-002 | Mapped |
| ISO/IEC 42001 | AI management system; alignment language only | IMP-GOV-002, 003 | Mapped |
| NIST AI RMF 1.0 | Govern, map, measure, manage; alignment language only | IMP-GOV-001, IMP-SOC-005 | Mapped |

## 11.3 Internal Junglenomics frameworks

| Identifier | Name | How IMPRIMA uses it |
| --- | --- | --- |
| JNGL-DS-4830:2026 | ATLAS PDD Standard Document Format | 12-Part template and title block |
| JNGL-SM-4810:2026 | JCSE Scoring Methodology | Shown only as the artifact states it; never computed by IMPRIMA |
| — | Honesty Gate G3 | SOCRATES's check on every document |
| — | KLARITY-003 Three-Axis Scoring | Separate Clarity, Truthfulness and Detectability figures |
| — | GRO states | Part 4.11 |

## 11.4 Summary

8 external rows: 8 Mapped, 0 Self-Attested, 0 Evidence-Backed, 0 Independently Audited, 0 Certified. The words "compliant", "certified" and "conformant" are not used here for any regulatory claim.

# APPENDIX A — Open Decision Register

| ID | Decision | Owner | Needed by | Blocks |
| --- | --- | --- | --- | --- |
| OD-IMP-01 | **Decided 12 Oct 2026:** the name is IMPRIMA. Screen it only if used outside the ACC | Principal | Before R1 | Branding |
| OD-IMP-02 | **Decided 12 Oct 2026:** "FO business services" means F0 | Principal | Before R2 | IMP-SRC-010 |
| OD-IMP-03 | **Decided 12 Oct 2026:** the Format token stays | Principal | Before R0 exit | IMP-NAM-001 |
| OD-IMP-04 | Default formats in the dialog (proposed: DOCX and PDF) | Principal | Before R1 | IMP-UIX-003 |
| OD-IMP-05 | Who may approve Final documents (Principal only, or named staff) | Principal | Before R1 | IMP-GOV-001 |
| OD-IMP-06 | Production ID scheme for documents without one (proposed JNGL-DOC-&lt;TYPE&gt;-&lt;YEAR&gt;-&lt;NNN&gt;) | Principal | Before R1 | IMP-PUB-002 |
| OD-IMP-07 | **Decided 12 Oct 2026:** the P0 load is accepted; no scope cut | Principal | Before R1 build | Part 6 |
| OD-IMP-08 | Whether IMPRIMA is ever offered to SPHINX Marketplace creators | Principal | After R2 | Part 2 |
| OD-IMP-09 | Time zone for the Date-Time token: the publisher's own or one house zone | Principal | Before R0 exit | IMP-NAM-003 |
| OD-IMP-10 | Whether F1 and F2 should show the button | Principal | Before R2 | IMP-UIX-001 |

# APPENDIX B — Honesty Gate G3 Disclosure

| Claim | Status |
| --- | --- |
| "IMPRIMA exists or has been tested" | NOT claimed. It is specified, not built |
| "IMPRIMA holds any certification, audit or independent review" | NOT claimed. Tier 0; JCSE not asserted |
| "IMPRIMA complies with any law or standard" | NOT claimed. Mapping only (Part 11) |
| "The clarity pass never changes meaning" | NOT claimed as a result. It is a design rule with a test (IMP-QAL-004) |
| "The name is clear to use" | NOT claimed. Part 9 is a plan; no search performed |
| "CORDON was run as software" | NOT claimed. Applied as a procedure and checked by script |
| "Prompt counts, waves and inheritance are correct" | Claimed and checked by script in this pass [SYNTH] |
| "Every prompt is atomic" | PARTIAL. Structure is scripted; atomicity is a reading judgment |
| "External standards are described accurately" | NOT claimed. [EXT-K]; re-verify before build |
| "SPC card scores are accurate" | NOT claimed. They are the cards' own [INT]† statements and are not repeated |

# APPENDIX C — Version History

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 12 October 2026 | First draft. 12 Parts, 74 atomic prompts, 115 dependencies, 9 waves |
| 1.1 | 12 October 2026 | Principal's rulings recorded: name IMPRIMA confirmed, F0 confirmed, Format token kept, P0 load accepted. Open decisions 01, 02, 03 and 07 closed. Prompts, dependencies and waves unchanged |

---

*IMPRIMA Upgrade PDD v1.1 · JNGL-PDD-IMPRIMA-2026-001 · ATLAS 360 PLAN · Tier 0 · © 2026 OLUSEYE AMUSA. All rights reserved.*
