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
    title: "MA BIRTH PACKAGE",
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
];
