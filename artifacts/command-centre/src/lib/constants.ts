export type FProcessStatus = "operational" | "contract_defined";

export interface FProcessRole {
  id: "F0" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F9.5" | "F10";
  title: string;
  description: string;
  status: FProcessStatus;
}

export const F_PROCESS_ROLES: FProcessRole[] = [
  {
    id: "F0",
    title: "ADVISORY / SOLVA",
    description: "Advisory layer and SOLVA return point for deviations.",
    status: "operational",
  },
  {
    id: "F1",
    title: "JCSE DIAGNOSIS",
    description: "Diagnose raw ideas against the 7-pillar JCSE rubric.",
    status: "operational",
  },
  {
    id: "F2",
    title: "ATOMIC PROMPT",
    description: "Create executable Atomic Prompts.",
    status: "operational",
  },
  {
    id: "F3",
    title: "CELL MICRO AGENT",
    description: "Build a CELL Micro Agent birth package.",
    status: "operational",
  },
  {
    id: "F4",
    title: "MICRO PDD",
    description: "Create Audit and Specification documentation (Micro PDD).",
    status: "operational",
  },
  {
    id: "F5",
    title: "SPC",
    description: "Build a Super Prompt Card (SPC) system contract.",
    status: "operational",
  },
  {
    id: "F6",
    title: "ATLAS PDD",
    description: "Draft an ATLAS PDD for comprehensive audit and implementation.",
    status: "operational",
  },
  {
    id: "F7",
    title: "SPARTAN",
    description: "SPARTAN compression and MVP PDD certification.",
    status: "operational",
  },
  {
    id: "F8",
    title: "CODE DJ",
    description: "CODE DJ codebase/IDE handoff and implementation generation.",
    status: "operational",
  },
  {
    id: "F9",
    title: "MECHA ULTRA SI",
    description: "Contract-defined Machine Floor emitting bounded/versioned/signed Machine Artifact or refusal.",
    status: "operational",
  },
  {
    id: "F9.5",
    title: "OSIRIS",
    description: "Contract-defined custody/continuous monitoring routing deviations through SOLVA to F0.",
    status: "operational",
  },
  {
    id: "F10",
    title: "CONNECTOR",
    description: "Contract-defined gateway for authorized release of immutable F9 artifacts with auditable delivery receipts.",
    status: "operational",
  },
];

export const ENGINES = [
  {
    id: 1,
    name: "F1",
    title: "PROMPT DIAGNOSTIC",
    description: "Diagnose raw ideas into Atomic Prompts",
    explainer:
      "Scores your raw idea against the 7-pillar JCSE rubric (SYSTEM, ROLE, INSTRUCTION, EXAMPLE, CONSTRAINT, FORMAT, DATA) and tells you exactly which dimensions to tighten before moving on.",
  },
  {
    id: 2,
    name: "F2",
    title: "ATOMIC PROMPT",
    description:
      "Create Single purpose Molecular Agent specifications, the building blocks of Cognitive Engineering",
    explainer:
      "Rewrites the diagnosed prompt into a single, atomic, executable instruction with explicit role, intent, constraints, and acceptance criteria — the unit every downstream engine consumes.",
  },
  {
    id: 3,
    name: "F3",
    title: "MOLECULAR AGENT CREATOR",
    description:
      "Build a single purpose Ai Agent Specification (Ai DNA) by yourself called a Molecular Agent (MA)",
    explainer:
      "Streams a CELL Micro Agent Birth Package: persona, capabilities, guardrails, and the minimum context window needed for the agent to behave reproducibly. May escalate to F5 if scope exceeds a single agent.",
  },
  {
    id: 4,
    name: "F4",
    title: "MICRO PDD",
    description:
      "Create Audit and Specification documentation for your Molecular Agent called a Micro PromptWare Design Document (MPDD)",
    explainer:
      "Converts the MA Birth Package into a Micro PDD — a compact, deploy-shaped Product Design Document for a single agent or feature, ready to be lifted into a full SPC.",
  },
  {
    id: 5,
    name: "F5",
    title: "SPC",
    description:
      "Create a Single Agent with Embedded Ethical frameworks, Industry Complaince and deep Industry knowledge called a Super Prompt Card (SPC)",
    explainer:
      "Builds a full Super Prompt Card (SPC) — the interactive, multi-section specification a senior operator would hand to a build team. Practitioner-tier and above.",
  },
  {
    id: 6,
    name: "F6",
    title: "ATLAS PDD",
    description:
      "Draft a comprehensive Audit and Requirements document of your Super Prompt Card and also obtain a technical recommendation of how to build it",
    explainer:
      "Drafts the 4-Part ATLAS PDD (Cheat Sheet · Exec Summary · Worksheet · Implementation) — the investor- and engineer-grade document the SPC has been earning its way toward.",
  },
  {
    id: 7,
    name: "F7",
    title: "MVP PDD",
    description:
      "Creat an Minimum Viable Product (MVP) requirement document and handover to your tech team",
    explainer:
      "Streams the SPARTAN compressor: math-audited rubric pass, scope/risk lock, and a public verification URL stamped onto the certified MVP PDD (PWDD for ingested / cartridge sessions).",
  },
  {
    id: 8,
    name: "F6-VDJ",
    title: "BUILD INSTRUCTIONS",
    description:
      "VIBE ORACLE recommends the IDE + coding vibe for your ATLAS PDD; HOST ORACLE ranks deployment hosts for your certified MVP PDD. Exportable as a build brief.",
    explainer:
      "Side-step page combining the two advisory mixers — VIBE ORACLE (F6-VDJ) reads your ATLAS PDD to recommend the IDE, coding vibe, and tool-chain; HOST ORACLE (F8-HDJ) ranks deployment hosts from your certified MVP PDD. Export both as a single BUILD INSTRUCTIONS brief. Does not block the F1 → F7 sequence.",
  },
  {
    id: 9,
    name: "F8",
    title: "CODE ORACLE",
    description: "Architect-only — scaffold a complete codebase from a certified MVP PDD / PWDD",
    explainer:
      "Architect-tier only. Consumes a SPARTAN-certified MVP PDD / PWDD and emits a CODEBASE_BUNDLE — up to 12 files plus a manifest, scaffolded against your chosen platform. Refuses any uncertified input.",
  },
  {
    id: 10,
    name: "MM",
    title: "MATHMON LAYER",
    description:
      "Profile a session's measurable variables (F0.5) and build its Mathematical Applicability Profile (MAP) to compute the MATHMON score behind the FORGE VERIFIED gate.",
    explainer:
      "Math-verification side-step. F0.5 intake extracts measurable variables, constraints, and optimisation targets; the MAP scores math coherence, applicability, and predictive reliability into a single MATHMON score. FORGE VERIFIED requires JCSE ≥ 45 AND MATHMON ≥ 70 at F7. Advisory — does not block the F1 → F7 sequence.",
  },
  {
    id: 11,
    name: "F9",
    title: "MECHA MACHINE FLOOR",
    description: "Turn an approved F8 lineage into a bounded, signed Machine Artifact or cited refusal.",
    explainer:
      "Runs the seven ordered MECHA phases. F9 is locked until a SPARTAN-certified MVP PDD and its downstream F8 Code Oracle lineage are present in this session.",
  },
];
