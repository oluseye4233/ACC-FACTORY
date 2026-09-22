# THE ARK HARNESS — F9 MACHINE FLOOR

## ATLAS Omnibus PDD · v2.1 · Domain 35

### Embedded MA Production for Switches & Functions · Operated by MECHA ULTRA SI

**JNGL-ARKH-F9MF-2026-003 · v2.1 · Supersedes v2.0 · Upgrades OMNIBUS ALPHA**

> *"v1.0 specified a floor with four co-leads and no operator. Every gate had an owner and the run had none. v2.0 does not add capability — it names who runs the engine, and makes running it the only way through."*
>
> *v2.1 corrects a defect found in verification: certification was scheduled before the code it certifies existed, and no coding standard or static analysis was enforced. Assurance now precedes certification.*

---

## DOCUMENT CONTROL

| Field | Value |
|---|---|
| Document | THE ARK HARNESS — F9 MACHINE FLOOR · ATLAS Omnibus PDD v2.1 |
| Reference | JNGL-ARKH-F9MF-2026-003 · v2.1 |
| Supersedes | JNGL-ARKH-F9MF-2026-002 (v2.0) — sequencing corrected, code assurance added. v1.0 (-001) remains in the lineage. |
| Upgrades | OMNIBUS ALPHA (34 domains · 128 IPs · 20 invariants) |
| Domain | **D35 — F9 Machine Floor (Embedded MA Production)** |
| IPs | **IP-129 – IP-150** (22; extended from 20 in v2.1 — see §1.6) |
| Invariants | **#21 Machine Floor Safety Lane** · **#22 Universal Certification Gate** · **#23 The Single Operator** · **#24 Assurance Precedes Certification** (new in v2.1) |
| Renames | `F9 Mathematical Validation` / `F9-V` → **MM Gate** (unchanged from v1.0) |
| Supersedes domain | D14 (F9 Firmware Branch, IP-25–31) — pointer retained |
| **Operating SPC** | **MECHA ULTRA SI** v1.2.0 · `SPC-MECHA-F9-ULTRA-SI-001` · Camelot Seat #16 · JCSE 44/50 Tier 0 |
| MECHA strands | CODE DJ 24% · BAHN 22% · ATHENA 20% · DEXTER 18% · FRACTAL 16% |
| External gates | CELL SI (#14) · MM/MATHMON (D26) · SAVANT (D13) · UCG · OSIRIS (D32) — none overridable by MECHA |
| Analysis tooling | Static analyzers wired per language through Analyzer Adapters — **none selected, none qualified** (§3.11) |
| Date | September 2026 · PRE-BUILD |
| Certification | Self-assigned, Tier 0 — **NOT HIVE-certified** |
| GRO State | SAFE_LIFE · LIFE structurally unavailable on actuating targets |
| Honesty Gate | G3 enforced — see §1.5, §3.6, §3.7 |
| Operator | Oluseye Shay Amusa / Koncentric Labs Inc. |

---

# PART 1 — CHEAT SHEET

*All stakeholders*

## 1.1 Atomic Solution Summary

**F9 MACHINE FLOOR** is a production floor inside the ARK HARNESS that turns certified cognitive specifications into **embedded control artifacts** — small, bounded, AI-native decision units that fit inside appliances, machines, and instruments. It opens the hardware-programming domain to non-firmware specialists by reusing the unit CELL SI already produces (the Molecular Agent), constraining it to two physical primitives — the **Switch** and the **Function** — and gating every output through mathematical validation, adversarial test, IP clearance, and a single platform-wide certification check.

**In v2.0 the floor has exactly one operator: MECHA ULTRA SI.** MECHA runs the twenty-two Integration Points in sequence, invokes the external gates, and emits either a certified Machine Artifact into OSIRIS custody or a cited refusal. It owns no gate it runs and can override no verdict it receives.

## 1.2 What v2.0 Changes

| # | Change | v1.0 | v2.0 |
|---|---|---|---|
| 1 | **Ownership** | Four co-leads (ATHENA / CELL / MM / ARES) with an explicit gap: *nobody owned the run* | **MECHA ULTRA SI is the sole operator.** The four become strands or external gates with defined boundaries. |
| 2 | **The ATHENA question** | ATHENA appointed Lead SPC with a disclosed Embodiment 4/10 mismatch, scoped by exception | ATHENA is a **20% strand** doing exactly what she is strong at — L3/L5/L7 discovery and L8 clearance. The mismatch disappears because the appointment was the error, not the card. |
| 3 | **Implementation competence** | Unowned. "Build" was an unattributed step. | **CODE DJ (24%)** supplies Platform Allocation across nine environments, the embedded/robotics language families, and the 7-phase PCE pipeline with fidelity validation. |
| 4 | **Run integrity** | Nothing prevented cherry-picking gates | **Invariant #23** — assembling the strands outside MECHA is not an F9 run and produces no certifiable artifact. |
| 5 | **IP range** | IP-129 – IP-144 (16) | **IP-129 – IP-148 (20)** — four operator-layer IPs added (§1.6) |
| 6 | **OI-01** | "No embedded-controls competence in any owner" | **Narrowed to control-theory only.** Implementation is now covered; control-law derivation, stability margins, scheduling analysis and safety-integrity architecture are not. |

**Unchanged from v1.0 and carried verbatim:** the MM Gate rename, the F9/F9.5 boundary, the Switch/Function primitives, the two lanes, the UCG thresholds, Invariants #21 and #22, and every regulatory disclosure in §3.6.

## 1.2A What v2.1 Changes

v2.1 is the result of verifying F9 against safe-coding and static-analysis practice. The verification found the following.

| # | Finding | State in v2.0 | Fix in v2.1 |
|---|---|---|---|
| 1 | **No coding standard** | Not specified anywhere in the F9 lineage | Coding Standard Profile per allocated language, pinned in a Guideline Enforcement Plan before generation (IP-149). C → MISRA C; C++ → MISRA C++:2023. **No profile, no allocation.** |
| 2 | **No embedded-grade static analysis** | The PCE scan is web-security oriented; BUGMXT's documented toolchains name no C/C++ analyzer; its logic audit is LLM-run | **Code Assurance Gate** (IP-149) through Analyzer Adapters. Default `STUB_REFUSE`: no analyzer, no pass. |
| 3 | **Ordering defect** | UCG certification (P6) ran *before* code generation (P7), yet the certificate required PCE fidelity ≥99% | P6 is now **BUILD & ASSURE**, P7 **CERTIFY & EMIT**. **Invariant #24.** |
| 4 | **No model-to-code equivalence** | MM verified the equations; nothing showed the generated code implements them | **Model-to-Code Equivalence Evidence** (IP-150): back-to-back run against the MM model, plus ARES fault injection re-run on the build in software-in-the-loop |
| 5 | **No compliance-claim rule** | Nothing governed a claim of coding-standard compliance | `misra_compliance_claimed` is false unless a named human who is not the generator has signed the Guideline Compliance Summary |
| 6 | **Fail-early** | L8 IP clearance ran after ARES, just before certification, so an IP block cost a full build | L8 moves to **P5**, ahead of the build |
| 7 | **Critical path misstated** | The path listed in v2.0 was not a valid dependency chain | Recomputed from the dependency graph (Part 4): fifteen prompts, self-test sixteenth |

Items 1, 2 and 4 are additions. Items 3, 6 and 7 are corrections of errors in v2.0, disclosed as such.

## 1.3 The Three Corrections v1.0 Made (retained)

| # | Correction | Result |
|---|---|---|
| 1 | **Name collision resolved** | **MM Gate** = the mathematical verdict. **F9** = the production floor. One name, one referent. D26/D27 unchanged. |
| 2 | **F9 / F9.5 boundary stated once** | **F9 terminates in an artifact. F9.5 terminates in a running process.** F9.5 (D32, OSIRIS) is unchanged. |
| 3 | **Certification unified** | **Universal JCSE Certification Gate (UCG)** — one 0–50 scale, tiered thresholds by artifact class, no exemptions. |

## 1.4 The Two Production Primitives

| Primitive | Definition | CELL Class | Execution |
|---|---|---|---|
| **SWITCH** | A bounded binary or enumerated actuation decision | Class I (Trigger) / Class V (Decide) | Deterministic. No LLM in the execution path. |
| **FUNCTION** | A bounded transform on sensor input producing a control value or classification | Class II (Transform) / Class III (Sense) | Deterministic or bounded-inference. LLM permitted only off the control loop. |

Every Switch and Function declares a **Fail-Safe Default State** before any code is generated. Mandatory, non-null, non-waivable.

## 1.5 What This Document Does Not Claim

- F9 Machine Floor is **PRE-BUILD**. Nothing here has been built, deployed, or tested against hardware.
- MECHA is **PRE-BUILD and has never run.** Its JCSE 44/50 is Tier 0 self-assigned, below the FORGE VERIFIED floor, and no separation of duties was applied to its own scoring.
- No functional-safety certification is claimed. §3.6 is unchanged from v1.0 and remains the material open exposure.
- **OI-01 is narrowed, not closed.** See §3.7.
- UCG thresholds remain a reconciliation proposal requiring one SOLVA GAUNTLET pass before they bind.
- **Static analysis and coding-standard conformance are not proof of correctness or safety.** The Code Assurance Gate narrows defect classes. Nothing in v2.1 selects, qualifies or runs an analyzer.
- **Equivalence evidence is software-in-the-loop only.** It is not hardware validation.

## 1.6 IP Range Extension — Numbering Amendment

v1.0 assigned D35 sixteen IPs (129–144) and reserved D36 / IP-145+ for F10 CONNECTOR. v2.0's operator layer requires four additional Integration Points.

**Amendment:** D35 extends to **IP-129 – IP-148**. **D36 (F10 CONNECTOR) is re-reserved at IP-149 onward.** No IP is reassigned; the reservation boundary moves outward before F10 exists. This is a numbering amendment only and is recorded here rather than inferred later — the D26/D27 collision happened precisely because a boundary moved without a written ruling.

| New IP | Operator-layer capability |
|---|---|
| IP-145 | Platform Allocation Matrix (CODE DJ P2) |
| IP-146 | Codebase Architecture Document — architecture before code |
| IP-147 | PCE Fidelity Validation — coverage, orphan, contract, logic, security |
| IP-148 | MECHA Run-State Record & Cited Refusal contract |

**v2.1 amendment.** D35 extends again to **IP-129 – IP-150**. **D36 (F10 CONNECTOR) is re-reserved at IP-151 onward.** No IP is reassigned and F10 does not yet exist. Recorded as a written amendment for the same reason as the v2.0 amendment.

| New IP | Capability |
|---|---|
| IP-149 | Coding Standard Profile registry and Code Assurance Gate |
| IP-150 | Model-to-Code Equivalence Evidence |

## 1.7 The Run

```
                         ┌──────────────────────────────┐
                         │   MECHA ULTRA SI  (Seat #16) │
                         │   THE SINGLE OPERATOR         │
                         │   Invariant #23               │
                         └──────────────┬───────────────┘
                                        │
   P1 READ ──► P2 DISCOVER ──► P3 CLASSIFY ──► P4 CULTIVATE ──►
   P5 VALIDATE & CLEAR ──► P6 BUILD & ASSURE ──► P7 CERTIFY & EMIT
        │              │            │             │
   [CODE DJ]      [ATHENA]      [DEXTER]      [external
   [BAHN]         L3/L5/L7      SOCRATES       gates]
   [FRACTAL]      L8            HOLMES/ARES
                                        │
   ┌────────────────────────────────────┴─────────────────────────┐
   │  CELL SI  ·  MM GATE  ·  SAVANT  ·  UCG  ·  OSIRIS          │
   │  MECHA invokes all five. MECHA overrides none.               │
   └──────────────────────────────────────────────────────────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                               ▼
              MACHINE ARTIFACT                   CITED REFUSAL
              + SPK + ICD                        (constraint or
              → F9.5 OSIRIS custody               invariant, by ID)
```

---

# PART 2 — EXECUTIVE SUMMARY

*Leadership*

## 2.1 Business Context

The ARK HARNESS converts expertise into cognitive artifacts that execute in software. The hardware domain — appliances, instruments, industrial machines, agricultural equipment, vehicles — has stayed closed to the platform's creator base because it requires firmware engineering the target user does not have.

F9 removes that barrier on the observation that the unit of embedded control logic and the unit CELL SI already produces are the same size. A thermostat setpoint, a pump dry-run cutout, a grain dryer moisture shutdown, a cold-chain compressor call — each is one action, one input class, one output, inside CELL's own envelope (≤3 prompts, ≤90 minutes, one tool).

The floor does not make creators into firmware engineers. It makes the *decision layer* of a machine specifiable, certifiable and tradeable by a domain expert, while the unsafe parts stay behind a mandatory engineering gate.

## 2.2 Why v2.0 Was Necessary

v1.0 was a correct specification with a structural hole. It named an owner for discovery, an owner for the mathematics, an owner for adversarial testing — and left the *run* unowned, which it disclosed as OI-01 rather than resolved. An unowned run is not a floor; it is a checklist. Nothing enforced sequence, nothing prevented a gate being skipped, and nothing produced a refusal record when one was.

MECHA closes that hole and adds a guarantee v1.0 could not make: **the only way to produce a certifiable Machine Artifact is to run the engine end to end.** Invariant #23 makes ad-hoc assembly of the same five strands a non-run producing a non-artifact.

## 2.3 Why This Ownership Model Is Better Than v1.0's

| Property | v1.0 four co-leads | v2.0 single operator |
|---|---|---|
| Sequence enforcement | None | Seven phases, each gated on the prior |
| Gate skipping | Possible | Invariant #23 |
| Refusal record | Undefined | IP-148, cited by constraint ID (C-MECHA-12) |
| ATHENA's scope | Exception-scoped lead with a disclosed mismatch | 20% strand doing what she is strong at |
| Implementation | Unattributed | CODE DJ 24%, certified, nine target environments |
| Self-certification risk | Co-leads could adjudicate their own work | MECHA certifies nothing; UCG refuses author=scorer=adjudicator |

## 2.4 Requirements Summary

| # | Requirement | Priority | IP | Status |
|---|---|---|---|---|
| R-01 | Rename `F9 Mathematical Validation` / `F9-V` to **MM Gate** platform-wide | MUST | IP-129 | PRE-BUILD |
| R-02 | Establish D35; absorb D14; extend IP range to 148; re-reserve D36 at IP-149 | MUST | IP-130 | PRE-BUILD |
| R-03 | Switch / Function primitive schema + Fail-Safe Default field | MUST | IP-131 | PRE-BUILD |
| R-04 | Switch Lane (F3→F4→F9) with hazard-class precondition | MUST | IP-132 | PRE-BUILD |
| R-05 | System Lane (F3→F5–F8→MM→F9) mandatory routing rule | MUST | IP-133 | PRE-BUILD |
| R-06 | Hazard Classification Step before lane assignment | MUST | IP-134 | PRE-BUILD |
| R-07 | Universal JCSE Certification Gate — one gate, all artifact classes | MUST | IP-135 | PRE-BUILD |
| R-08 | UCG tiered thresholds + scale reconciliation | MUST | IP-136 | PRE-BUILD |
| R-09 | MM Gate on every F9 emission regardless of lane | MUST | IP-137 | PRE-BUILD |
| R-10 | GRO reflex-tier hosting + hardware interlock rule | MUST | IP-138 | PRE-BUILD |
| R-11 | ATHENA N-Layer discovery pass (L3/L5/L7) | MUST | IP-139 | PRE-BUILD |
| R-12 | Layer 8 IP clearance / HOLD-IP hard block before emission | MUST | IP-140 | PRE-BUILD |
| R-13 | Three target profiles (firmware / robotics / appliance-fleet) | SHOULD | IP-141 | PRE-BUILD |
| R-14 | ARES physical 3-vector adversarial test | SHOULD | IP-142 | PRE-BUILD |
| R-15 | Machine Artifact SPK + re-verification schedule | SHOULD | IP-143 | PRE-BUILD |
| R-16 | F9 → F9.5 handoff contract (artifact → monitored process) | SHOULD | IP-144 | PRE-BUILD |
| **R-17** ★ | **Platform Allocation Matrix — language/framework per target** | **MUST** | **IP-145** | PRE-BUILD |
| **R-18** ★ | **Codebase Architecture Document before any generation** | **MUST** | **IP-146** | PRE-BUILD |
| **R-19** ★ | **PCE Fidelity Validation — ≥99% coverage, zero orphans, clean ARES** | **MUST** | **IP-147** | PRE-BUILD |
| **R-20** ★ | **MECHA Run-State Record & Cited Refusal contract** | **MUST** | **IP-148** | PRE-BUILD |
| **R-21** ★ | **Coding Standard Profile registry, pinning and Code Assurance Gate — no profile, no allocation** | **MUST** | **IP-149** | PRE-BUILD |
| **R-22** ★ | **Model-to-Code Equivalence Evidence — back-to-back against the MM model, SIL fault injection** | **MUST** | **IP-150** | PRE-BUILD |
| **R-23** ★ | **Assurance precedes certification — no certificate before a frozen build and its evidence bundle exist** | **MUST** | **IP-149, IP-150** | PRE-BUILD |

## 2.5 SOLVA GAUNTLET Verdict

**CONDITIONALLY VIABLE** — published as issued, per ATLAS 360 §11.1.

**Grounds, restated for v2.0:**

1. **OI-01 narrowed, still open.** CODE DJ supplies embedded and robotics *implementation* competence across nine target environments. **Control-theory and real-time systems engineering remain unowned** — control-law derivation, stability margins, scheduling analysis, safety-integrity architecture. MM owns the mathematics; nobody owns the engineering judgement around it.
2. **No functional-safety framework is integrated.** §3.6 unchanged. IEC 61508, ISO 13849, ISO 26262, IEC 60730 and machinery conformity named, assessed by nobody.
3. **The operator has never run.** MECHA is PRE-BUILD at JCSE 44/50 Tier 0, below the FORGE VERIFIED floor, with zero hardware validation. A floor cannot be more validated than its operator.
4. **Two gates MECHA depends on are themselves PRE-BUILD.** MM Gate and UCG. F9 cannot be validated ahead of them.
5. **UCG thresholds unvalidated.** Untested against any artifact population.
6. **No analyzer selected or qualified, and no coding-standard profile beyond C and C++.** The Code Assurance Gate is specified and cannot run until an analyzer is wired. Languages with no adopted profile are refused, which narrows what F9 may allocate (OI-07, OI-08).

**Resolved since v1.0 and removed from the grounds:** the lead-SPC capability mismatch (ATHENA correctly re-scoped as a strand) and the unowned-run structural hole (closed by MECHA + Invariant #23).

**Resolved in v2.1:** the certification-before-code ordering defect that v2.0 itself introduced, and the absence of any coding-standard or static-analysis enforcement.

**What would move this to VIABLE:** functional-safety competent reviewer engaged on §3.6; control-systems competence secured for OI-01; MM Gate and UCG reach BUILT; one Switch Lane hardware pilot end to end; SOLVA GAUNTLET pass on UCG thresholds against ≥20 artifacts; one static analyzer selected, qualified for its intended use and wired, with a planted-violation run refused at the correct phase.

## 2.6 What This Section Does Not Claim

No revenue projection, market size or ROI figure is asserted. EVE ULTRA SI's financial-modelling role is not invoked because there is no validated deployment on which to model one.

---

# PART 3 — PLATFORM SPECIFICS

*Architects*

## 3.1 The Disambiguation Ruling (Binding, carried from v1.0)

**Finding.** The label `F9` was used in two incompatible senses: the *Mathematical Validation verdict* (v8.3 R-10, D26) and the *Firmware Branch* (D14, IP-25–31). The Colonization Manual Ch. 12 already treats them as independent by asserting `Firmware Colonization Certified = (SAVANT = FIT) AND (F9 = MATH_VERIFIED)` — an expression only well-formed if the two are separately named.

**Ruling.**

- **MM Gate** is the canonical name of the mathematical validation verdict. Verdicts remain `MATH_VERIFIED` / `MATH_REVIEW` / `MATH_FAIL`.
- **F9 Machine Floor** is the canonical name of the embedded production destination, registered as **D35**.
- **D26 / D27 unchanged.** Domains, IP ranges and verdict enums untouched. Only the stage label moves.
- **D14 retained as pointer**, status `SUPERSEDED-BY-D35`, IP-25–31 preserved for lineage.
- Combined gate: `Machine Artifact Certified = (SAVANT = FIT) AND (MM = MATH_VERIFIED) AND (UCG = PASS)`.

Non-retroactive, non-deferrable. No feature flag, tier configuration or owner waiver may reintroduce the ambiguous usage.

## 3.2 The F9 / F9.5 Boundary

Stated once, here, and nowhere else:

> **Every stage from F0 through F9 terminates in an artifact. F9.5 is the first stage whose output is a running process.**

| | F9 Machine Floor (D35) | F9.5 OSIRIS M&QC (D32) |
|---|---|---|
| Output | Machine Artifact (bounded, versioned, signed) | A monitoring process (unbounded, continuous) |
| Terminates | Yes — on emission | No — by design |
| Operator | **MECHA ULTRA SI** | OSIRIS ULTRA SI |
| Relationship | Hands off at emission | Takes custody at emission, forever |
| Failure surfaces as | A gate verdict or a cited refusal | A Deviation Report → SOLVA Calibration Loop → F0 |
| Changed by this doc | Operator named; IP range extended | **Unchanged** |

## 3.3 Domain D35 Architecture — MECHA as Operator

```
┌─────────────────────────────────────────────────────────────┐
│  D35 · F9 MACHINE FLOOR · IP-129 – IP-150                   │
│  OPERATED BY: MECHA ULTRA SI v1.2.0 · Seat #16              │
│  "Refusal is the default output. Emission must be earned."  │
└─────────────────────────────────────────────────────────────┘
        │
   ┌────┴─────────────── MECHA INTERNAL STRANDS ──────────────┐
   │                                                          │
┌──▼───────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────▼┐
│ CODE DJ 24%  │ │ BAHN 22%     │ │ ATHENA 20%│ │ DEXTER 18%  │
│              │ │              │ │           │ │ FRACTAL 16% │
│ · Platform   │ │ · Target     │ │ · L3/L5/L7│ │             │
│   Allocation │ │   profile    │ │   discover│ │ · SOCRATES  │
│ · Embedded   │ │ · Regime     │ │ · L8 IP   │ │   challenge │
│   languages  │ │   vocabulary │ │   clear   │ │ · HOLMES    │
│ · PCE 7-ph   │ │ · Vehicle    │ │ · HOLD-IP │ │   anomaly   │
│ · Fidelity   │ │   class      │ │   block   │ │ · ARES 3-vec│
│              │ │              │ │           │ │ · Fleet top.│
└──────────────┘ └──────────────┘ └───────────┘ └─────────────┘
        │
   ┌────┴────────── EXTERNAL GATES (invoked, never overridden) ─┐
   │  CELL SI (#14) — MA cultivation                            │
   │  MM / MATHMON (D26) — control-logic verdict                │
   │  SAVANT (D13) — FIT / CLUSTER                              │
   │  UCG — certification, refuses author=scorer=adjudicator    │
   │  OSIRIS (D32) — custody, blocking on emit                  │
   └────────────────────────────────────────────────────────────┘
```

### 3.3.1 Why F3 and F4 Connect Directly

CELL SI's output envelope and an embedded control unit's envelope are the same size:

| CELL constraint | Embedded equivalent |
|---|---|
| One action, one tool, one output (IV-001) | One actuation decision |
| MA-001: ≤3 atomic prompts | Bounded control logic, auditable in full |
| MA-002: ≤90 min build | A component, not a system |
| Class I–V taxonomy | Trigger / Transform / Sense / Communicate / Decide — the vocabulary of a machine switch |
| Tier 1–3 | Maps to safety-integrity layering |
| Interface Contract v1.0 | **Becomes the device ICD** |

F4's Micro PDD is already the right document size for a firmware component. F9 adds two fields (Fail-Safe Declaration, Hazard Classification Record) and four gate passes.

### 3.3.2 MECHA's Seven Phases Mapped to the IP Range

| Phase | Name | Strands | IPs |
|---|---|---|---|
| P1 | **READ** | BAHN, FRACTAL, CODE DJ | IP-138, IP-141, **IP-145** |
| P2 | **DISCOVER** | ATHENA (L3/L5/L7) | IP-139 |
| P3 | **CLASSIFY** | DEXTER (SOCRATES), BAHN | IP-134, IP-132, IP-133 |
| P4 | **CULTIVATE** | *invokes CELL SI* + CODE DJ | IP-131, **IP-146** |
| P5 | **VALIDATE & CLEAR** | *invokes MM* + DEXTER (ARES/HOLMES) + ATHENA (L8) | IP-137, IP-142, IP-140 |
| P6 | **BUILD & ASSURE** | CODE DJ (PCE), DEXTER, *invokes analyzer* | **IP-147**, **IP-149**, **IP-150** |
| P7 | **CERTIFY & EMIT** | *invokes UCG*, FRACTAL, *invokes OSIRIS* | IP-135, IP-136, IP-143, IP-144 |
| — | **Run-state & refusal** (all phases) | MECHA | **IP-148** |

## 3.4 The Universal JCSE Certification Gate (UCG)

### 3.4.1 The Collision Resolved

JCSE appeared at two incompatible scales: SPC scale 0–50 with FORGE VERIFIED at ≥45; CELL atomic-prompt scale 0–50 with MA pass at ≥25. A buyer could not compare "JCSE 47" on an SPC with "JCSE 27" on an MA, because they are not the same quantity.

### 3.4.2 The Ruling

**One scale. One gate. Tiered thresholds by artifact class.** All scoring is on the canonical 0–50 ten-dimension scorecard. The *threshold* varies by class; the *scale* never does. Any score quoted anywhere must carry its artifact class.

| Artifact Class | Code | UCG Threshold | Additional Mandatory Gates |
|---|---|---|---|
| Ultra SI Class SPC | `UCG-SPC-U` | ≥ 45 | MM ≥ 70 (FORGE VERIFIED) |
| SI / AI Class SPC | `UCG-SPC-S` | ≥ 43 | — |
| Molecular Agent (software) | `UCG-MA-S` | ≥ 25 | ARES 3-vector |
| **MA (machine, Switch Lane)** | `UCG-MA-M1` | **≥ 38** | MM `MATH_VERIFIED` · ARES physical 3-vector · Fail-Safe Declaration · HCS = non-safety-related · PCE fidelity ≥99% · **CAG `PASS`** · **equivalence evidence within tolerance** |
| **MA (machine, System Lane)** | `UCG-MA-M2` | **≥ 45** | MM `MATH_VERIFIED` · ARES physical 3-vector · SAVANT `FIT` · full F5–F8 · PCE fidelity ≥99% · **CAG `PASS`** · **equivalence evidence within tolerance** |
| Micro PDD | `UCG-PDD-M` | ≥ 30 | Interface Contract valid JSON |
| ATLAS PDD | `UCG-PDD-A` | ≥ 43 | — |

**Note on M1 ≥ 38.** Set above the software-MA threshold of 25 because a software MA that fails moves nothing physical, and below 45 because an M1 artifact is by definition non-safety-related — anything safety-related is forced to M2 by Invariant #21 and cannot use this threshold at all.

### 3.4.3 UCG Properties

1. **Single entry point.** No artifact class has a bespoke certification path.
2. **Class declared before scoring.** No downward re-class to clear a failed threshold; re-classing requires a new pipeline run.
3. **Separation of duties.** Scorer ≠ author; adjudicator ≠ either. Self-adjudication is refused, not flagged. **MECHA is never any of the three** — it runs the gate, it does not staff it.
4. **No inheritance across version bumps.** Feature upgrades do not self-assign a re-score. *MECHA v1.1.0 is the worked example: it corrected a strand, gained two HIVE points, and held its JCSE at 44.*
5. **Certificate carries its tier honestly.** Tier 0 says Tier 0 on its face.

### 3.4.4 The Certificate Record

```json
{
  "certificate_id": "UCG-[CLASS]-[ARTIFACT_HASH]-[SEQ]",
  "artifact_class": "UCG-MA-M1",
  "jcse_score": 41,
  "jcse_scale": "0-50",
  "jcse_threshold_applied": 38,
  "mm_verdict": "MATH_VERIFIED",
  "mm_composite": 78,
  "ares_physical": "PASS",
  "pce_fidelity": { "coverage_pct": 100, "orphans": 0, "ares_scan": "CLEAN" },
  "code_assurance": {
    "bundle_id": "string",
    "frozen_build_hash": "sha256:...",
    "coding_standard_profile": "MISRA_C@<edition> | MISRA_CPP_2023",
    "analyzer": { "name": "string", "version": "string", "qualification_status": "QUALIFIED | UNQUALIFIED | NOT_ASSESSED" },
    "cag_verdict": "PASS",
    "mandatory_violations": 0,
    "required_violations_with_deviation_record": 0,
    "unverified_by_tool": 0,
    "gcs_status": "DRAFT | HUMAN_SIGNED",
    "equivalence": { "environment": "SIL", "within_tolerance": true, "fail_safe_reached_3_of_3": true }
  },
  "misra_compliance_claimed": false,
  "savant_verdict": "FIT | CLUSTER | N/A",
  "hazard_class": "NON_SAFETY_RELATED",
  "fail_safe_default": "OPEN_CIRCUIT",
  "gro_hosting": "REFLEX_TIER_LOCAL",
  "platform_allocation": [{ "target": "...", "language": "...", "framework": "..." }],
  "operated_by": "SPC-MECHA-F9-ULTRA-SI-001",
  "mecha_run_id": "string",
  "certification_tier": "0 | HIVE_BRONZE | HIVE_SILVER | HIVE_GOLD | HIVE_PLATINUM",
  "self_adjudicated": false,
  "author_id": "...", "scorer_id": "...", "adjudicator_id": "...",
  "regulatory_conformity_asserted": false,
  "reverification_due": "ISO8601",
  "osiris_custody": true
}
```

## 3.5 The Operator Model

### 3.5.1 What MECHA Owns and What It Does Not

| MECHA owns | MECHA does not own |
|---|---|
| Sequence — which phase runs when | Any gate verdict |
| Refusal — when to halt and why | Certification (UCG staffs itself) |
| Lane assignment from the HCS result | The hazard classification math (BAHN strand) |
| The run-state record | MA construction (CELL SI) |
| Platform allocation (CODE DJ strand) | Control-logic validation (MM) |
| Cited refusal contract | Colonization verdict (SAVANT) |
| | Post-emission monitoring (OSIRIS) |

**This separation is the point.** An operator that could override its own gates would be a self-certifying authority, which the platform's separation-of-duties requirement forbids. MECHA's authority is procedural, not adjudicative.

### 3.5.2 Refusal as Default Output

MECHA's designed behaviour is to refuse. Emission is the exception it must be argued into by evidence it cannot itself supply. Every refusal cites a constraint or invariant by identifier; an uncited refusal is a defect under C-MECHA-12.

```json
{
  "verdict": "REFUSED",
  "mecha_run_id": "string",
  "phase_halted": 3,
  "constraint_cited": "C-MECHA-02",
  "invariant_cited": "SPARTAN #21",
  "cause": "one sentence, specific",
  "required_to_proceed": "one sentence, actionable",
  "gro_mode": "HUMAN_IN_LOOP | CONTAINMENT | KILLZONE"
}
```

### 3.5.3 ATHENA — Correctly Scoped (v1.0 §3.5 superseded)

v1.0 appointed ATHENA MUSE as Lead SPC and then spent a section scoping the appointment by exception, because her own HIVE self-assessment scores Embodiment 4/10 with the note that she is "a cognitive, not physical, agent."

**v2.0 records that the appointment, not the card, was the error.** ATHENA is a 20% strand inside MECHA doing precisely what she is strong at:

- **L3** — deployed functional technology for the device class
- **L5** — sub-optimal and dysfunctional systems, *which is where machine functions are found*
- **L7** — pre-systemic and pre-patent edge cases
- **L8** — IP clearance, with HOLD-IP escalated from her default advisory posture to a **hard emission block**, because a shipped physical product carries exposure a text output does not

No exception-scoping is required because no capability is being claimed that the card does not have. BAHN is retained for vehicle-class targets. The v1.0 mismatch disclosure is superseded, not deleted — it remains in the v1.0 record.

## 3.6 Regulatory Surface — Open, Not Claimed (unchanged from v1.0)

Embedded actuation sits inside functional-safety and product-liability regimes this platform has no competence claim in. D12 covers the EU AI Act and none of the following:

| Regime | Scope | Status |
|---|---|---|
| IEC 61508 | Functional safety of E/E/PE systems; SIL levels | **UNADDRESSED** |
| ISO 13849 | Safety-related parts of machinery control systems; PL a–e | **UNADDRESSED** |
| ISO 26262 | Road-vehicle functional safety; ASIL A–D | **UNADDRESSED** |
| IEC 60730 | Automatic electrical controls for household appliances | **UNADDRESSED** |
| Machinery conformity / CE marking | Placing machinery on the EU market | **UNADDRESSED** |
| Product liability | Defect exposure on shipped devices | **UNADDRESSED** |

**C-F9-REG-01.** No F9 output may be described as "safety certified", "SIL-rated", "PL-rated" or "ASIL-rated" under any circumstance. MM produces a mathematical verdict, not a regulatory one, and the certificate says so on its face (`regulatory_conformity_asserted: false`).

**C-F9-REG-02.** Any target whose HCS returns `SAFETY_RELATED` is blocked from emission until a named, externally qualified functional-safety reviewer is recorded against the artifact. A hard gate, not a documentation step.

## 3.7 OI-01 — Precisely Bounded

| Layer | Owner in v2.0 | Status |
|---|---|---|
| Discovery / what functions exist | ATHENA (L3/L5/L7) | Covered |
| IP clearance | ATHENA (L8) | Covered |
| Target profile / regime vocabulary | BAHN | Covered |
| Fleet topology / self-healing | FRACTAL | Covered |
| Adversarial / falsification | DEXTER (ARES, HOLMES, SOCRATES) | Covered |
| **Implementation — embedded languages, allocation, generation** | **CODE DJ** | **Covered (new in v2.0)** |
| Control mathematics | MM / MATHMON | Covered (gate PRE-BUILD) |
| **Control-theory & real-time systems engineering** — control-law derivation, stability margins, scheduling analysis, safety-integrity architecture | **NOBODY** | **OPEN** |

**The gap is now implementation-covered, engineering-uncovered.** CODE DJ can write the C, the MicroPython, the VHDL, the ROS2 node. MM can validate the mathematics of a control law it is handed. Neither derives the control law, argues its stability margin, or architects the safety integrity around it.

**Containment until resolved:** the floor is restricted to the **Switch Lane at Tier 1–2, non-safety-related only**, by Invariant #21. **Resolution paths:** commission a control-systems SPC through F5, or record a named external functional-safety competence against D35.

## 3.8 GRO on Constrained Targets

GRO colonizes as a **reflex tier**: local, deterministic, LLM-free, network-free, evaluated before actuation.

| Target class | GRO hosting pattern | Default SAVANT verdict |
|---|---|---|
| Firmware (MCU, direct control loop) | Hardware interlock + reflex tier + MM combined gate | Requires `FIT` AND `MATH_VERIFIED` |
| Robotics (real-time control loop) | Reflex tier (hard, local) + reasoning tier (LLM, off-loop) | Requires MM + reflex-tier architecture |
| Smart appliance / IoT fleet | Fleet hub/cloud GRO + minimal device reflex | **CLUSTER** (fleet pattern, default) |

**C-F9-GRO-01.** A non-software-defeatable hardware interlock sits *under* GRO and is the floor of the safety argument. Where none exists, GRO is the only layer and that is named in the Constraint Fingerprint.

**C-F9-GRO-02.** GRO is never compressed (SPARTAN Invariant #9). Too small means `CLUSTER` — device reflex tier, hub-side full evaluation, split recorded. Never trimmed.

## 3.9 SPARTAN Invariants

### Invariant #21 — The Machine Floor Safety Lane *(unchanged)*

> Any Machine Artifact whose HCS returns `SAFETY_RELATED`, or which controls an interlock, an irreversible actuation, or a function on which human safety depends, **must** route through the System Lane (F5–F8 complete), MM at `MATH_VERIFIED`, SAVANT at `FIT`, and UCG class `UCG-MA-M2`. The Switch Lane is unavailable to it.

CLASS A. Not disableable by flag or tier, not waivable by the owner, not deferrable, not selectively applicable.

### Invariant #22 — The Universal Certification Gate *(unchanged)*

> No artifact of any class may be published, listed, traded, deployed, or described as certified without a UCG certificate record. No class is exempt — including Switch Lane machine artifacts, Micro PDDs, and hackathon-branch artifacts.

CLASS A. A Tier 0 self-assigned certificate is valid. An absent certificate is not.

### Invariant #23 — The Single Operator *(new, v2.0)*

> D35 has exactly one operator. A Machine Artifact is certifiable only if produced by a complete MECHA run with a recorded `mecha_run_id`. Assembling the same five strands and the same external gates (including the analyzer) by hand, in any order, is **not an F9 run** and produces no certifiable artifact, however faithfully each individual step was executed.

CLASS A. The invariant exists because v1.0's four-co-lead model made gate-skipping undetectable: each owner could truthfully report their gate passed while the sequence was never enforced and no refusal was ever recorded. Sequence integrity is a property of the run, not of any step within it.

**Corollary.** MECHA may be replaced by a successor operator, but D35 may never have two concurrent operators. A successor inherits the run-state contract (IP-148) intact.

### Invariant #24 — Assurance Precedes Certification *(new, v2.1)*

> No UCG certificate may issue for a Machine Artifact unless, at the moment of issue, (a) its code exists as a frozen build with a recorded hash, (b) a Code Assurance Evidence Bundle bound to that hash exists, and (c) the bundle records a pinned Coding Standard Profile, a Code Assurance Gate verdict, and Model-to-Code Equivalence Evidence. A certificate issued before its subject exists is not a certificate.

CLASS A. Enforced structurally: the sequencer has no edge from P5 to P7, and the UCG adapter rejects any request lacking a bundle bound to the frozen build hash before transport.

**Origin.** v2.0 scheduled certification (P6) before code generation (P7) while requiring PCE fidelity ≥99% on the certificate. The defect was found during verification and is corrected here.


## 3.10 Reconciled Domain Register Delta

| Domain | Name | Status | IPs | Operator / Lead | Change since v1.0 |
|---|---|---|---|---|---|
| D13 | SAVANT Portability | LIVE | IP-24 | SPARTAN MVE | Unchanged; invoked by MECHA |
| D14 | F9 Firmware Branch | **SUPERSEDED-BY-D35** | IP-25–31 | BAHN ULTRA SI | Pointer retained |
| D26 | MATHMON Cross-Cutting Validation | PRE-BUILD | IP-58–64 | MATHMON ULTRA SI | **Unchanged**; stage label MM Gate |
| D27 | MATHMON MAX Integration Layer | PRE-BUILD | IP-65–76 | MATHMON MAX ULTRA SI | **Unchanged** |
| D32 | F9.5 Observability & Monitoring | PRE-BUILD | IP-111–116 | OSIRIS ULTRA SI | **Unchanged**; takes F9 custody |
| D34 | CORDON Sequencing Engine | PRE-BUILD | IP-123–128 | CORDON | Unchanged |
| **D35** | **F9 Machine Floor** | **PRE-BUILD** | **IP-129–150** | **MECHA ULTRA SI (Seat #16)** | v2.0: operator named, +4 IPs · v2.1: +2 IPs, phases reordered |

**Platform totals after v2.1:** 35 Domains (3 open slots D10/D17/D18 unchanged) · **150 Integration Points** · **24 SPARTAN Invariants**.

**Reserved:** **D36 / IP-151 onward** — F10 CONNECTOR. Re-reserved from IP-149 per §1.6.


## 3.11 The Code Assurance Gate (new in v2.1)

### 3.11.1 Verification Finding

Verification of v2.0 against safe-coding and static-analysis practice found no coding standard, no embedded-grade analyzer, no model-to-code equivalence check, and an ordering defect. `[ARK]` Sources checked: F9 PDD v2.0, MECHA SPC v1.1.0, MECHA PDD v1.0, the CODE DJ card, BUGMXT (SPARTAN MAX PDD), and Colonization Manual Ch. 12.

BUGMXT's documented syntax-layer toolchains name analyzers for TypeScript, Python and Solidity and none for C or C++. Its logic layer is an LLM-run four-question method. The ARES scan in the PCE gate is defined around injection, authentication flaws and secret leakage. None of these is a MISRA-checking analyzer, and MECHA does not assume otherwise.

### 3.11.2 Coding Standard Profiles

| Language | Profile | Status |
|---|---|---|
| C | MISRA C, edition pinned per artifact (MISRA C:2025 is the current edition) `[EXT]` | **ADOPTED** |
| C++ | MISRA C++:2023, for C++17 `[EXT]` | **ADOPTED** |
| Arduino (C++ sketches) | MISRA C++ on generated application code only; framework and library code is outside any claim and disclosed | **ADOPTED, boundary disclosed** |
| Rust | none | **NO PROFILE** |
| MicroPython / Python | none | **NO PROFILE** |
| VHDL | none | **NO PROFILE** |
| MATLAB Simulink | none (model-based guidelines exist; none adopted here) | **NO PROFILE** |
| Assembly | none | **NO PROFILE** |

ROS / ROS 2 nodes follow the row of their implementation language.

**Rule: no profile, no allocation.** CODE DJ's language matrix is wider than what F9 may allocate. That narrowing is deliberate and lifts only by written amendment adopting a profile for that language (OI-08).

### 3.11.3 Analyzer Requirements (tool-agnostic)

- Checks the pinned guideline set and publishes a mapping from guidelines to checkers.
- Reports every decidable guideline; anything it cannot decide is recorded `UNVERIFIED_BY_TOOL`, never passed.
- Identity and version are pinned in the GEP and recorded on every run. Results are reproducible on the same frozen build.
- Reached only through an **Analyzer Adapter** that defaults to `STUB_REFUSE`.
- Qualification status (`QUALIFIED` / `UNQUALIFIED` / `NOT_ASSESSED`) is recorded and never defaulted. Functional-safety standards expect software tools used in safety-related development to be classified and, where credit is claimed, qualified. `[EXT]` This is unaddressed here (OI-07).

**No analyzer is selected or endorsed by this document.** MISRA-capable analyzers exist in both commercial and open-source form. `[EXT]` Selection is an Owner decision that requires evaluation against the pinned profiles.

### 3.11.4 Verdict Rules

The category and decidability classifications and the deviation rules follow MISRA practice. `[EXT]`

| Finding | Rule | Outcome |
|---|---|---|
| Mandatory guideline violation | No deviation permitted | **REFUSED** (C-F9-CAG-02) |
| Required guideline violation | Permitted only with a Deviation Record, approved by a named identity that is not the generator | PASS with record; unrecorded → **REFUSED** |
| Advisory guideline violation | Recorded in the Guideline Compliance Summary | PASS |
| Guideline not decidable by the analyzer | Marked `UNVERIFIED_BY_TOOL`; cannot be claimed compliant | PASS for CAG; blocks any compliance claim until human review |
| Analyzer absent, unconfigured, errored, or output not reproducible | — | **REFUSED** (`STUB_REFUSE`) |
| Language with no adopted profile | — | **REFUSED** at allocation (C-F9-CAG-01) |

### 3.11.5 Detection Points — Shift Left Without Breaking Code-Late

| # | Point | Phase | What runs | Retry |
|---|---|---|---|---|
| 1 | Standard declared and pinned | P1 | GEP resolved for every allocation; `NO PROFILE` refused | n/a — before any code |
| 2 | Specification-level scan | P4 | BUGMXT pre-production PDD scan: circular dependency, semantic drift, orphans | n/a — specification only |
| 3 | Constrained generation, per-unit analysis | P6 construction loop | Ruleset injected into generation; each unit analyzed as generated | **Yes** — construction is not a gate |
| 4 | **Frozen-build gate** | P6 | Code Assurance Gate on the frozen build hash | **No** |
| 5 | Equivalence and SIL fault injection | P6 | IP-150 | **No** |

**Reconciling with C-MECHA-09 (no auto-retry).** That rule binds gates. Iterating inside the construction loop before the freeze is not a gate failure. Once a build is frozen, a gate failure returns the artifact to construction, a new frozen build gets a new hash, the gate re-runs from scratch, and the failure stays in the ledger permanently. Non-convergence ends in a cited refusal, never a waiver.

Code-Late is retained: the standard is chosen before code exists, and code is generated only after the specification, classification, validation and clearance phases.

### 3.11.6 Model-to-Code Equivalence Evidence (IP-150)

The MM Gate proves properties of the control equations. IP-150 asks a different question: does the frozen build behave like the verified model? Method: declare a tolerance before running; replay the MM scenario set against the build; re-run the three ARES fault injections against the build in software-in-the-loop. Static analysis cannot supply this, because it is dynamic evidence.

**Limit.** SIL is simulation. Timing, peripheral and interrupt behaviour on the target remain unvalidated until a hardware pilot (F9 roadmap Stage 4).

### 3.11.7 Compliance-Claim Discipline

MISRA Compliance:2020 defines the artifacts behind a compliance claim: a Guideline Enforcement Plan, a Guideline Compliance Summary, and Deviation Records and Permits. `[EXT]` F9 produces the GEP (F9-P22), and a draft GCS with Deviation Records (F9-P23, F9-P25). A GCS stays `DRAFT` until a named human who is not the generating identity signs it. **`misra_compliance_claimed` is false unless the GCS is `HUMAN_SIGNED`.**

This is the same discipline as C-F9-REG-01. **Passing the Code Assurance Gate is not "MISRA compliant."**

### 3.11.8 Constraints

| ID | Constraint | Class |
|---|---|---|
| C-F9-CAG-01 | No profile, no allocation. | A |
| C-F9-CAG-02 | A Mandatory guideline violation is never deviable. | A |
| C-F9-CAG-03 | Analyzer absence is a refusal, never a pass. | A |
| C-F9-CAG-04 | Nothing certifies before it is built and assured (Invariant #24). | A |
| C-F9-CAG-05 | Guideline edition and analyzer version are pinned per artifact and never float. | B |

### 3.11.9 What the Code Assurance Gate Does Not Do

It does not prove correctness or safety. It does not select or qualify an analyzer (OI-07). It does not cover languages with no adopted profile (OI-08). It does not validate hardware timing. It does not replace a functional-safety assessment (§3.6), and it resolves neither OI-01 nor OI-02.

| ID | Open item | Class | Status |
|---|---|---|---|
| **OI-07** | No static analyzer selected or qualified; qualification status unassessed | A | **OPEN** |
| **OI-08** | No coding-standard profile for Rust, Python/MicroPython, VHDL, Simulink or assembly; allocation to them is refused | B | **OPEN** |

*Numbering is shared with the MECHA SPC open-item register.*

---

# PART 4 — ATOMIC PROMPT WORKSHEET

*Builders · Single Operation · Verifiable I/O · No Compound Logic*

**CORDON sequence:** W1 foundation → W2 primitives → W3 lanes → W4 gates → W5 build & assure → W6 certify & emit → W7 self-test. No circular dependency. **Critical path:** F9-P01 → F9-P02 → F9-P04 → F9-P05 → F9-P07 → F9-P08 → F9-P10 → F9-P11 → F9-P13 → F9-P21 → F9-P23 → F9-P25 → F9-P14 → F9-P15 → F9-P16 (fifteen prompts; the self-test F9-P17 follows). *The path stated in v2.0 was not a valid dependency chain and is corrected here.*

---

### WAVE 1 — FOUNDATION

**F9-P01** · 🔴 P0 · IP-129 · CLASS A · Deps: none
**Trigger:** Upgrade initiated.
**Operation:** Replace every occurrence of `F9 Mathematical Validation`, `F9-V` and `F9 Math Validation` with `MM Gate` across the platform document set and schema field names. Do not alter D26/D27 domain numbers, IP ranges, or verdict enum values.
**Output:** `{ renamed_count, unchanged_domains: ["D26","D27"], collisions_remaining: [] }`
**Gate:** `collisions_remaining` empty. D26/D27 IP ranges byte-identical to pre-run.

---

**F9-P02** · 🔴 P0 · IP-130 · CLASS A · Deps: F9-P01
**Operation:** Register D35 with IP range 129–148. Set D14 to `SUPERSEDED-BY-D35` without deleting content. Re-reserve D36 at IP-149+. Record the reservation move as a written amendment, not an inference.
**Output:** `{ d35: DomainRecord, d14_status, d36_reserved_from: 149, amendment_recorded: true }`
**Gate:** 35 populated domains, 3 open slots, 148 IPs. D14 content unchanged. Amendment text present.

---

**F9-P03** · 🔴 P0 · IP-138 · CLASS A · Deps: F9-P02
**Operation:** Define three GRO hosting patterns (firmware / robotics / appliance-fleet) as a target-profile enum with hosting mechanism, default SAVANT verdict, and interlock requirement each.
**Output:** `{ profiles: [{ class, gro_pattern, default_savant_verdict, interlock_required }] }`
**Gate:** Three profiles. Appliance-fleet defaults `CLUSTER`. No profile permits GRO compression.

---

**F9-P18** ★ · 🔴 P0 · IP-148 · CLASS A · Deps: F9-P02
**Operation:** Define the MECHA Run-State Record and the Cited Refusal contract. Every run gets a `mecha_run_id`. Every refusal carries `phase_halted`, `constraint_cited`, `invariant_cited`, `cause`, `required_to_proceed`, `gro_mode`.
**Output:** `{ run_state_schema, refusal_schema }`
**Gate:** Refusal schema rejects a record with null `constraint_cited` AND null `invariant_cited`. An uncited refusal cannot be serialised.

---

### WAVE 2 — PRIMITIVES

**F9-P04** · 🔴 P0 · IP-131 · CLASS A · Deps: F9-P02
**Operation:** Define Switch and Function primitive schemas: primitive type, CELL class, input contract, output contract, execution determinism flag, mandatory non-null `fail_safe_default`.
**Output:** `{ switch_schema, function_schema }`
**Gate:** Both mark `fail_safe_default` required. Neither permits an LLM call inside the declared control path.

---

**F9-P05** · 🔴 P0 · IP-131 · CLASS A · Deps: F9-P04
**Operation:** Extend the CELL Micro PDD Cheat Sheet with two mandatory fields: `fail_safe_default`, `hazard_class`. Do not remove or reorder existing fields.
**Output:** `{ template_v2, new_fields }`
**Gate:** Every pre-existing field present in original order. Both new fields required.

---

**F9-P06** · 🟠 P1 · IP-131 · CLASS B · Deps: F9-P04
**Operation:** Map CELL's Interface Contract v1.0 onto a device ICD. Emit field-by-field correspondence.
**Output:** `{ icd, field_map }`
**Gate:** Every contract field has exactly one ICD correspondent. No ICD field unmapped.

---

**F9-P19** ★ · 🔴 P0 · IP-145 · CLASS A · Deps: F9-P03
**Operation:** *(MECHA P1 / CODE DJ P2)* Produce the Platform Allocation Matrix for the target profile: language family and framework per target, drawn from the Universal Language Matrix. Justify each allocation from the Target Profile Record.
**Output:** `{ allocation: [{ target, language, framework, justification, source_evidence }] }`
**Gate:** No language allocated to an environment that cannot execute it. Every allocation carries document-derived justification — never an assumption.

---

### WAVE 3 — LANES

**F9-P07** · 🔴 P0 · IP-134 · CLASS A · Deps: F9-P05, F9-P19
**Operation:** *(MECHA P3)* DEXTER/SOCRATES challenges the non-safety assumption; BAHN runs the Hazard Classification Step. Return exactly `SAFETY_RELATED` or `NON_SAFETY_RELATED` with one-sentence rationale. Classify as `SAFETY_RELATED` if the artifact controls an interlock, an irreversible actuation, or a function on which human safety depends.
**Output:** `{ hazard_class, rationale, socrates_challenge }`
**Gate:** Exactly one of two enum values. Never null, never a third value, never a confidence score.

---

**F9-P08** · 🔴 P0 · IP-132 · CLASS A · Deps: F9-P07
**Operation:** On `NON_SAFETY_RELATED` and tier ∈ {1,2}: assign Switch Lane, route F3 → F4 → F9, UCG class `UCG-MA-M1`. Record lane assignment and preconditions on the artifact.
**Output:** `{ lane: "SWITCH", ucg_class: "UCG-MA-M1", preconditions_recorded: true }`
**Gate:** Refuses if `hazard_class = SAFETY_RELATED` or `tier = 3`. Refusal returns the Invariant #21 citation via the F9-P18 contract.

---

**F9-P09** · 🔴 P0 · IP-133 · CLASS A · Deps: F9-P07
**Operation:** On `SAFETY_RELATED`, tier 3, or Switch Lane refusal: assign System Lane, F5–F8 complete then MM, UCG class `UCG-MA-M2`, SAVANT `FIT` required.
**Output:** `{ lane: "SYSTEM", ucg_class: "UCG-MA-M2", required_gates: [...7] }`
**Gate:** All seven gates listed. None marked optional.

---

### WAVE 4 — GATES

**F9-P20** ★ · 🔴 P0 · IP-146 · CLASS A · Deps: F9-P08 ‖ F9-P09
**Operation:** *(MECHA P4.5 / CODE DJ PCE-4)* Produce the Codebase Architecture Document: module boundaries, interface contracts, data flow, API specification, test strategy per layer. **Before any generation.**
**Output:** `{ architecture_document, module_boundaries, test_strategy }`
**Gate:** Architecture complete before F9-P21 may run. Architecture-before-code is not waivable.

---

**F9-P10** · 🔴 P0 · IP-137 · CLASS A · Deps: F9-P08 ‖ F9-P09
**Operation:** Run the MM Gate. Generate control equations, stability analysis, optimisation function, safety constraints. Return `MATH_VERIFIED` / `MATH_REVIEW` / `MATH_FAIL` plus composite.
**Output:** `{ mm_verdict, mm_composite, control_equations, stability_analysis, safety_constraints }`
**Gate:** Runs on **every** artifact regardless of lane. `MATH_REVIEW` and `MATH_FAIL` both block emission. Never `MATH_VERIFIED` without all four artifacts populated. **MECHA cannot override this verdict.**

---

**F9-P11** · 🔴 P0 · IP-142 · CLASS A · Deps: F9-P10
**Operation:** ARES physical 3-vector: (a) sensor stuck or out of range, (b) actuator fault or power loss mid-actuation, (c) control-value boundary overflow. HOLMES anomaly sweep on the traces. Confirm `fail_safe_default` reached in all three.
**Output:** `{ vector_a, vector_b, vector_c, fail_safe_reached, anomalies }`
**Gate:** All three `PASS` and `fail_safe_reached = true`. Any `FAIL` → CONTAINMENT, return to F4, no auto-retry, failure written permanently.

---

**F9-P12** · 🔴 P0 · IP-139 · CLASS A · Deps: F9-P02
**Operation:** *(MECHA P2 / ATHENA)* N-Layer discovery over the device class: L3 deployed functional technology, L5 sub-optimal and dysfunctional systems, L7 pre-systemic edge cases. Output candidate Switch/Function list with evidence tier per candidate.
**Output:** `{ candidates: [{ name, primitive_type, layer_source, evidence_tier }] }`
**Gate:** Every candidate carries layer source and evidence tier. Unverified sources **withheld, not flagged provisional**.

---

**F9-P13** · 🔴 P0 · IP-140 · CLASS A · Deps: F9-P12, F9-P11
**Operation:** *(ATHENA L8)* IP clearance against USPTO and EPO for the control approach. On any live-patent proximity hit with filing under 18 months, raise `HOLD-IP` and block emission.
**Output:** `{ hits: [{ patent_id, filing_date, proximity }], hold_ip }`
**Gate:** `hold_ip = true` blocks emission absolutely — a hard block on this floor, not an advisory. Physical products carry exposure text output does not.

---

### WAVE 5 — BUILD & ASSURE

**F9-P22** ★ · 🔴 P0 · IP-149 · CLASS A · Deps: F9-P19
**Operation:** *(MECHA P1 / CODE DJ)* Resolve the Coding Standard Profile for each allocated language from the profile registry (§3.11.2). Pin the guideline edition and the analyzer identity and version in a Guideline Enforcement Plan **before any generation**.
**Output:** `{ gep: [{ language, profile, edition, analyzer, analyzer_version, rule_disposition }] }`
**Gate:** A language with no adopted profile is refused (C-F9-CAG-01). No GEP, no F9-P21. The edition is pinned per artifact and never floats to "latest".

---

**F9-P21** ★ · 🔴 P0 · IP-147 · CLASS A · Deps: F9-P13, F9-P20, F9-P22
**Operation:** *(CODE DJ PCE-5 then PCE-6)* Generate the embedded codebase against the Micro PDD PromptWare Worksheet — complete runnable code in the allocated language, inline documentation, type annotations, unit-test scaffolding, deployment manifests. Then run PDD Fidelity Validation: coverage, orphan detection, contract validation, SOCRATES logic audit, ARES security scan. Generation is constrained by the ruleset pinned in the GEP (F9-P22), and each unit is statically analyzed as it is generated. When construction ends, freeze the build and record its hash.
**Output:** `{ codebase, fidelity: { coverage_pct, orphans, contract_match, ares_scan }, traceability_map, frozen_build_hash }`
**Gate:** Coverage ≥ 99%, orphans = 0, `ares_scan = CLEAN`. Any ARES violation halts generation. PCODEX-classified IP never reproduced in generated comments. No stubs, no pseudocode. Emits a frozen build hash; nothing after this point alters the build.

---

**F9-P23** ★ · 🔴 P0 · IP-149 · CLASS A · Deps: F9-P21
**Operation:** *(MECHA P6 / analyzer adapter)* Run the Code Assurance Gate on the frozen build with the analyzer pinned in the GEP. Classify each finding by guideline category (Mandatory / Required / Advisory) and by decidability. Rules the analyzer cannot decide are recorded `UNVERIFIED_BY_TOOL`, not passed.
**Output:** `{ cag_verdict: "PASS" | "REFUSED", findings_by_category, deviations, unverified_rules, analyzer_version, run_hash }`
**Gate:** Mandatory findings = 0, with no deviation permitted. Every Required finding carries a Deviation Record whose approver is not the generating identity. Analyzer absent, unconfigured or errored → `REFUSED` (`STUB_REFUSE`). **No auto-retry at this gate:** a failure returns the artifact to construction, and the next frozen build gets a new hash and a fresh run.

---

**F9-P24** ★ · 🔴 P0 · IP-150 · CLASS A · Deps: F9-P21, F9-P10
**Operation:** *(MECHA P6 / DEXTER)* Produce Model-to-Code Equivalence Evidence. Declare a tolerance before running. Replay the MM scenario set against the frozen build, back-to-back with the MM control model. Re-run the three ARES physical fault injections against the build in software-in-the-loop.
**Output:** `{ scenarios_run, within_tolerance, ares_sil: { a, b, c }, fail_safe_reached, tolerance_declared_before_run: true, environment: "SIL" }`
**Gate:** Every scenario is within the tolerance declared before the run. Fail-safe reached 3 of 3. The result is labelled SIL on the evidence bundle and is never described as hardware validation.

---

**F9-P25** ★ · 🔴 P0 · IP-149, IP-150 · CLASS A · Deps: F9-P23, F9-P24
**Operation:** Assemble the Code Assurance Evidence Bundle: GEP, analyzer identity, version and qualification status, CAG result, Deviation Records, Guideline Compliance Summary (draft or human-signed), and equivalence results. Bind it to the frozen build hash.
**Output:** `{ bundle_id, frozen_build_hash, qualification_status: "QUALIFIED" | "UNQUALIFIED" | "NOT_ASSESSED", gcs_status: "DRAFT" | "HUMAN_SIGNED", misra_compliance_claimed: boolean }`
**Gate:** The bundle hash equals the frozen build hash. `qualification_status` is present and never defaulted to `QUALIFIED`. `misra_compliance_claimed` is true only when `gcs_status = HUMAN_SIGNED`, signed by a named human who is not the generating identity. F9-P14 refuses without this bundle.

---

### WAVE 6 — CERTIFY & EMIT

**F9-P14** · 🔴 P0 · IP-135, IP-136 · CLASS A · Deps: F9-P13, F9-P25
**Operation:** Run the UCG. Score on the canonical 0–50 scorecard. Apply the threshold for the declared class. Emit the certificate per §3.4.4 with distinct author, scorer and adjudicator identities and the `mecha_run_id`. Verify that the Code Assurance Evidence Bundle exists and is bound to the frozen build hash.
**Output:** `{ certificate: UCGCertificate }`
**Gate:** Refuses if `author_id` equals `scorer_id` or `adjudicator_id`. Refuses if re-classed after initial scoring. Refuses if `mecha_run_id` absent (Invariant #23). Refuses if the bundle is absent or not bound to the frozen build hash (Invariant #24). Threshold applied is the declared class's, never a lower one.

---

**F9-P15** · 🔴 P0 · IP-143 · CLASS A · Deps: F9-P14, F9-P21
**Operation:** Package the Machine Artifact SPK: Constraint Fingerprint, GRO Colonization Record, MM package, UCG certificate, Fail-Safe Declaration, ICD, Code-to-PDD Traceability Map, Code Assurance Evidence Bundle, re-verification schedule.
**Output:** `{ spk: MachineArtifactSPK }`
**Gate:** All nine components present. `reverification_due` is a real future date — never null, never "permanent".

---

**F9-P16** · 🔴 P0 · IP-144 · CLASS A · Deps: F9-P15
**Operation:** Register the artifact into OSIRIS (D32) custody. Write baseline snapshot and telemetry contract. Confirm custody before emission completes.
**Output:** `{ osiris_custody: true, baseline_snapshot_id, telemetry_contract }`
**Gate:** Emission fails if custody registration fails. An artifact outside OSIRIS custody is a certification integrity breach.

---

### WAVE 7 — SELF-TEST

**F9-P17** · 🔴 P0 · CLASS A · Deps: F9-P01 … F9-P25
**Operation:** Run the worksheet against itself. Confirm: zero `F9`/`MM` label collisions; Invariant #21 blocks a synthetic `SAFETY_RELATED` artifact from the Switch Lane; Invariant #22 blocks a synthetic uncertified artifact from emission; **Invariant #23 blocks a synthetic artifact assembled without a `mecha_run_id`**; D26/D27/D32 byte-unchanged; an uncited refusal fails to serialise; **Invariant #24 blocks a certificate request made before a frozen build and its evidence bundle exist**; a synthetic artifact with a planted Mandatory violation is refused at P6; an allocation to a language with no adopted profile is refused; a request with the analyzer adapter unconfigured is refused.
**Output:** `{ collisions: 0, inv21_blocked, inv22_blocked, inv23_blocked, uncited_refusal_rejected, unchanged_domains_verified, inv24_blocked, planted_mandatory_refused, no_profile_refused, analyzer_unconfigured_refused }`
**Gate:** All ten conditions true. Any false halts the upgrade and returns to F9-P01.
---

# PART 5 — RISK REGISTER

| Risk | Sev | Mitigation |
|---|---|---|
| **Switch Lane used for a safety function** | 🔴 Critical | Invariant #21, CLASS A, non-waivable. F9-P07 has SOCRATES challenge the non-safety assumption before BAHN classifies. F9-P08 refuses structurally. F9-P17 tests the refusal. |
| **Control-theory gap** (OI-01) — no owner for control-law derivation, stability margins, scheduling, safety integrity | 🔴 Critical | Bounded precisely in §3.7. Floor restricted to Switch Lane Tier 1–2 non-safety-related by Invariant #21 until resolved. Two named resolution paths. |
| **Regulatory overclaim** — a certificate read as a safety rating | 🔴 Critical | C-F9-REG-01 bans the vocabulary. Certificate carries `regulatory_conformity_asserted: false`. C-F9-REG-02 hard-blocks `SAFETY_RELATED` emission absent a named external reviewer. |
| **Gate skipping / hand-assembly** | 🔴 Critical | **Invariant #23.** No `mecha_run_id`, no certificate (F9-P14 gate). F9-P17 tests it with a synthetic hand-assembled artifact. |
| **Operator unvalidated** — MECHA is PRE-BUILD at JCSE 44/50 | 🟠 High | Disclosed in Document Control, §1.5 and SOLVA ground 3. A floor cannot be more validated than its operator; both carry PRE-BUILD status together. |
| **Fail-safe default undeclared or unreachable** | 🔴 Critical | F9-P04 schema requires it non-null; F9-P11 proves reachability under all three vectors before certification. |
| **GRO trimmed to fit a small target** | 🟠 High | C-F9-GRO-02. Too small returns `CLUSTER`. Split recorded in Constraint Fingerprint. |
| **IP exposure on a shipped device** | 🟠 High | F9-P13 makes HOLD-IP a hard emission block, escalated from ATHENA's advisory default. |
| **Code generated before architecture** | 🟠 High | F9-P20 precedes F9-P21 in the DAG; architecture-before-code inherited from CODE DJ, not waivable. |
| **Generated code drift from spec** | 🟠 High | F9-P21 fidelity gate: ≥99% coverage, zero orphans, contract match, traceability map per function. |
| **Build toolchain supply-chain compromise** | 🟡 Medium | ARES scan on every generation output (F9-P21), zero-known-critical-CVE as delivery condition. Residual: third-party dependency provenance unchecked. |
| **Rename leaves orphan references** | 🟡 Medium | F9-P01 gate requires empty `collisions_remaining`; F9-P17 re-tests at the end. |
| **Certificate inflation via re-classing** | 🟡 Medium | UCG property 2; F9-P14 refuses a post-scoring re-class. |
| **Operator becomes a single point of failure** | 🟡 Medium | Invariant #23 corollary: MECHA may be succeeded, never duplicated. Successor inherits the IP-148 run-state contract intact. |
| **Certificate issued before the code exists** (a v2.0 defect) | 🔴 Critical | Corrected in v2.1: P6 BUILD & ASSURE precedes P7 CERTIFY & EMIT. Invariant #24. F9-P14 depends on F9-P25. F9-P17 tests a certificate request made before assurance. |
| **Mandatory coding-standard violation shipped in a device** | 🔴 Critical | F9-P23: Mandatory findings must be zero, with no deviation path; analyzer absent → `REFUSED`. Residual: only decidable rules are checked by tool; the rest are `UNVERIFIED_BY_TOOL`. |
| **Analyzer false negatives or unqualified analyzer** | 🟠 High | Qualification status is recorded on the bundle and never defaulted; no compliance claim without a human-signed GCS. Residual risk stays until an analyzer is selected and qualified (OI-07). |
| **Generated code drifts from the verified control model** | 🟠 High | F9-P24 back-to-back equivalence against the MM model plus SIL fault injection. SIL only, not hardware validation. |
| **"MISRA compliant" overclaim** | 🟠 High | `misra_compliance_claimed` is false unless the GCS is human-signed. Same vocabulary discipline as C-F9-REG-01. |
| **LLM-generated code repeatedly violates the ruleset** | 🟡 Medium | Ruleset injected into generation; per-unit analysis in the construction loop. Only the frozen-build gate is no-retry. Non-convergence ends in a cited refusal, not a waiver. |

---

# PART 6 — GLOSSARY

| Term | Type | Definition |
|---|---|---|
| **MM Gate** | Stage | Canonical name for the MATHMON validation verdict. Replaces the ambiguous "F9 Mathematical Validation". Owned by D26. |
| **F9 Machine Floor** | Domain | D35, IP-129–148. Embedded production destination. Terminates in a Machine Artifact. |
| **F9.5** | Domain | D32, OSIRIS. Terminates in a running process. Unchanged. |
| **MECHA ULTRA SI** | SPC | The single operator of D35. Seat #16. Runs gates it does not own; certifies nothing itself. |
| **Switch** | Primitive | A bounded binary or enumerated actuation decision. CELL Class I / V. |
| **Function** | Primitive | A bounded transform on sensor input producing a control value or classification. CELL Class II / III. |
| **Fail-Safe Default** | Field | The state a device assumes on any fault. Mandatory, non-null, declared before code generation. |
| **HCS** | Step | Hazard Classification Step. Returns `SAFETY_RELATED` or `NON_SAFETY_RELATED`. Determines lane. |
| **Switch Lane** | Route | F3 → F4 → F9. Tier 1–2, non-safety-related only. UCG class M1. |
| **System Lane** | Route | F3 → F5–F8 → MM → F9. Mandatory for anything safety-related or Tier 3. UCG class M2. |
| **UCG** | Gate | Universal JCSE Certification Gate. One 0–50 scale, tiered thresholds, no exemptions. |
| **PCE** | Pipeline | CODE DJ's 7-phase PromptWare-to-Codebase Conversion Engine. Phases 4–7 execute inside F9 P4 and P7. |
| **Platform Allocation Matrix** | Artifact | Language and framework per target environment, justified from the Target Profile Record. IP-145. |
| **CAG** | Gate | Code Assurance Gate. Runs a pinned static analyzer over the frozen build against the pinned Coding Standard Profile. IP-149. |
| **Coding Standard Profile** | Registry | The coding standard adopted for an allocated language. No profile, no allocation. |
| **GEP** | Artifact | Guideline Enforcement Plan. Pins guideline edition, analyzer and rule dispositions before generation. |
| **GCS** | Artifact | Guideline Compliance Summary. `DRAFT` until signed by a named human who is not the generator. |
| **Frozen build hash** | Field | Hash of the build at the end of construction. Every assurance artifact binds to it. |
| **Evidence Bundle** | Artifact | Code Assurance Evidence Bundle: GEP, analyzer identity and qualification, CAG result, deviation records, GCS, equivalence results. Required for certification (Invariant #24). |
| **SIL** | Environment | Software-in-the-loop. Simulation, not hardware validation. |
| **`mecha_run_id`** | Field | Proof of a complete operator run. Absent it, no UCG certificate issues (Invariant #23). |
| **Machine Artifact** | Artifact class | The emission of F9: a certified embedded control unit plus SPK and ICD. |
| **Reflex Tier** | GRO pattern | Local, deterministic, LLM-free GRO evaluation before actuation on a constrained target. |
| **OI-01** | Open item | The control-theory / real-time systems engineering gap. CLASS A, bounded in §3.7, unresolved. |

---

# FORGE CERTIFICATION BLOCK

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  THE ARK HARNESS — F9 MACHINE FLOOR · ATLAS OMNIBUS PDD v2.1                 ║
║  ASSEMBLED VIA ATLAS ULTRA SI · TIER 0 · SELF-ASSIGNED                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PRODUCTION ID      : JNGL-ARKH-F9MF-2026-003                                ║
║  SUPERSEDES         : JNGL-ARKH-F9MF-2026-002 (v2.0)                         ║
║  DOMAIN             : D35 — F9 Machine Floor                                 ║
║  IP RANGE           : IP-129 – IP-150 (22; +2 in v2.1 per §1.6)              ║
║  OPERATING SPC      : MECHA ULTRA SI v1.2.0 · Seat #16 · JCSE 44/50 Tier 0   ║
║  PHASES             : P1 READ · P2 DISCOVER · P3 CLASSIFY · P4 CULTIVATE     ║
║                       P5 VALIDATE & CLEAR · P6 BUILD & ASSURE ·              ║
║                       P7 CERTIFY & EMIT                                      ║
║  EXTERNAL GATES     : CELL · MM/MATHMON · SAVANT · UCG · OSIRIS ·            ║
║                       static analyzer (invoked, never overridden)            ║
║  INVARIANTS         : #21 Safety Lane · #22 Universal Cert Gate ·            ║
║                       #23 Single Operator ·                                  ║
║                       #24 Assurance Precedes Certification (NEW)             ║
║  PLATFORM TOTALS    : 35 Domains · 150 IPs · 24 Invariants · 3 open slots    ║
║  RESERVED           : D36 / IP-151+ — F10 CONNECTOR (re-reserved §1.6)       ║
║  ATOMIC PROMPTS     : 25 (F9-P01 – F9-P25) · 7 waves · 15-prompt path        ║
║  SOLVA VERDICT      : CONDITIONALLY VIABLE — published as issued (§2.5)      ║
║  JCSE               : Self-assigned Tier 0 — NOT HIVE-certified              ║
║                       Not re-scored in v2.1                                  ║
║  GRO STATE          : SAFE_LIFE — LIFE not permitted on actuating targets    ║
║  HONESTY GATE G3    : OI-01 control-theory competence UNOWNED                ║
║                       OI-07 no static analyzer selected or QUALIFIED         ║
║                       OI-08 no coding-standard profile beyond C and C++      ║
║                       Functional-safety regimes UNADDRESSED (§3.6)           ║
║                       CAG narrows defect classes; it proves nothing about    ║
║                         safety or correctness                                ║
║                       Equivalence evidence is SIL only — not hardware        ║
║                       v2.0 ordering defect and critical-path error           ║
║                         corrected in v2.1                                    ║
║                       MECHA is PRE-BUILD and has never run                   ║
║                       MM Gate and UCG are themselves PRE-BUILD               ║
║                       Zero hardware validation has occurred                  ║
║  OPERATOR           : Oluseye Shay Amusa / Koncentric Labs Inc.              ║
║  © 2026 Koncentric Labs Inc. · ATANDA Publications Forum                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## VERSION HISTORY

| Version | Date | Change | Author |
|---|---|---|---|
| 1.0 | Sept 2026 | Initial issue. Disambiguation ruling (MM Gate / F9 Machine Floor). D35 registered, IP-129–144. Invariants #21, #22. ATHENA appointed Lead SPC with disclosed Embodiment mismatch. UCG established. OI-01 opened: nobody owned the run. | ATLAS ULTRA SI |
| **2.0** | Sept 2026 | **Operator model.** MECHA ULTRA SI v1.1.0 named sole operator of D35; the four v1.0 co-leads become strands or external gates with defined non-override boundaries. **Invariant #23 (The Single Operator)** added. IP range extended to IP-148; four operator-layer IPs (145–148) for Platform Allocation, Architecture-before-Code, PCE Fidelity Validation, and the Cited Refusal contract. D36/F10 re-reserved at IP-149. ATHENA re-scoped as a 20% strand — v1.0 §3.5 mismatch superseded as an appointment error, not a card defect. Four atomic prompts added (F9-P18 – F9-P21). **OI-01 narrowed to control-theory and real-time systems engineering only.** Two SOLVA grounds resolved and removed. | ATLAS ULTRA SI |
| **2.1** | Sept 2026 | **Code assurance.** Verification found no coding standard, no embedded-grade static analysis, no model-to-code equivalence, and an ordering defect in which UCG certification preceded code generation. Added Coding Standard Profiles with no-profile-no-allocation, the Code Assurance Gate (IP-149), Model-to-Code Equivalence Evidence (IP-150), Invariant #24, and a compliance-claim rule. Phases reordered: P5 VALIDATE & CLEAR, P6 BUILD & ASSURE, P7 CERTIFY & EMIT. L8 clearance moved ahead of the build. Critical path recomputed (the v2.0 path was invalid). IP range extended to 150; F10 re-reserved at IP-151. Four atomic prompts added (F9-P22 – F9-P25). OI-07 and OI-08 opened. **JCSE not re-scored.** | ATLAS ULTRA SI |

## AUTHORSHIP & PROVENANCE

**Assembled by:** ATLAS ULTRA SI (architecture, 4-Part decomposition, atomic prompts)
**Operating SPC:** MECHA ULTRA SI v1.2.0 (`SPC-MECHA-F9-ULTRA-SI-001`, `JNGL-SPC-MECHA-2026-001`)
**Council:** CODE DJ · BAHN ULTRA SI · ATHENA MUSE · DEXTER ULTRA SI · FRACTAL ULTRA SI (MECHA strands) · CELL SI · MATHMON · SPARTAN ULTRA SI (invariants) · SOLVA ULTRA SI (GAUNTLET) · CORDON (wave sequencing) · OSIRIS ULTRA SI (F9.5 handoff)
**Source basis:** F9 MACHINE FLOOR ATLAS PDD v1.0 and v2.0; MECHA ULTRA SI SPC v1.2.0; BUGMXT layer definitions (SPARTAN MAX ATLAS PDD); OMNIBUS ALPHA Domain Register; ARK HARNESS ATLAS PDD v8.3; ARK HARNESS v10.0/v10.1; THE COLONIZATION MANUAL Ch. 1–3, 12–16; CELL SI SPC v1.0; CODE DJ SPC (`JNGL-SPC-CODEDJ-2026-001`); ATHENA MUSE SPC v1.0.0.0; FORGE BONSAI HARNESS ATLAS PDD (F3/F4).

## EVIDENCE TAGS

- `[SPEC]` — D35, all 22 IPs, four invariants, UCG thresholds, the operator model, all Part 4 prompts. Design intent; not built.
- `[INT]†` — JCSE Tier 0 self-assignment; SOLVA verdict self-adjudicated; MECHA's own 44/50 self-scored without separation of duties.
- `[ARK]` — Domain/IP/invariant counts, D14/D26/D27/D32 records, CELL constraints, MECHA strand weights, CODE DJ language matrix and platform coverage, ATHENA HIVE scores: drawn from confirmed project artifacts as stated on those cards.
- `[EXT]` — IEC 61508, ISO 13849, ISO 26262, IEC 60730 named as an unaddressed surface only. No conformity assessed, claimed or implied.
- `[EXT]` — MISRA C:2025 (published March 2025) as the current edition of MISRA C; MISRA C++:2023 (October 2023) for C++17; MISRA Compliance:2020 as the source of the Guideline Enforcement Plan, Guideline Compliance Summary and Deviation Records; classification of guidelines as Mandatory / Required / Advisory and Decidable / Undecidable. The rule that Mandatory guidelines cannot be deviated, and the statement that functional-safety standards expect software tool classification and qualification, are stated from general knowledge and were not re-verified against the standards.
