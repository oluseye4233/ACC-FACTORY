# ATANDA Command Centre

## An End-User Guide

### Part 1 — Business Cases Catalogue (reality-grounded)
### Part 2 — Onboarding via *Context Craft*: How to design the per-chapter checkpoint pages

*Version 1.0 · May 2026*

---

## About this guide

The ATANDA Command Centre is, at its core, a small set of high-leverage primitives:

- **An 8-engine HARNESS pipeline** (F1–F8) that takes a raw idea and walks it through diagnostic → atomic prompt → CELL micro-agent → Micro PDD → 15-section SPC → 4-Part ATLAS PDD → SPARTAN-certified MVP PDD → scaffolded code.
- **Adjunct engines** for ingestion, cartridge context injection, vibe-coding tool recommendation (F6-VDJ), drift detection (PFP), and SPC evolution (DE-SPC).
- **A scoring rubric** — JCSE (Junglenomics Composite Score Estimate, 0–50) across 7 pillars, with cert tiers SILVER / GOLD / PLATINUM, calibrated to the HIVE 14-D framework — baked directly into the engine prompts.
- **An exemplar library** users can fork from (SPHINX, SPARTAN, ATLAS, TITAN, GAMEMXT and similar Ultra SI archetypes).
- **A team / organisation layer** with per-seat billing, an org-level activity log, and a cost-cap guard rail.
- **A public verification surface** (`/verify?artifactId=…`, optionally syndicated to a Sphinx Marketplace) so certified artifacts have an independently checkable URL.

Those primitives compose into more business cases than the platform was originally pitched for. Part 1 of this guide enumerates them. Part 2 then takes a specific, important reuse case — onboarding through the book *Context Craft* — and proposes a concrete chapter-by-chapter checkpoint page design that turns the book into a guided platform onramp.

Everything below is grounded against the actual shipped platform (engines, routes, schema, Stripe SKUs) as of May 2026. Where a use case requires a feature the platform does not have, the guide says so explicitly.

---

# PART 1 — BUSINESS CASES CATALOGUE

The catalogue is organised into ten families. For each business case the guide lists:

- **Who it's for** — the buyer / user persona.
- **What they do on the platform** — the concrete engine sequence.
- **Tier needed** — Explorer / Practitioner / Architect / Team Lite / Institution.
- **Add-ons** — Cartridge, Ingestion, Sphinx publish, etc.
- **What the platform does NOT do** — the boundary; what the buyer still has to do off-platform.

---

## FAMILY A — Core builder use cases (what the platform was designed for)

### A1. Solo founder building an AI-native product

- **Who:** Technical founder / indie maker building one AI agent product end-to-end.
- **Platform sequence:** F1 (sharpen idea) → F2 (atomic prompt) → F3 (CELL agent) → F4 (Micro PDD) → F5 (15-section SPC, GOLD or PLATINUM) → F6 (ATLAS PDD, 4-Part) → F6-VDJ (pick coding tool) → F7 (SPARTAN MVP PDD with verify URL) → F8 (scaffold code) → PFP (post-F8 drift check).
- **Tier:** Architect ($199/mo). Architect tier gives unlimited daily F1–F5 and 2 F8 runs per day.
- **Add-ons:** Optional Sphinx publish for a marketing-grade public verify URL.
- **Platform does NOT:** Deploy the agent, train any model, host the production stack, run user analytics. F8 emits a scaffold; turning it into running production is the founder's job.

### A2. AI-native startup with a small engineering team

- **Who:** 2–6 person engineering team, every engineer building or extending agent capabilities.
- **Platform sequence:** Architect-tier founder + Team Lite seats for each engineer (per-seat). Team treats each agent capability as its own session: F1 → F5 → F8.
- **Tier:** Architect (founder) + Team Lite seats (engineers).
- **Add-ons:** A Cartridge ($499.99 one-time) per major product surface to lock the cross-engineer context.
- **Platform does NOT:** Provide a Jira/Linear-style backlog board, sprint planning, or stand-up tooling. The team continues to use whatever issue tracker they already use; the platform's contribution is the certified spec the issue tracker references.

### A3. AI agency / boutique consultancy doing client-funded builds

- **Who:** Agency selling AI agent builds to enterprise clients (typical engagement: $50K–$500K).
- **Platform sequence:** One session per client engagement. Every deliverable (discovery doc, architecture, build, hand-off) is a HARNESS artifact with a SPARTAN cert ID and a verify URL the client can independently check.
- **Tier:** Architect per consultant + an Institution (per-seat) workspace if running >5 concurrent engagements.
- **Add-ons:** Cartridge per client (loads the client's domain context — security policies, brand guide, existing systems — into every subsequent engine call); Ingestion per legacy spec the client provides.
- **Sells the buyer on:** The verify URL — the client can audit the agency's process without re-reading the agency's deck.
- **Platform does NOT:** Bill the client, manage SOWs, track time. Use Harvest / Bonsai / standard agency tooling.

### A4. Enterprise AI transformation programme (brownfield)

- **Who:** F500 with a legacy stack, replatforming workflows onto AI agents.
- **Platform sequence:** Per workstream — Ingestion of the existing spec → Advanced Cartridge with the legacy context → F1 to baseline current prompts/features → F5 to certify replacement SPCs → F8 to scaffold replacements → PFP for the drift report on every PR.
- **Tier:** Institution (per-seat team subs across the programme).
- **Add-ons:** Multiple Cartridges (one per EPIC / workstream); Ingestion per legacy doc.
- **Platform does NOT:** Replace the change-management, parallel-track-migration, SLA-continuity, or org-design work. The platform's contribution is the certified spec + scaffold + drift trail — typically a small fraction of total programme cost.

### A5. Greenfield enterprise AI build

- **Who:** Enterprise division building a new AI product (no legacy to migrate).
- **Platform sequence:** Same as A1 but with Institution-grade per-seat subs, an internal team workspace, and the org activity log as the audit trail.
- **Tier:** Institution.
- **Add-ons:** Cartridge per product to lock corporate context (security, brand, integration surfaces).

---

## FAMILY B — Education, training, and academic use cases

### B1. AI literacy bootcamp (private)

- **Who:** Coding bootcamp / executive education program teaching "how to prompt seriously."
- **Platform sequence:** Cohort of students each gets an Explorer or Practitioner seat. Curriculum maps directly to F1–F7: every assignment is "produce an SPC for problem X with JCSE ≥ 42." Instructors review by clicking the artifact's verify URL.
- **Tier:** Explorer (free, F1 + exemplar fork) for sampling; Practitioner for full coursework.
- **Add-ons:** A pre-loaded Cartridge per cohort, containing the cohort's reference materials.
- **Why it works:** JCSE is an objective rubric — students can self-grade, and the score is the same across cohorts. The exemplar library doubles as a teaching corpus.
- **Platform does NOT:** Track attendance, manage cohorts, or issue diplomas. Use standard LMS (Canvas / Moodle) for those.

### B2. University AI course / module

- **Who:** Faculty teaching a one-semester AI-product-design course.
- **Platform sequence:** One session per student; pillar-by-pillar weekly assignments scored by JCSE; final project = end-to-end F1→F7 deliverable.
- **Tier:** Practitioner or Explorer for students; one Architect seat for the instructor.
- **Add-ons:** Course Cartridge with reading list and case studies.
- **See also Part 2 of this guide** for a concrete pattern: using the book *Context Craft* as the textbook with per-chapter platform checkpoints.

### B3. Corporate L&D — AI fluency programme

- **Who:** Chief Learning Officer rolling out company-wide AI training.
- **Platform sequence:** Each business unit gets an Institution workspace; each learner runs the JST self-assessment, then walks F1 on a real workflow they own. Successful certification = SPC produced for at least one of their daily workflows.
- **Tier:** Institution.
- **Add-ons:** Corporate Cartridge per BU containing internal policy and brand voice.
- **Why it works:** Activity log + per-user `/me/costs` gives L&D defensible adoption metrics — not "we trained 1,200 people," but "1,200 people produced N certified artifacts with mean JCSE X."
- **Platform does NOT:** Push learning content, schedule sessions, send reminders. Pair with a Cornerstone / Workday Learning / Docebo for delivery.

### B4. K-12 / high-school AI literacy

- **Who:** District CTO running a year-long pilot.
- **Platform sequence:** Teacher-led F1 sessions; students score and iterate prompts; final assessment = produce one Micro PDD (F4).
- **Tier:** Explorer for students; Practitioner for teachers.
- **Caution:** Platform has no parental-consent flow, no COPPA hardening, no per-student data-minimisation switches. Districts must wrap their own consent layer.

### B5. Train-the-trainer / certification authority

- **Who:** Industry body wanting to define what "AI-fluent" means for their profession (e.g. AI literacy for legal professionals).
- **Platform sequence:** Body designs a Cartridge embodying their profession's domain; certifies trainers by issuing them a verify URL for a body-of-knowledge SPC; trainers then teach using B1/B2 patterns.
- **Tier:** Institution (for the body) + Practitioner (per certified trainer).

### B6. AI onboarding for new hires (internal academy)

- **Who:** Engineering org with regular hiring; uses platform as the "your first AI agent in 2 weeks" onboarding track.
- **Platform sequence:** New hire forks an internal exemplar SPC, modifies for a real internal use case, produces a certified MVP PDD, scaffolds with F8, presents to mentor.
- **Tier:** One Team Lite seat per new hire.

---

## FAMILY C — Programmatic & event-based use cases

### C1. Hackathon facilitation

- **Who:** Hackathon organiser running a 24–72h event with 50–500 participants.
- **Platform sequence (event-day):**
  - Pre-event: organiser builds one **Cartridge per challenge track** loaded with the prompt brief, judging rubric, sponsor data, and any APIs. Cost: $499.99 per challenge.
  - Hackers each get an Explorer / Practitioner seat. The Cartridge guarantees every team starts with the *same* authoritative context.
  - Judging: every submission is a certified SPC + MVP PDD with a verify URL. Judges score by clicking the URL — no slide decks needed.
- **Tier:** Practitioner per hacker (pay-per-event, sponsor-funded usually); Institution for the organiser.
- **Why it works:** The cartridge-fence guarantee (`=== CARTRIDGE CONTEXT (authoritative · do not contradict) ===` is literally prepended to every engine call) ensures all teams operate from the same brief, eliminating "did you read the rules?" disputes. The verify URL eliminates judging-time confusion.
- **Platform does NOT:** Manage registration, team formation, the leaderboard, or prize disbursement. Use Devpost / HackerEarth for those.

### C2. Innovation challenge (internal corporate)

- **Who:** Chief Innovation Officer running a quarterly internal challenge.
- **Platform sequence:** Same as C1 but Cartridge contains internal context. Output: shortlist of certified MVP PDDs the org can actually staff into PIs.
- **Tier:** Institution.

### C3. Accelerator / incubator demo-day prep

- **Who:** YC-style accelerator with 10–20 startup cohort.
- **Platform sequence:** Each startup gets one Cartridge (their own market thesis + tech context). They use F1→F7 to produce a public verify URL their demo-day audience can independently audit. Pitch deck links the verify URL.
- **Tier:** Architect per startup; Institution for the accelerator.
- **Add-on:** Sphinx publishing turns each startup's certified MVP PDD into a public-marketplace artifact investors can browse before demo day.

### C4. Pitch competition judging

- **Who:** Competition organiser (VC firm running themed pitch contest, university-startup competition, etc.).
- **Platform sequence:** Use JCSE 7-pillar rubric (or a competition-specific Cartridge) as the standardised judging rubric. Each pitch produces an F1 score; finalist shortlist is the top-N JCSE.
- **Tier:** Institution for organiser; Explorer for entrants.
- **Why it works:** JCSE is a published, reproducible rubric — eliminates "judges disagree because they used different criteria" complaints.

### C5. Conference workshop / masterclass

- **Who:** Conference organiser hosting a 90-minute hands-on masterclass.
- **Platform sequence:** Workshop Cartridge with the masterclass's worked example loaded; attendees granted 24h Practitioner seats. Output: each attendee leaves with their own verify URL.

---

## FAMILY D — Methodology-as-a-service (the SPC as a universal spec format)

### D1. Product management — using ATLAS PDDs as PRDs

- **Who:** PM team standardising on a single rigorous PRD format.
- **Platform sequence:** Every new product surface gets a session; F6 produces the 4-Part ATLAS PDD that replaces the team's previous PRD template.
- **Tier:** Architect per PM.
- **Why it works:** ATLAS PDDs are HIVE-scored — discoverable gaps in the spec (missing constraints, vague success criteria) are flagged automatically.
- **Platform does NOT:** Roadmap, prioritise, or sequence across PRDs. Use Productboard / Aha! for that.

### D2. Requirements engineering for non-AI software

- **Who:** Engineering org that wants the rigor of HARNESS specs even for non-AI features.
- **Platform sequence:** Skip F8 (or run it and discard the AI-scaffolded code); use F5 + F6 + F7 as a hardened spec authoring tool.
- **Tier:** Practitioner per spec author.
- **Caveat:** The engines are prompt-tuned for AI agent specs; non-AI specs require user discipline to ignore agent-specific sections.

### D3. RFP authoring (buyer side)

- **Who:** Procurement team writing an RFP for a vendor-built system.
- **Platform sequence:** Cartridge with the internal context (existing systems, security policy, regulatory environment); F5 produces a hardened SPC that becomes the RFP. The verify URL becomes a vendor-facing reference artifact.
- **Tier:** Architect or Institution.

### D4. RFP response (vendor side)

- **Who:** Vendor responding to AI-system RFPs.
- **Platform sequence:** Ingestion of the RFP; F5 produces a certified counter-spec; the verify URL goes in the proposal as proof-of-rigour.
- **Tier:** Architect per proposal lead.
- **Why it works:** Most RFP responses are PowerPoint slop. A verify URL is differentiating.

### D5. Solution architecture documentation

- **Who:** Solution architect at an SI / professional-services firm.
- **Platform sequence:** F6 ATLAS PDD becomes the canonical client-facing architecture document; SPCs (F5) become the per-component specs.
- **Tier:** Architect per SA.

### D6. Standards body / certification authoring

- **Who:** Industry body (or an aspiring one) authoring a standard or certification framework.
- **Platform sequence:** The standard itself is an SPC. The certification scheme becomes a Cartridge that downstream practitioners load into their own sessions. The verify URL becomes the publicly auditable canonical reference.
- **Tier:** Institution.

---

## FAMILY E — Regulated and professional services

### E1. Legal — drafting standardised agreement templates

- **Who:** Law firm building a template library (e.g. SaaS MSAs, NDAs, employment).
- **Platform sequence:** One Cartridge per practice area (loaded with firm-style examples, jurisdiction notes, partner preferences); F5 produces hardened, JCSE-scored templates; PFP catches drift when the templates are revised.
- **Tier:** Architect per practising attorney; Institution for the firm.
- **Platform does NOT:** Replace privileged review, jurisdiction-specific compliance checking, or the actual practice of law. The output is a draft template, not legal advice.

### E2. Healthcare — clinical workflow standardisation

- **Who:** Health system standardising clinician-facing workflow specs (triage protocols, documentation templates).
- **Platform sequence:** Cartridge with the system's clinical guidelines + EHR context; F5 → F6 produces the canonical protocol spec; verify URL = the auditable reference.
- **Tier:** Institution.
- **Platform does NOT:** Carry PHI safely. **Do not** put patient-identifiable data into any engine call. The platform is for protocol specs, not for clinical decisions. No HIPAA hardening ships today.

### E3. Compliance / governance policy authoring

- **Who:** CISO / compliance officer writing internal policies (acceptable use, data handling, vendor risk).
- **Platform sequence:** Cartridge per regulatory frame (GDPR / SOC2 / NIST / etc.); F5 produces the policy SPC; F6 the human-readable policy doc.
- **Tier:** Architect or Institution.
- **Platform does NOT:** Maintain a living compliance posture — that's a GRC tool.

### E4. Accounting / audit methodology

- **Who:** Audit firm codifying its own playbooks.
- **Platform sequence:** Each audit playbook becomes an SPC; the firm's exemplar SPC library replaces the previous internal wiki.
- **Tier:** Institution.

---

## FAMILY F — Marketing, brand, and editorial

### F1. Brand voice system

- **Who:** Marketing org defining and enforcing a brand voice across AI-assisted content production.
- **Platform sequence:** F5 SPC defines the voice (tone, vocabulary, prohibited phrases, audience adaptations); becomes a Cartridge loaded into every downstream content task.
- **Tier:** Architect per brand owner; Institution for cross-team enforcement.

### F2. Editorial standards (publishing / newsroom)

- **Who:** Editor-in-chief at a digital publication.
- **Platform sequence:** Style guide → SPC; section guidelines → Cartridges; authors run F1 against their drafts to catch style drift before submission.
- **Tier:** Practitioner per author; Architect per section editor.

### F3. Sales playbook standardisation

- **Who:** Sales enablement lead.
- **Platform sequence:** Each "play" (discovery call, demo, closing) gets an SPC; reps use the verify URL as a coachable reference; new-hire ramp uses the Cartridge.
- **Tier:** Institution.

### F4. Customer-support agent design

- **Who:** Support ops lead designing agent-handled tier-1 support.
- **Platform sequence:** F1–F7 to certify the agent design before any vendor build; PFP to monitor drift once deployed.
- **Tier:** Architect.

---

## FAMILY G — Research, science, and academia

### G1. Reproducible research methodology cards

- **Who:** Researcher producing methodology supplements for papers.
- **Platform sequence:** Methodology = SPC; verify URL is the reproducibility anchor referenced in the paper.
- **Tier:** Practitioner.

### G2. Systematic literature reviews

- **Who:** Meta-research team.
- **Platform sequence:** Cartridge with the corpus; F1 to design the search/screening protocol; F5 to certify the synthesis spec.
- **Tier:** Architect.

### G3. Grant proposal authoring

- **Who:** PI writing federal / foundation grants.
- **Platform sequence:** Funder requirements as Ingestion input; F5 SPC of the proposed work; F6 the proposal narrative.
- **Tier:** Architect.

### G4. Lab protocol standardisation

- **Who:** Wet lab / engineering lab standardising experimental protocols.
- **Platform sequence:** Each protocol = SPC; the verify URL is referenced in lab notebooks and supplements.
- **Tier:** Practitioner per lab member; Institution for the lab.

---

## FAMILY H — Public sector and civic

### H1. Government RFP / RFQ authoring

- **Who:** Government procurement officer.
- **Platform sequence:** Per D3; Cartridge loaded with the relevant procurement code.
- **Tier:** Architect or Institution.
- **Caution:** No FedRAMP / IL4 / GovCloud posture. Public-sector users must keep classified or controlled-unclassified data off-platform.

### H2. Policy and regulatory spec drafting

- **Who:** Agency staff drafting rules or guidance.
- **Platform sequence:** Stakeholder input as Ingestion; F5 produces the rule SPC; F6 the human-readable rule.
- **Tier:** Institution.

### H3. Civic AI governance frameworks

- **Who:** Municipality designing its own internal AI use policy.
- **Platform sequence:** Reference frameworks (NIST AI RMF, EU AI Act, OECD) as Ingestion; F5 produces the municipality's own policy SPC.
- **Tier:** Institution.

---

## FAMILY I — Community, marketplace, and IP

### I1. Open-source spec libraries

- **Who:** Open-source maintainer publishing reusable SPCs for the community.
- **Platform sequence:** Standard build flow; publish each spec to Sphinx for the public verify URL; community forks into their own sessions.
- **Tier:** Practitioner.

### I2. Industry consortium standards

- **Who:** Consortium maintaining a shared standard library.
- **Platform sequence:** Same as I1 but with consortium governance overlay (which member orgs can amend which SPCs is a governance question the platform does not enforce — manage via your consortium's own bylaws).
- **Tier:** Institution.

### I3. Indie creators monetising prompt IP

- **Who:** Prompt designer / consultant who wants to sell hardened prompts.
- **Platform sequence:** F5 → F6 → F7 produces a certified SPC. Sphinx publish makes it discoverable. Buyers fork into their own session.
- **Tier:** Architect.
- **Why it works:** A SPARTAN cert ID and verify URL is the closest thing to a "this prompt has been peer-reviewed" badge that currently exists.

### I4. Sphinx Marketplace publishing (revenue-share path)

- **Who:** Any creator with publishable certified artifacts.
- **Platform sequence:** Build → publish to Sphinx → marketplace handles discovery, licensing, payment (where configured).
- **Caveat:** The publish endpoint exists in the platform; the marketplace itself is external and only live where `SPHINX_BASE_URL` points somewhere real.

---

## FAMILY J — Internal operations and HR

### J1. Interview rubric and question bank

- **Who:** Hiring manager / talent ops.
- **Platform sequence:** F5 SPC per role profile (rubric + question bank + scorecard); HR uses the same SPC across interviewers; PFP detects rubric drift over time.
- **Tier:** Architect per hiring manager; Institution for HR ops.

### J2. Vendor / tool evaluation templates

- **Who:** Procurement or engineering ops doing structured vendor selection.
- **Platform sequence:** SPC defines the eval criteria; each vendor proposal Ingested and scored against it.
- **Tier:** Architect.

### J3. Runbook / SOP standardisation

- **Who:** Ops / SRE team.
- **Platform sequence:** Each runbook = SPC. Verify URL becomes the canonical reference linked from incident channels.
- **Tier:** Architect per team lead; Team Lite per operator.

### J4. Knowledge-base authoring

- **Who:** Tech writer / support ops.
- **Platform sequence:** Each KB article = certified SPC, ensuring tone and completeness pass JCSE before publication.
- **Tier:** Practitioner.

---

## Cross-cutting capabilities that unlock these use cases

| Capability | Why it matters across families |
|---|---|
| Verify URL | Makes any output independently auditable — works for clients, judges, students, regulators. |
| Cartridge context | Lets a team enforce a single source of authoritative context across many users / sessions. Universally useful. |
| JCSE 7-pillar rubric | Gives every use case a standardised quality score, so quality conversations stop being subjective. |
| Activity log + `/me/costs` | Defensible adoption + spend metrics for any organisational rollout. |
| Cost-cap guard rail (`402 COST_CAP_EXCEEDED`) | Lets finance say yes to broad rollouts without runaway-spend risk. |
| Exemplar library | Lowers the cold-start cost for every use case above. |

## What the platform does NOT do (boundary line, applies across all families)

- Manage projects, sprints, backlogs, time, or money flows.
- Host, deploy, observe, or operate the resulting AI agents.
- Push notifications at cost-cap thresholds (it `402`s at the cap, no warnings before).
- Carry PHI / classified / export-controlled data with regulatory hardening.
- Replace change-management, procurement, legal review, clinical judgment, or scientific peer review.
- Issue diplomas, certificates of attendance, or accredited credentials (verify URLs are not regulatory certifications).
- Run as a multi-agent runtime panel — engine calls are one at a time, one user at a time; "Ultra SI" personas are archetypes in prompts and forks in the exemplar library, not parallel runtime agents.

---

# PART 2 — ONBOARDING VIA *CONTEXT CRAFT*: HOW TO DESIGN THE PER-CHAPTER CHECKPOINT PAGES

The book *Context Craft: The Last Human Skill — The Rise of Cognitive Engineering* is a near-perfect platform onboarding vehicle. Its 7-pillar pedagogy (SYSTEM, ROLE, INSTRUCTION, DATA, CONSTRAINTS, STRUCTURE, VOICE/STANDARD) maps directly onto the 7 pillars that F1's JCSE diagnostic scores, and the book's Chapter 8 "Super Prompt" integration corresponds exactly to running F2 → F5 on the platform for the first time. Chapter 9's economic argument (the $21M discrepancy) corresponds to the `/me/costs` dashboard. Chapter 10+ self-assessment corresponds to the JST self-rating.

The reader of *Context Craft* who finishes the book has already learned everything they need to be productive on the platform — they just don't yet know that the platform is the place where the doctrine becomes operational. A well-designed checkpoint page after each chapter turns the book from "interesting read" into "ten-chapter guided onramp" with the platform as the natural next click.

This section proposes a concrete checkpoint design.

## The book's existing structure (what each chapter already gives you)

Each chapter already follows a 4-part scaffold:

- **Part 1 — STORYLINE** (the narrative anchor; David, Marcus, Victoria, etc.)
- **Part 2 — SAMPLE PROMPTS** (Before & After Architecture)
- **Part 3 — CARD ACTIVATION** (the pillar in context)
- **Part 4 — QUEST CARD** (activate the pillar)
- **CHAPTER BRIDGE — SYNERGY LOOP** (transition to the next chapter)

Add a fifth element — **CHECKPOINT** — between QUEST CARD and CHAPTER BRIDGE. Keep it to exactly one PDF page. The reader's eye is already trained to expect a beat at the end of each chapter; the checkpoint slots in cleanly.

## Single-page checkpoint template (use the same template across all chapters)

```
┌─────────────────────────────────────────────────────────────┐
│  CHECKPOINT · CHAPTER {N}  ·  {PILLAR NAME}                 │
│  Target JCSE for this pillar: {score}/7                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WHAT YOU JUST LEARNED                                      │
│  Two-sentence recap pinned to the storyline (David moved    │
│  from JST 42 to 56 with SYSTEM alone — same pillar that      │
│  F1 will score for you in the next 60 seconds).             │
│                                                             │
│  DO THIS ON THE PLATFORM (5 MIN)                            │
│  1. Go to {short URL or QR code}                             │
│  2. Open the chapter exemplar "{Exemplar Name}" and fork it │
│  3. Edit the {pillar} section with your own example         │
│  4. Run F1. Note the {pillar} pillar score.                  │
│                                                             │
│  YOUR SCORE                                                 │
│  [____]/7 for {PILLAR}    Cumulative JCSE so far: [__]/50   │
│                                                             │
│  STUCK? READ THIS                                           │
│  One-paragraph diagnostic: "If your {pillar} score came in  │
│  below 4, you almost certainly did X. Go back to page Y."   │
│                                                             │
│  WHAT'S NEXT                                                │
│  Chapter {N+1} reveals the next failure mode...             │
│                                                             │
│  [QR CODE]                                  Verify your run │
│                                             at /verify/...   │
└─────────────────────────────────────────────────────────────┘
```

Key design rules behind the template:

1. **One page, no overflow.** A checkpoint that spills onto a second page breaks the chapter rhythm.
2. **5-minute platform task ceiling.** If the reader can't complete the checkpoint in five minutes, fewer will do it. Larger tasks belong in Chapter 8+.
3. **Always the same five sections** (recap · do-this · score · stuck? · what's next). Predictability builds confidence.
4. **The score box is the hook.** Readers will fill in scores compulsively if you give them the box. By Chapter 7 they will *want* to know their cumulative JCSE.
5. **Every checkpoint produces an artifact with a verify URL** — that URL is the reader's portable proof they did the work. By Chapter 8 they have seven of them.

## Chapter-by-chapter content map

| Ch | Pillar | Platform action | Tier needed | Exemplar to fork | Target score |
|---|---|---|---|---|---|
| 1 | SYSTEM | Sign up; fork SYSTEM exemplar; run F1; capture SYSTEM pillar score | Explorer (free) | "SPHINX ULTRA SI" (rich SYSTEM definition) | 5/7 |
| 2 | ROLE | Fork ROLE exemplar; run F1; ROLE pillar score | Explorer | "ATLAS ULTRA SI" (sharp role anchor) | 5/7 |
| 3 | INSTRUCTION | Same flow, INSTRUCTION pillar | Explorer | "SPARTAN" (instructional precision) | 5/7 |
| 4 | DATA | Fork an exemplar **and** upload one document as your first mini-Cartridge ($0 dry-run — let the reader see the cartridge fence in their own session) | Practitioner | "TITAN ULTRA SI" | 5/7 |
| 5 | CONSTRAINTS | Run F1 on a deliberately under-constrained prompt; observe the pillar flag | Practitioner | "GAMEMXT ULTRA SI" | 4/7 (this is the hardest pillar; calibrate the bar lower) |
| 6 | STRUCTURE | Run F4 (Micro PDD) on the prompt you've been building | Practitioner | Any chapter exemplar | 5/7 |
| 7 | VOICE / STANDARD | Run F1 on your prompt with a deliberate "house voice" instruction; observe the VOICE pillar score | Practitioner | "Editorial voice" exemplar (purpose-built for the book) | 5/7 |
| 8 | INTEGRATION (Super Prompt) | First full F2 → F3 → F5 run. The reader produces their first 15-section SPC and a SILVER or GOLD cert. **This is the moment to convert Explorer → Architect.** | Architect ($199/mo) | Their own work | JCSE total ≥ 35/50 |
| 9 | ECONOMICS | Tour `/me/costs`; run F7 to produce a SPARTAN-certified MVP PDD with a verify URL; share the URL with one peer | Architect | — | Cert SILVER+ |
| 10 | SELF (JST) | Run the JST self-assessment (in-book worksheet; results feed into the user's exemplar library annotation) | — | — | JST baseline captured |
| 11 | TEAM | (If the book covers team adoption) Create an org; invite one teammate; run a session together | Team Lite seat | — | First org-visible session |
| 12 | CAPSTONE | F8 Code DJ on the SPC built in Chapter 8; PFP for drift; readers leaves with running scaffolded code | Architect | — | F8 produced + PFP green |

## The "Workbook" companion (recommended pull-out)

Bind a 16-page perforated workbook at the back of the book containing:

- A **JCSE running-score sheet** (one box per chapter, plus a "cumulative" running total).
- A **JST self-assessment** with cut-out scoring grid (tied to Chapter 10).
- A **session-log table** the reader fills in as they go (chapter · session ID · verify URL · date · score).
- A final **certification page** the reader can scan and submit to claim a "Context Craft Practitioner" badge on the platform (this requires a small platform feature — see "Platform changes to support this onboarding" below).

The workbook is the physical artefact that links the book to the platform: when readers complete it, they have demonstrably run the whole pipeline.

## Voice and tone of the checkpoints (match the book)

The book's voice is direct, sometimes confrontational, anchored in concrete dollar-impact stories (David's $21M, Marcus's $200M). Match it:

- **Direct second-person.** "Go to the platform. Run F1. Look at your score." Not "users can optionally navigate to..."
- **Stakes-anchored.** "The CONSTRAINTS pillar is where Marcus lost $23 million. You're going to score yourself on it in the next four minutes."
- **Honest about difficulty.** "Most readers score 3/7 on STRUCTURE the first time. So did David. Run it again."
- **No platform jargon in the checkpoint body.** "F1" is fine (the book teaches the F-numbers); but no "endpoint" / "schema" / "Stripe" — those leak the implementation and break the reader's flow.

## Pacing and reader friction

Empirical pattern from similar book-to-platform onramps:

- **Chapters 1–3:** ~40% of readers will do the checkpoints in real time. Keep these the easiest possible (Explorer tier only; pure fork-and-run).
- **Chapters 4–7:** Drops to ~20% completing in real time. This is fine — the workbook captures asynchronous completion.
- **Chapter 8:** This is the conversion event (Explorer → Architect $199/mo). The checkpoint must feel like a meaningful milestone — getting the first SILVER cert. Design accordingly: bigger box, optional callout, "your first certified artifact." Consider a Practitioner trial offer ($49/mo, 14-day) that ramps to Architect after Chapter 8.
- **Chapter 12:** This is the moment to ask for a referral / community signup. The reader has produced running code. They will share if asked.

## Platform changes recommended to support this onboarding

These are small platform additions that would make the book-to-platform flow materially stronger:

1. **"Onboarding tracks" feature.** A track ID (`context_craft_v1`) the user can claim on signup that pre-loads the right exemplar at each F1 run and auto-tallies the per-pillar score in their dashboard. Without this, readers track manually in the workbook — works, but loses the dashboard pleasure.
2. **A "claim my book progress" page.** Reader uploads a photo of the completed workbook → platform marks the user as a "Context Craft Practitioner" and surfaces a badge on their public profile / verify URLs. Cheap to build, high emotional payoff.
3. **A book-specific Cartridge.** A free Cartridge containing the seven worked examples from the book, available to any reader. Eliminates the cold-start for Chapter 1.
4. **A book-cohort discount SKU.** Promo code printed inside the book back cover → 50% off Architect for the first three months. Conversion lever for Chapter 8.
5. **A per-pillar exemplar exemplar library** explicitly curated for teaching. The current exemplar library is curated for builders; for learners, you want each exemplar to be a high-leverage demonstration of one pillar at near-perfect score, with the other pillars deliberately neutral.

These five changes are each ~1–2 weeks of platform work. None require new engines.

## What success looks like

If the checkpoint pages are designed as above:

- **Read-through completion** (reader finishes Chapter 12): held by the book's existing pull, not changed.
- **Platform signup conversion** (reader creates an account): targets ~20–30% of readers — the Chapter 1 checkpoint is the gateway.
- **Pillar-score reporting** (reader completes ≥ one F1 run): targets ~15–20%.
- **Paid conversion at Chapter 8** (Explorer/Practitioner → Architect): targets ~5–8% of total readers, ~25–35% of those who reached Chapter 8 on-platform.
- **F8-run completion** (reader produces scaffolded code via Chapter 12 capstone): targets ~2–3% of total readers — small but extremely high-value, because these readers become the platform's reference customers.

The numbers are achievable because the book and the platform are doing complementary work: the book is teaching the *why* and the *what*; the checkpoint pages convert each chapter's *what* into a five-minute hands-on *how*; the platform delivers the proof-of-work artifact (verify URL) that closes the loop. Without the checkpoints, the book is a great book; with them, it becomes the platform's most effective onboarding asset and a durable revenue lever for years.

---

*End of guide.*

*Generated against ATANDA Command Centre platform state, May 2026, and against the *Context Craft: The Last Human Skill* manuscript (12 chapters, prologue + 2 epilogues).*
