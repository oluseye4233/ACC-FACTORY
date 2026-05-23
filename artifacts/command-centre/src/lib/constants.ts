export const ENGINES = [
  {
    id: 1,
    name: "F1",
    title: "PROMPT DIAGNOSTIC",
    description: "Diagnose raw ideas into Atomic Prompts",
    explainer:
      "Scores your raw idea on the 7-pillar JCSE rubric (Specificity, Role, Intent, Domain, Format, Examples, Constraints) and tells you exactly which dimensions to tighten before moving on.",
  },
  {
    id: 2,
    name: "F2",
    title: "ATOMIC PROMPT",
    description: "Refine Atomic Prompts into Micro Agent (MA) Birth Packages",
    explainer:
      "Rewrites the diagnosed prompt into a single, atomic, executable instruction with explicit role, intent, constraints, and acceptance criteria — the unit every downstream engine consumes.",
  },
  {
    id: 3,
    name: "F3",
    title: "MA BIRTH PACKAGE",
    description: "Grow Micro Agent (MA) Birth Packages into Micro PDDs",
    explainer:
      "Streams a CELL Micro Agent Birth Package: persona, capabilities, guardrails, and the minimum context window needed for the agent to behave reproducibly. May escalate to F5 if scope exceeds a single agent.",
  },
  {
    id: 4,
    name: "F4",
    title: "MICRO PDD",
    description: "Expand Micro PDDs into full SPCs",
    explainer:
      "Converts the MA Birth Package into a Micro PDD — a compact, deploy-shaped Product Design Document for a single agent or feature, ready to be lifted into a full SPC.",
  },
  {
    id: 5,
    name: "F5",
    title: "SPC",
    description: "Draft 4-Part ATLAS PDDs from SPCs",
    explainer:
      "Builds a full Super Prompt Cartridge — the interactive, multi-section specification a senior operator would hand to a build team. Practitioner-tier and above.",
  },
  {
    id: 6,
    name: "F6",
    title: "ATLAS PDD",
    description: "Draft ATLAS PDDs from scratch or SPCs",
    explainer:
      "Drafts the 4-Part ATLAS PDD (Cheat Sheet · Exec Summary · Worksheet · Implementation) — the investor- and engineer-grade document the SPC has been earning its way toward.",
  },
  {
    id: 7,
    name: "F7",
    title: "MVP PDD",
    description: "SPARTAN-compress into certified MVP PDDs",
    explainer:
      "Streams the SPARTAN compressor: math-audited rubric pass, scope/risk lock, and a public verification URL stamped onto the certified MVP PDD (PWDD for ingested / cartridge sessions).",
  },
  {
    id: 8,
    name: "F6-VDJ",
    title: "VDJ",
    description: "Recommend IDEs and vibes for ATLAS PDDs",
    explainer:
      "Side-step engine. Reads your ATLAS PDD and recommends the IDE, coding vibe, and tool-chain best suited to actually build it. Does not block the F1 → F7 sequence.",
  },
  {
    id: 9,
    name: "F8",
    title: "CODE DJ",
    description: "Architect-only — scaffold a complete codebase from a certified MVP PDD / PWDD",
    explainer:
      "Architect-tier only. Consumes a SPARTAN-certified MVP PDD / PWDD and emits a CODEBASE_BUNDLE — up to 12 files plus a manifest, scaffolded against your chosen platform. Refuses any uncertified input.",
  },
];
