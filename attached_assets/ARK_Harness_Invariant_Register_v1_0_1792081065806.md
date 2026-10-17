# ARK Harness Invariant Register

13 October 2026 · OLUSEYE AMUSA

## About this register

This register lists every invariant stated for the ARK Harness (FORGE.BONSAI) up to 13 October 2026 — the rules that hold on every run, whatever the project, stage or user asks. It gathers them from the platform Omnibus PDDs, the stage-engine SPCs, and the add-on PDDs written since September, and gives each one a single register ID so the same words cannot mean different rules in different documents.

| Layer | What it covers | Located | Not located |
| --- | --- | --- | --- |
| **1 — SPARTAN platform invariants** | The numbered, platform-wide list (#1–#23) carried in the Omnibus PDDs | 19 | 4 (#17–#20) |
| **2 — Stage and engine invariants** | Non-negotiable rules inside one stage engine: CELL (F3–F4), SPARTAN MVE (F5-Savant), ATLAS Compression and SPARTAN (F7), MECHA (F9) | 48 | — |
| **3 — Add-on PDD invariants** | Command Deck MAX, XVL, VTE, the Harness Upgrade and SHORT SPRINTS | 42 | — |
| **4 — Products built on the Harness** | IMPRIMA (F0 publishing service) and KAMBRIA (newsletter producer) | 16 | — |
| **Total** |  | **125** | **4** |

### How to read it

- **Register ID.** Layer prefix plus a number: SP (SPARTAN), CELL, MVE, ACM (ATLAS Compression), SPC7 (SPARTAN classification), MECHA, CD, XVL, VTE, UPG, SS, IMP, KMB. Several documents each have their own "INV-01"; the register ID removes that ambiguity. The source's own ID is kept beside it.
- **Applies at.** The F-stages where the rule bites. "All" means every stage and every route, including the SHORT SPRINTS circuits.
- **Status.** Every row is **Specified** (Tier 0): written in a PDD or SPC. This register does not claim any rule is enforced in running code. A rule moves to *Enforced* only when a test shows it holding, recorded in XVL.
- **Wording.** Rules are quoted or closely paraphrased from their source. Where a source is excerpted rather than read in full, the row says so.

Nothing in this register is new policy. The Conflicts section lists the conflicts and gaps found while compiling it, each with a proposed ruling for the Principal.

## Layer 1 — SPARTAN platform invariants

The numbered list that every ARK Harness Omnibus carries forward. #1–#15 are quoted from the v9.1 PDD (SPEC BUILDER, JNGL-ARKH-PDD-2026-010); #16 from the v9.2 D29 add-on (JNGL-ARKH-PDD-2026-011); #21–#23 from OMNIBUS ALPHA v2.0 (JNGL-ARKH-OMNIBUS-ALPHA-2026-002), which states a total of 23.

| Reg ID | # | Name | Rule | Applies at | Since |
| --- | --- | --- | --- | --- | --- |
| SP-01 | 1 | GRO SAFE\_LIFE | assertGRO() runs before every LLM call and on all LLM output. Non-compressible | All | ≤ v9.0 |
| SP-02 | 2 | Score-Sync Single Writer | applyScoreSync() is the only writer to users.arkScore; direct database writes are prohibited | School (D1–D3) | ≤ v9.0 |
| SP-03 | 3 | Atomic Prompt Standard | Every prompt performs exactly one logical operation; no "and also" clauses | F2 onward | ≤ v9.0 |
| SP-04 | 4 | SPHINX 70/30 Split | The creator always receives 70% of atomic credit; the rate cannot change without FORGE re-certification | SPHINX marketplace | ≤ v9.0 |
| SP-05 | 5 | JCSE 45+ for Certification | PDDs scoring below 45/50 are returned for remediation | F7 | ≤ v9.0 |
| SP-06 | 6 | ZPOS Semantic Floor | Compression keeps at least 97.5% semantic preservation; over-compression triggers the PRISM fallback | F7 | ≤ v9.0 |
| SP-07 | 7 | Entitlement Enforcement | Tier gates are enforced server-side on req.localUser; client-side state is advisory only | All | ≤ v9.0 |
| SP-08 | 8 | Telemetry Integrity | All platform events are emitted to the telemetry streams (written as A–D); no domain may suppress telemetry | All | ≤ v9.0 |
| SP-09 | 9 | GRO Never Compresses | groConstraints are hard-coded as GRO SAFE\_LIFE; SAVANT never compresses GRO | F5-Savant, F7 | ≤ v9.0 |
| SP-10 | 10 | EMBEDDED\_DISCLAIMER | A non-suppressible disclaimer on all F9 outputs, MAP economic projections and MDL Score outputs | F0.5, F9 | ≤ v9.0, extended v9.0 |
| SP-11 | 11 | Full Spectrum Guarantee | The FORGE pipeline (written as F0–F9) is always available to the ARCHITECT tier without feature removal | All | ≤ v9.0 |
| SP-12 | 12 | FTZ Covenant | The SPHINX obligation is complete at USDC credit; Single Value Parity is enforced globally | SPHINX Trade Zone | ≤ v9.0 |
| SP-13 | 13 | FORGE VERIFIED MAX Integrity | msdQuality is always sourced from F0.5 Native Engine session data | F0.5, F7 | v9.0 |
| SP-14 | 14 | MDL Disclosure | Every MDL Score output carries "Approximate Kolmogorov complexity — not exact." Non-suppressible | F0.5 onward | v9.0 |
| SP-15 | 15 | Spec-First | An interface contract (OpenAPI, DDL, Protobuf or TypeSpec) is produced before implementation code for any software artifact; code-first requests return to F1. Non-suppressible | F1, F8 | v9.1 |
| SP-16 | 16 | Outcome-Grounding | No F0 source classification may be marketed as predictive without an attached empirical precision, recall or lead-time citation; outputs carry a confidence flag (EMPIRICALLY\_CALIBRATED, PROVISIONAL or THEORY\_ONLY). Non-suppressible | F0 | v9.2 † |
| SP-17 | 17 | *Not located* | — | — | ≤ OMNIBUS ALPHA v1.0 |
| SP-18 | 18 | *Not located* | — | — | ≤ OMNIBUS ALPHA v1.0 |
| SP-19 | 19 | *Not located* | — | — | ≤ OMNIBUS ALPHA v1.0 |
| SP-20 | 20 | *Not located* | — | — | ≤ OMNIBUS ALPHA v1.0 |
| SP-21 | 21 | Synthesis Non-Manipulation | F5-Synth ranks marketplace SPCs by unbiased capability match only; sponsorship may reorder display, never the match itself | F5-Synth | OMNIBUS ALPHA v2.0 |
| SP-22 | 22 | Portability Fidelity Floor | SAVANT verdicts are binary and evidence-based: FIT (≥ 88% fidelity) or CLUSTER (a governed Agentic Cluster); no partial-fit or degraded state may be reported | F5-Savant | OMNIBUS ALPHA v2.0 |
| SP-23 | 23 | Field-Provenance Discipline | Every field in a platform-generated user artifact traces to explicit user entry or a verified platform record, with the source shown; no field is auto-filled with an unverified claim | All user-facing exports (first: Living Resume, D17) | OMNIBUS ALPHA v2.0 |

† SP-16 is taken from the v9.2 add-on as quoted in a 1 July 2026 working session; the add-on file itself is not in the project folder. Other sessions used "Invariant #16" to mean the Honesty Gate (G3). See the Conflicts section.

**#17–#20.** OMNIBUS ALPHA v2.0 says #1–#20 "carry forward from v1.0 unchanged", but neither v1.0 nor the v10.x PDDs that likely added #17–#20 are in the project folder, and a search of past sessions did not recover their text. They are listed as gaps, not reconstructed.

## Layer 2 — Stage and engine invariants

Rules that hold inside one stage engine. They are written in the engine's own SPC or feature spec, as laws, hard constraints or "never compress" lists.

### CELL — Molecular Agents (F3–F4)

Source: CELL SI SPC v1.0, §5.2 Three Laws and §9.1 Hard Constraints.

| Reg ID | Source ID | Rule | On breach |
| --- | --- | --- | --- |
| CELL-01 | Law I | A CELL produces exactly one MA per session: one task, one tool, one output | — |
| CELL-02 | Law II | A CELL never produces an SPC; work that needs SPC architecture is handed to the FORGE pipeline | Reclassify |
| CELL-03 | Law III | A CELL delivers a complete package: Classification Report, 3-document Micro PDD and Interface Contract | — |
| CELL-04 | C-001 | Never more than 3 Atomic Prompts per MA | Escalate; halt delivery |
| CELL-05 | C-002 | Never a \[ROLE\] pillar in any MA Atomic Prompt | Revision required |
| CELL-06 | C-003 | Never a DISC profile, Camelot Seat or personality on an MA | Revision required |
| CELL-07 | C-004 | Never more than 1 primary tool interaction per MA | Escalate: a multi-tool agent is a task |
| CELL-08 | C-005 | Never production-ready if the ARES stress test fails | Hold until all 3 attack vectors pass |
| CELL-09 | C-006 | Never a partial BIRTH PACKAGE | Incomplete; session continues |
| CELL-10 | C-007 | Never an MA for any function that violates GRO LOVE/HARM | KILLZONE: refuse, log, alert |

### SPARTAN MVE — Portability (F5-Savant)

Source: SPARTAN MVE SPC v1.0, §5.2 Three Laws and §11.1 Hard Constraints.

| Reg ID | Source ID | Rule | On breach |
| --- | --- | --- | --- |
| MVE-01 | Law I | Never guesses: every constraint finding comes from the MVE registry or a live scan | — |
| MVE-02 | Law II | Never deploys a partial SPC: FIT (≥ 88%) or CLUSTER, nothing between | — |
| MVE-03 | Law III | Never builds an ungoverned cluster: every MA inherits the source SPC's GRO constraints | — |
| MVE-04 | C-001 | No FIT verdict below 88% fidelity | Revision required |
| MVE-05 | C-002 | No cluster with fewer than 3 MAs | Escalate |
| MVE-06 | C-003 | No cluster with more than 12 MAs | Escalate to the FORGE SPC pipeline |
| MVE-07 | C-004 | No MA in a cluster carries a \[ROLE\] pillar | KILLZONE |
| MVE-08 | C-005 | Every cluster has exactly one GRO Propagation Authority MA | Revision |
| MVE-09 | C-006 | A GRO Distribution Map is in every portability kit | Incomplete |
| MVE-10 | C-007 | HIVE fidelity below 88% blocks delivery | Hold |
| MVE-11 | C-008 | Never alters the SPC's GRO Protocol during portability | KILLZONE |
| MVE-12 | C-009 | Never a partial SAVANT Report | Incomplete |
| MVE-13 | C-010 | Interface contracts use structured JSON schemas, never raw text | Revision required |

### ATLAS Compression and SPARTAN — MVP compression (F7)

Sources: ATLAS Compression Feature Spec v1.0 (§6.1 and §5.2), excerpted; SPARTAN SPC v1.0 §7.2.

| Reg ID | Source ID | Rule |
| --- | --- | --- |
| ACM-01 | §6.1 | All user-facing features survive compression |
| ACM-02 | §6.1 | The IQS scoring algorithm is never compressed |
| ACM-03 | §6.1 | The GRO ethics audit is never compressed |
| ACM-04 | §6.1 | ZPOS+5 compression is kept |
| ACM-05 | §6.1 | The FORGE certification structure is kept |
| ACM-06 | §6.1 | Subscriber tier enforcement is kept |
| ACM-07 | §6.1 | Authentication and session security are kept |
| ACM-08 | §6.1 | The upgrade path documentation is kept |
| ACM-09 | §6.1 | The FORGE production ID format is kept |
| ACM-10 | Hard Rule 1 | No user-facing feature may be CLASS C; if no CLASS B equivalent exists, change the platform, not the class |
| ACM-11 | Hard Rule 2 | Infrastructure that serves only scale that does not yet exist is CLASS C |
| ACM-12 | Hard Rule 3 | Every CLASS C deferral has a specific, measurable trigger |
| ACM-13 | Hard Rule 4 | The MVP schema is forward-compatible: add fields, never rename or remove them |
| ACM-14 | Hard Rule 5 | An MVP PDD that needs more than one person, or DevOps skills beyond a senior developer, is not compressed enough |
| SPC7-01 | §7.2 | User authentication flows are always CLASS A |
| SPC7-02 | §7.2 | The primary data store is always CLASS A |
| SPC7-03 | §7.2 | All user-visible UI components are always CLASS A |
| SPC7-04 | §7.2 | Error handling for user-facing operations is always CLASS A |
| SPC7-05 | §7.2 | Core business logic is always CLASS A |
| SPC7-06 | §7.2 | JCSE quality scoring in PDD outputs is always CLASS A |
| SPC7-07 | §7.2 | GRO state machine references are always CLASS A |
| SPC7-08 | §7.2 | ZPOS+5 optimisation of output content is always CLASS A |
| SPC7-09 | §7.2 | The FORGE Certification Block is always CLASS A |
| SPC7-10 | §7.2 | The Upgrade Path Document is always CLASS A |

The §6.1 list was read from search excerpts; it may hold one or two rows not captured here.

### MECHA — Machine Floor (F9)

| Reg ID | Rule | Source |
| --- | --- | --- |
| MECHA-01 | F9 is fail-closed: a build without the required evidence does not pass, and physical or firmware work needs external evidence before it moves on | ATLAS 360 SCAN of the ARK Harness (23 Sep 2026), as carried into the XVL PDD stage map |

F0.5 MATHMON and F1 SPEC BUILDER have no separate invariant lists; their platform rules are SP-13, SP-14 and SP-15.

## Layer 3 — Add-on PDD invariants

The five add-ons written since the start of October 2026. Each keeps its own local IDs; the register prefixes them.

### Command Deck MAX — telemetry and training data

Source: COMMAND DECK MAX PDD v1.0 (JNGL-PDD-CMDDECKMAX-2026-001), §1.9. Applies wherever trace events are written: all stages.

| Reg ID | Local | Rule |
| --- | --- | --- |
| CD-01 | 1 | No stage handler waits for telemetry, and no telemetry failure reaches a user |
| CD-02 | 2 | A trace event never carries a prompt body, email or name; only identifiers and hashes |
| CD-03 | 3 | Consent is OFF until a scope says otherwise; a confidential artifact is never captured |
| CD-04 | 4 | No record is written without passing the consent check and the ethics gate in the same transaction |
| CD-05 | 5 | Every record states where its rejected output came from (observed, template or none) |
| CD-06 | 6 | Nothing estimated is presented as measured; unmeasured values are NULL or UNMEASURED |
| CD-07 | 7 | Governance events with no verified FM mapping stay UNMAPPED; no code is forced |
| CD-08 | 8 | FM-23 is assigned by the gate only |
| CD-09 | 9 | No dataset version is published without a dry run and a named human approval |
| CD-10 | 10 | Withdrawal produces a new version and discloses that earlier public versions cannot be recalled |
| CD-11 | 11 | No price, SKU, cash or tier logic in the Deck; virality never appears as value |
| CD-12 | 12 | Every GP(t) figure is labelled a design target pending Study C1 |
| CD-13 | 13 | The Deck's self-claims of certification, scores and tiers are never repeated as facts |

### XVL — External Verification Layer

Source: FORGE.BONSAI External Verification Layer PDD v1.1, §1.5 and §1.10. Applies at every stage where a track runs.

| Reg ID | Local | Rule |
| --- | --- | --- |
| XVL-01 | INV-01 | No stage grades its own work; self-attested results are recorded but never count as external evidence |
| XVL-02 | INV-02 | Inconclusive is not a pass: errors, timeouts and missing evidence never produce PASS |
| XVL-03 | INV-03 | Floors only go up: users add tracks above the F0 floor; only the named Principal lowers it, with a logged reason |
| XVL-04 | INV-04 | No evidence, no verdict: a verdict without an evidence hash is rejected |
| XVL-05 | INV-05 | Scores stay separate: track verdicts are never folded into one composite, and JCSE stays labelled self-assigned |
| XVL-06 | INV-06 | No content leaves custody to an external track beyond the consent level its owner set |
| XVL-07 | INV-07 | Labels are earned: Evidence-Backed needs a pass at I1 or higher; Independently Audited needs I3 by an outside auditor |
| XVL-08 | INV-08 | Verify the premise first: no stage builds on a scientific or clinical claim whose integrity check is missing or Refuted (F0.5 onward) |
| XVL-09 | INV-09 | AI judges do not certify science: Track J may comment on scientific validity but never passes it; that takes Track H |

### VTE — Verification Telemetry Engine

Source: VTE PDD v1.0, §1.5.

| Reg ID | Local | Rule |
| --- | --- | --- |
| VTE-01 | INV-01 | A Stream E triplet needs a FAIL and a later PASS on the same case, both at I1 or higher; self-attested results never make a triplet |
| VTE-02 | INV-02 | Stream E rejected outputs are always OBSERVED; TEMPLATE is not allowed |
| VTE-03 | INV-03 | Held-out cases are used only to measure; they never enter training data or exports |
| VTE-04 | INV-04 | No self-modification: VTE proposes, a named person approves, nothing in the Harness changes automatically |
| VTE-05 | INV-05 | Carries CD-03, CD-04, CD-08 and CD-09 into Stream E (consent OFF, one-transaction gate, FM-23 by the gate, no export without dry run and approval) |
| VTE-06 | INV-06 | No improvement claims unless held-out results show it, labelled with the sample size |

### ARK Harness Upgrade — readiness, release and Operate

Source: ARK Harness Upgrade PDD v1.0 (JNGL-ARKH-PDD-RDY-2026-001), §1.5.

| Reg ID | Local | Rule | Applies at |
| --- | --- | --- | --- |
| UPG-01 | INV-01 | Required approvals are reported as governance touches, never as failed autonomy | All |
| UPG-02 | INV-02 | Readiness levels are earned per pillar; one strong pillar never offsets a weak one | Track A |
| UPG-03 | INV-03 | Readiness is a leading indicator only, always shown beside outcome metrics, never alone | Track A, Command Deck |
| UPG-04 | INV-04 | An F12 incident is recorded as an I2 failure; no stage marks its own incident resolved | F12 |
| UPG-05 | INV-05 | On a failed release check, roll back first; fix through the F-process | F10, F12 |
| UPG-06 | INV-06 | No self-hosted or air-gapped offering ships with an open SEC REP ONE critical finding | F10, F11 |
| UPG-07 | INV-07 | Carries XVL-01, CD-03, CD-09 and VTE-04 | All |

### SHORT SPRINTS — short circuits

Source: SHORT SPRINTS PDD v1.1 (JNGL-ARKH-PDD-SS-2026-001), Part 1.

| Reg ID | Local | Rule | Applies at |
| --- | --- | --- | --- |
| SS-01 | SS-INV-01 | No product reaches F10 without a passing verification pack for its circuit | SC gates → F10 |
| SS-02 | SS-INV-02 | Only a named human answers the SC question; the Harness never answers Yes for the owner | After F4, after F5 |
| SS-03 | SS-INV-03 | Any product that runs on a physical device passes F9 MECHA, with external evidence, before F9.5 and F10 | F9 |
| SS-04 | SS-INV-04 | F9.5 and F10–F12 are never skipped; every route ends with custody, staged release, handoff and Operate | F9.5–F12 |
| SS-05 | SS-INV-05 | Every skipped stage is in the trace as SKIPPED\_BY\_SC; certificates name the circuit | All |
| SS-06 | SS-INV-06 | A short-route product is never shown as having passed stages it skipped | Certificates |
| SS-07 | SS-INV-07 | The XVL profile floor set at F0 still applies; a circuit can add checks but never drop below it | SC packs |

## Layer 4 — Products built on the Harness

Two products that run on the Harness carry their own invariants. They bind those products, not the F-process itself, and are listed so their rules are not mistaken for platform rules.

### IMPRIMA — F0 publishing service

Source: IMPRIMA Upgrade PDD v1.1, §1.8.

| Reg ID | Local | Rule |
| --- | --- | --- |
| IMP-01 | INV-01 | Five tokens in fixed order (Title · Date-Time · Project · Author · Format) in every filename and in the document's metadata |
| IMP-02 | INV-02 | A human is the author; no SPC, agent or model is named as author, and the AI team is disclosed inside |
| IMP-03 | INV-03 | Clarity never changes meaning; protected spans are never edited |
| IMP-04 | INV-04 | No document says built, certified, compliant or audited without evidence |
| IMP-05 | INV-05 | SOCRATES flags but never edits; KLARITY edits but never approves; SKRIBE scores layout, not truth |
| IMP-06 | INV-06 | KLARITY's three figures and SKRIBE's design score are never merged |
| IMP-07 | INV-07 | Published means immutable; a re-publish is a new version |
| IMP-08 | INV-08 | No Final document is released without a named approval |

### KAMBRIA — newsletter producer

Source: KAMBRIA PDD v1.1, §1.8.

| Reg ID | Local | Rule |
| --- | --- | --- |
| KMB-01 | INV-01 | The curator is never listed as an author of cited research |
| KMB-02 | INV-02 | No factual sentence ships without a Cited Works Ledger row |
| KMB-03 | INV-03 | Unpublished, confidential and patent-pending work is described at outcome level only |
| KMB-04 | INV-04 | Predictions, hypotheses, rankings and prize forecasts are labelled as opinion or inference |
| KMB-05 | INV-05 | Humour never rests on a false premise and never targets authors, patients or groups |
| KMB-06 | INV-06 | No creator is introduced to another without both accepting |
| KMB-07 | INV-07 | No issue is released without a named human editor's approval |
| KMB-08 | INV-08 | Clarity, Truthfulness and Detectability are never collapsed into one number |

## Conflicts, overlaps and gaps

Found while compiling. Each has a proposed ruling; none is applied until the Principal decides (Open decisions, below).

### Conflicts and gaps

| # | Finding | Rows | Proposed ruling |
| --- | --- | --- | --- |
| IR-C1 | **#17–#20 are missing.** OMNIBUS ALPHA v2.0 counts 23 SPARTAN invariants but only #1–#16 and #21–#23 have recoverable text | SP-17 to SP-20 | Recover v1.0 or the v10.x PDDs and fill the four rows; until then, nothing may cite #17–#20 |
| IR-C2 | **#16 means two things.** The v9.2 add-on defines #16 as Outcome-Grounding; several later sessions used "Invariant #16" for the Honesty Gate (G3). An earlier session also noted a numbering collision above #15 | SP-16 | Keep #16 as Outcome-Grounding (it has a dated source). Give the Honesty Gate its own number when IR-C1 is closed |
| IR-C3 | **Stage ranges are stale.** SP-08 names streams A–D, but VTE added Stream E; SP-11 guarantees "F0–F9", but the Harness now runs to F12 | SP-08, SP-11 | Reword: "all telemetry streams" and "the full F-process (currently F0–F12)" |
| IR-C4 | **A self-score gates certification.** SP-05 returns PDDs below JCSE 45, but XVL-05 and CD-13 treat JCSE as a self-assigned score that is not evidence | SP-05, XVL-05, CD-13 | Keep SP-05 as an internal floor, but no certificate may rest on JCSE alone: pair it with an XVL conformity state |
| IR-C5 | **Binary portability versus a five-state ladder.** SP-22 and MVE-02 forbid any partial verdict; the SPARTAN SEXTANT draft (D31, July 2026) proposed a five-state verdict ladder | SP-22, MVE-02 | Either drop the ladder or show its middle states as advisory notes on a FIT or CLUSTER verdict, never as verdicts |
| IR-C6 | **SHORT SPRINTS cites the wrong CELL IDs.** It names "MA-001" (3 prompts) and "MA-002" (90 minutes). The CELL SPC numbers these C-001 and C-004 (1 tool), and the 90-minute figure is a success target (≥ 95% of MAs built in 90 minutes), not a hard rule | CELL-04, CELL-07, SS eligibility | Correct the citations in SHORT SPRINTS. Decide whether 90 minutes becomes a hard eligibility rule or stays a target |
| IR-C7 | **Seven pillars versus no Role.** The Standalone Agent Spec Sheet says prompts are certified "across the 7 Context Craft pillars", but MA prompts must exclude \[ROLE\] | CELL-05, MVE-07 | State that MA prompts are certified on six pillars, with Role absent by design |
| IR-C8 | **Same local ID, different rules.** "INV-01" means five different rules across XVL, VTE, the Upgrade, IMPRIMA and KAMBRIA | Layer 3–4 | Cite invariants by register ID from now on |
| IR-C9 | **A gate reads backwards.** ATLAS Compression gate G4 calls a prompt-compression ratio below 50% "over-compressed", but a low ratio means little was removed | (gate, not an invariant) | Correct the wording in the ATLAS Compression spec |

### Overlaps — the same rule in several places

These are not conflicts, but each is a candidate for one platform-wide SPARTAN invariant, so add-ons can cite it instead of restating it.

| Theme | Where it appears | Candidate platform rule |
| --- | --- | --- |
| No self-grading | XVL-01, VTE-01, UPG-04, UPG-07 | No stage, seat or engine grades its own work |
| Named human approval | CD-09, VTE-04, SS-02, IMP-08, KMB-07 | Releases, exports and model changes need a named human approval |
| Scores stay separate | XVL-05, UPG-03, IMP-06, KMB-08 | No composite score hides its parts |
| Governance never compresses | SP-01, SP-09, ACM-03, SPC7-07, MVE-03, MVE-11 | (Already SP-09; others should cite it) |
| No unlabelled claims | SP-14, SP-16, CD-06, CD-13, VTE-06, IMP-04, KMB-04 | Nothing estimated, self-scored or unverified is presented as measured or certified |
| Consent and custody | CD-02, CD-03, XVL-06, KMB-03 | Content leaves custody only at the level its owner consented to |
| Complete or nothing | CELL-03, CELL-09, MVE-12 | (Engine-level; no platform rule needed) |

## Change control, open decisions and sources

### Change control

1. **Adding an invariant.** A PDD may state local invariants. A rule becomes a SPARTAN platform invariant only when the Principal approves it and the register assigns the next number. No number above #23 is issued until IR-C1 and IR-C2 are closed.
2. **Changing or retiring one.** The row is never deleted. It is marked *Superseded* or *Retired*, with the date, the reason and the replacing row.
3. **Citing one.** New documents cite the register ID (for example XVL-01 or SP-15), not a local "INV-nn".
4. **Proving one.** A row moves from *Specified* to *Enforced* only with a passing test recorded in XVL: an evalset case, a probe or an audit that shows the rule holding, at independence I1 or higher.
5. **Review.** The register is checked whenever an Omnibus or add-on PDD is issued, and after any SEC REP ONE reassessment.

### Open decisions

- [ ] OD-IR-01: Locate the source for SPARTAN #17–#20 (OMNIBUS ALPHA v1.0 or the v10.x PDDs) and add it to the project folder (IR-C1)
- [ ] OD-IR-02: Confirm #16 as Outcome-Grounding and number the Honesty Gate separately (IR-C2)
- [ ] OD-IR-03: Approve the rewording of SP-08 and SP-11 (IR-C3)
- [ ] OD-IR-04: Decide whether certification may rest on JCSE without an XVL conformity state (IR-C4)
- [ ] OD-IR-05: Rule on the SEXTANT five-state ladder against SP-22 (IR-C5)
- [ ] OD-IR-06: Correct the SHORT SPRINTS CELL citations and decide whether 90 minutes is a hard rule (IR-C6)
- [ ] OD-IR-07: Promote any of the six overlap themes to numbered SPARTAN invariants
- [ ] OD-IR-08: Decide whether Layer 4 product invariants belong in this register or in each product's own register

### Honesty notes

- Status for every row is Tier 0, Specified. This register does not verify that any rule is enforced in running code; the last security review of the Command Centre (SEC REP ONE) found open critical findings.
- SP-16 comes from a past working session's copy of the v9.2 add-on, not from a file in the project folder.
- The ATLAS Compression §6.1 list and the MECHA rule were read from excerpts and summaries, not full documents.
- SPHINX THREE PDD v3.0.0 refers to its own invariants (4 and 5) but its list was not read in this pass, so it is not included.

### Sources

| Source | Used for |
| --- | --- |
| ARK Harness v9.1 PDD — SPEC BUILDER (JNGL-ARKH-PDD-2026-010) | SP-01 to SP-15 |
| ARK Harness v9.0 PDD — MATHMON MAX (JNGL-ARKH-PDD-2026-009) | Cross-check of SP-01 to SP-14 |
| ARK Harness v9.2 D29 add-on (JNGL-ARKH-PDD-2026-011), as quoted in a 1 July 2026 session | SP-16 |
| ARK Harness OMNIBUS ALPHA v2.0 (JNGL-ARKH-OMNIBUS-ALPHA-2026-002) | SP-21 to SP-23; the count of 23 |
| CELL SI SPC v1.0 | CELL-01 to CELL-10 |
| SPARTAN MVE SPC v1.0 | MVE-01 to MVE-13 |
| ATLAS Compression Feature Spec v1.0 | ACM-01 to ACM-14 |
| SPARTAN SPC v1.0 | SPC7-01 to SPC7-10 |
| XVL PDD v1.1 (stage map from the ATLAS 360 SCAN, 23 Sep 2026) | MECHA-01; XVL-01 to XVL-09 |
| COMMAND DECK MAX PDD v1.0 | CD-01 to CD-13 |
| VTE PDD v1.0 | VTE-01 to VTE-06 |
| ARK Harness Upgrade PDD v1.0 | UPG-01 to UPG-07 |
| SHORT SPRINTS PDD v1.1 | SS-01 to SS-07 |
| IMPRIMA Upgrade PDD v1.1 | IMP-01 to IMP-08 |
| KAMBRIA PDD v1.1 | KMB-01 to KMB-08 |
