import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import {
  BookOpen,
  FileText,
  ArrowRight,
  Download,
  LayoutDashboard,
  Workflow,
  Briefcase,
  Upload,
  Disc3,
  Library,
  ScrollText,
  Trophy,
  Mountain,
  History,
  Wallet,
  UserCog,
  BadgeCheck,
} from "lucide-react";
import video48HourDivergence from "@assets/The_48-Hour_Divergence_1779502673339.mp4";
import videoForgeFactoryFloor from "@assets/FORGE_Factory_Floor_1779502866103.mp4";
import videoIntelligenceAsset from "@assets/The_Intelligence_Asset__Beyond_the_Code_Barrier_1779539479111.mp4";
import videoRiskToRigor from "@assets/ATANDA__Risk_to_Rigor_1779543682393.mp4";
import videoHarnessEngineering from "@assets/Harness_Engineering_1779544662971.mp4";
import videoEngineeringClinicalIntuition from "@assets/Engineering_Clinical_Intuition_1780237497894.mp4";
import videoSolvingTheCodeGap from "@assets/Solving_The_Code_Gap_1780266687323.mp4";
import paperInstrumentingCognition from "@assets/Instrumenting_Cognition_1779502799785.pdf";
import paperAtandaCommandCentre from "@assets/ATANDA_Command_Centre_1779502924595.pdf";
import paperCognitiveMint from "@assets/The_Cognitive_Mint_1779539510121.pdf";
import paperDeterministicVault from "@assets/The_Deterministic_Vault_1779543698477.pdf";
import paperHarnessEngineeringBlueprint from "@assets/Harness_Engineering_Blueprint_1779544662970.pdf";
import paperEngineeringClinicalIntuition from "@assets/Engineering_Clinical_Intuition_1780237497892.pdf";
import paperRiseOfCognitiveEngineering from "@assets/The_Rise_of_Cognitive_Engineering_1780266687323.pdf";
import shotCommand from "@assets/guide/command.png";
import gifCommand from "@assets/guide/command.gif";
import shotSessions from "@assets/guide/sessions.png";
import gifSessions from "@assets/guide/sessions.gif";
import shotF0 from "@assets/guide/f0.png";
import gifF0 from "@assets/guide/f0.gif";
import shotIngest from "@assets/guide/ingest.png";
import shotCartridge from "@assets/guide/cartridge.png";
import shotExemplars from "@assets/guide/exemplars.png";
import shotPrompts from "@assets/guide/prompts.png";
import shotQuests from "@assets/guide/quests.png";
import shotAscension from "@assets/guide/ascension.png";
import gifAscension from "@assets/guide/ascension.gif";
import shotActivity from "@assets/guide/activity.png";
import shotCosts from "@assets/guide/costs.png";
import shotAccount from "@assets/guide/account.png";
import shotVerify from "@assets/guide/verify.png";
import shotSpcPlayer from "@assets/guide/command.png"; // Fallback to command.png
import shotAtlas360 from "@assets/guide/sessions.png"; // Fallback to sessions.png

const VIDEOS = [
  {
    src: video48HourDivergence,
    title: "The 48-Hour Divergence",
    blurb:
      "What two days inside the HARNESS looks like — from a fuzzy idea to a SPARTAN-certified MVP PDD.",
  },
  {
    src: videoForgeFactoryFloor,
    title: "FORGE Factory Floor",
    blurb:
      "A look at the engine bay: the solid F1–F7 production rail and F8 post-certification build branch.",
  },
  {
    src: videoIntelligenceAsset,
    title: "The Intelligence Asset — Beyond the Code Barrier",
    blurb:
      "Why a SPARTAN-certified PDD is the asset, and the codebase is just one expression of it.",
  },
  {
    src: videoRiskToRigor,
    title: "ATANDA — Risk to Rigor",
    blurb:
      "How the HARNESS turns ambiguous build risk into auditable, certified engineering rigor.",
  },
  {
    src: videoHarnessEngineering,
    title: "Harness Engineering",
    blurb:
      "Inside the engineering of the FORGE.BONSAI HARNESS — how the engine bay is wired end-to-end.",
  },
  {
    src: videoEngineeringClinicalIntuition,
    title: "Engineering Clinical Intuition",
    blurb:
      "How the HARNESS encodes expert clinical intuition into reproducible, auditable cognitive assets.",
  },
  {
    src: videoSolvingTheCodeGap,
    title: "Solving The Code Gap",
    blurb:
      "Why the gap between intent and code is the real bottleneck — and how the HARNESS closes it with certified specs.",
  },
] as const;

const PUBLICATIONS = [
  {
    href: paperInstrumentingCognition,
    title: "Instrumenting Cognition",
    blurb:
      "The doctrine behind JCSE scoring, telemetry, and why every engine call is instrumented.",
  },
  {
    href: paperAtandaCommandCentre,
    title: "ATANDA Command Centre",
    blurb:
      "Operator portal spec: tiers, on-ramps, badges, and the certified MVP-PDD pipeline.",
  },
  {
    href: paperCognitiveMint,
    title: "The Cognitive Mint",
    blurb:
      "Why a SPARTAN-certified PDD is the mintable intelligence asset — and the codebase is a downstream artefact.",
  },
  {
    href: paperDeterministicVault,
    title: "The Deterministic Vault",
    blurb:
      "How the HARNESS locks every engine pass into an auditable, reproducible vault of evidence.",
  },
  {
    href: paperHarnessEngineeringBlueprint,
    title: "Harness Engineering Blueprint",
    blurb:
      "The engineering blueprint behind the FORGE.BONSAI HARNESS — engines, contracts, and the production line.",
  },
  {
    href: paperEngineeringClinicalIntuition,
    title: "Engineering Clinical Intuition",
    blurb:
      "The doctrine for converting tacit clinical intuition into instrumented, certifiable engineering rigor.",
  },
  {
    href: paperRiseOfCognitiveEngineering,
    title: "The Rise of Cognitive Engineering",
    blurb:
      "The manifesto for cognitive engineering — why governing how models think is the discipline that defines the next era of building.",
  },
] as const;

type Walkthrough = {
  id: string;
  icon: typeof LayoutDashboard;
  title: string;
  route: string;
  routeLabel: string;
  tagline: string;
  steps: readonly string[];
  /** Real screenshot of the live workspace. */
  shot: string;
  /** Optional animated scroll-through of the live workspace. */
  gif?: string;
};

const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: "command",
    icon: LayoutDashboard,
    title: "COMMAND DECK",
    route: "/command",
    routeLabel: "Open Command Deck",
    tagline: "Your home base — engine status, recent sessions, and quest badges at a glance.",
    steps: [
      "Land on the deck after the front door: it shows the engine bay status and your most recent sessions.",
      "Use the session cards to jump straight back into a run at the exact engine where you left off.",
      "Watch the badge strip — quest badges earned by real engine work surface here as you progress.",
      "Start something new from here at any time: a fresh session, an ingestion, or a cartridge run.",
    ],
    shot: shotCommand,
    gif: gifCommand,
  },
  {
    id: "sessions",
    icon: Workflow,
    title: "SESSIONS · ATOMIC UI & THE PRODUCTION LINE",
    route: "/session/new",
    routeLabel: "Start a Session",
    tagline:
      "One coherent run from raw idea to certified MVP PDD, now driven by the ATOMIC UI Stage Cockpit.",
    steps: [
      "Open Sessions and hit NEW SESSION. The ATOMIC UI stage cockpit focuses on one clear action at a time, keeping the engine under the hood.",
      "The linear track guides you F1 → F7. The left column shows where you came from, the center what you are doing now, and the right where you are going next.",
      "Advance engine by engine. Each workspace streams its output live; completed results are persisted and waiting in the session artifacts tray.",
      "At F7, the SPARTAN compressor certifies the MVP PDD and stamps a public verification URL.",
      "Architect-grade finish: run F8 CODE ORACLE on the certified spec to scaffold a runnable codebase — export as ZIP, IDE bundle, or push straight to GitHub."
    ],
    shot: shotSessions,
    gif: gifSessions,
  },
  {
    id: "atlas360",
    icon: LayoutDashboard,
    title: "ATLAS 360 · PLAN & SCAN VIEWS",
    route: "/session/new",
    routeLabel: "Start a Session",
    tagline:
      "Generate structured execution plans or assurance audit profiles directly from your PDD.",
    steps: [
      "From a session containing a generated PDD, open the ATLAS 360 View panel in the workspace.",
      "Select PLAN to generate a 12-part technical execution plan for builders.",
      "Select SCAN to generate an 8-stage assurance audit profile for governance and compliance.",
      "Export the generated views as one ZIP containing both Markdown and JSON files for external workflows."
    ],
    shot: shotAtlas360,
  },
  {
    id: "f0",
    icon: Briefcase,
    title: "F0 ADVISORY",
    route: "/f0",
    routeLabel: "Open F0 Advisory",
    tagline:
      "The boutique business-intelligence layer: discovery, viability analysis, advisory reports, and always-on retainer monitoring.",
    steps: [
      "Create an engagement and complete the SOCRATES discovery interview — all seven questions must be answered before any report can run.",
      "Pick an advisory service (viability, market, risk, and the ULTRA SI high-level services) and generate the report — it streams live and persists even if you close the tab.",
      "Each delivered report mints a verification code anchored to the engagement's artifact SKU.",
      "Activate a retainer to enroll the engagement in the weekly monitoring sweep.",
      "Breaches surface as OPEN alerts on the dashboard banner (and email, if enabled) — review and acknowledge them to clear the queue.",
    ],
    shot: shotF0,
    gif: gifF0,
  },
  {
    id: "ingest",
    icon: Upload,
    title: "INGESTION · IPDD → PWDD",
    route: "/ingest",
    routeLabel: "Open Ingestion",
    tagline:
      "Already have a design document? Feed it in and let the HARNESS certify it.",
    steps: [
      "Upload or paste the document you already have — an IPDD (Ingestion Product Design Document): a PDD, SDD, concept note, spec sheet, or brief.",
      "The ingestion engine parses it and seeds a session pre-loaded with your document's substance.",
      "Run the seeded session down the standard F1 → F7 line.",
      "Because the session originated from ingestion, F7 certifies a PWDD — a PromptWare Design Document — instead of a regular MVP PDD.",
    ],
    shot: shotIngest,
  },
  {
    id: "cartridge",
    icon: Disc3,
    title: "CARTRIDGE",
    route: "/cartridge",
    routeLabel: "Open Cartridge",
    tagline:
      "Pre-built engine configurations that boot a session with a specialized head start.",
    steps: [
      "Browse the cartridge library — each cartridge is a curated, domain-tuned starting configuration.",
      "Slot a cartridge to spin up a session pre-configured with its domain context.",
      "Run the standard engine line from there; the cartridge origin travels with the session through certification.",
    ],
    shot: shotCartridge,
  },
  {
    id: "exemplars",
    icon: Library,
    title: "EXEMPLARS",
    route: "/exemplars",
    routeLabel: "Browse Exemplars",
    tagline: "Canonical, high-performing SPCs and PDDs to study — or fork.",
    steps: [
      "Browse the library of certified exemplar specs, including both canonical HARNESS references and staff-contributed assets.",
      "Upload your own files (SPC, MA, MPDD, PDD) to the open backend marketplace to share with other operators.",
      "Open any exemplar to read the full document the way a build team would receive it.",
      "Hit FORK TO SESSION to clone an exemplar into your own session and evolve it from a proven baseline.",
    ],
    shot: shotExemplars,
  },
  {
    id: "spc-player",
    icon: Workflow,
    title: "SPC PLAYER",
    route: "/spc-player",
    routeLabel: "Open SPC Player",
    tagline:
      "Open-access, plan-first cockpit for executing capability briefs and producing reviewable packages.",
    steps: [
      "Register a new capability brief by defining the project title, operational context, and selecting required capability cards from the Dev Kit registry.",
      "Execute the run without a tier, entitlement, credit, billing, or LLM gate.",
      "Download the final JSON package with separate clarity, truthfulness, and detectability figures.",
      "Optionally authorize a public HTTPS webhook for that run, then deliver the package. Environment sketches are documentation, not live integrations."
    ],
    shot: shotSpcPlayer,
  },
  {
    id: "prompts",
    icon: ScrollText,
    title: "PROMPTS",
    route: "/prompts",
    routeLabel: "Open Prompts",
    tagline: "Your personal library of prompts and atomic outputs.",
    steps: [
      "Every Atomic Prompt the engines produce for you is collected here.",
      "Reuse a saved prompt as the seed of a new session instead of starting from a blank line.",
    ],
    shot: shotPrompts,
  },
  {
    id: "quests",
    icon: Trophy,
    title: "QUESTS & BADGES",
    route: "/quests",
    routeLabel: "Open Quests",
    tagline: "Achievement track earned by real engine work — never self-reported.",
    steps: [
      "Open the quest board to see every badge and its earning condition.",
      "Badges are granted automatically by real signals — certified runs, engine milestones, streaks.",
      "Senior badges unlock Context Craft privileges as you climb.",
    ],
    shot: shotQuests,
  },
  {
    id: "ascension",
    icon: Mountain,
    title: "ASCENSION PROTOCOL",
    route: "/ascension",
    routeLabel: "Open Ascension",
    tagline:
      "The 13-rung onboarding journey, spined on *The Atomic Prompt* — every rung proven by real signals.",
    steps: [
      "Open the ladder to see all 13 rungs and what each one requires.",
      "Rungs are proven automatically by badges, artifacts, engine runs, and org activity — there is nothing to self-report.",
      "Book readers: redeem your reader code under onboarding to switch to the Atomic Prompt track.",
      "Optionally import your JST score from ARK ONECRAFT instead of the in-app self-assessment.",
    ],
    shot: shotAscension,
    gif: gifAscension,
  },
  {
    id: "activity",
    icon: History,
    title: "ACTIVITY LOG",
    route: "/me/activity",
    routeLabel: "Open Activity",
    tagline: "A chronological audit trail of everything you have run.",
    steps: [
      "Review every engine call, session event, and artifact you have produced, in order.",
      "Use it to reconstruct exactly how a certified document earned its certification.",
    ],
    shot: shotActivity,
  },
  {
    id: "costs",
    icon: Wallet,
    title: "COSTS",
    route: "/me/costs",
    routeLabel: "Open Costs",
    tagline: "Live LLM spend telemetry against the company-wide monthly cap.",
    steps: [
      "Watch your own engine spend accumulate per run, per engine, per month.",
      "The company-wide monthly cost cap guards the whole floor — when it is reached, engines pause until the month resets.",
    ],
    shot: shotCosts,
  },
  {
    id: "account",
    icon: UserCog,
    title: "ACCOUNT & CONNECTED SERVICES",
    route: "/account",
    routeLabel: "Open Account",
    tagline: "Profile, notification preferences, and external connections.",
    steps: [
      "Set your notification preferences — including F0 retainer alert emails.",
      "Connect GitHub (one-click OAuth or a pasted token) to enable F8's push-to-GitHub delivery channel.",
      "Connect Sphinx to enable marketplace publishing when the channel is live.",
    ],
    shot: shotAccount,
  },
  {
    id: "verify",
    icon: BadgeCheck,
    title: "PUBLIC VERIFICATION",
    route: "/verify",
    routeLabel: "Open Verify",
    tagline:
      "The public trust anchor — anyone with a certificate URL can validate it, no login required.",
    steps: [
      "Every SPARTAN-certified document and F0 report carries a verification code and public URL.",
      "Paste a code (or follow a stamped URL) to confirm the artifact is genuine, unaltered, and certified.",
      "This page stays public even behind the staff front door — hand the URL to anyone.",
    ],
    shot: shotVerify,
  },
] as const;

const QUICK_NAV = [
  { href: "#role-model", label: "ATANDA SITE MAP" },
  { href: "#walkthroughs", label: "FEATURE WALKTHROUGHS" },
  { href: "#videos", label: "VIDEOS" },
  { href: "#publications", label: "PUBLICATIONS" },
] as const;

type StageDetail = {
  id: string;
  title: string;
  purpose: string;
  input: string;
  process: string;
  output: string;
  gate: string;
  handoff: string;
  type: 'advisory' | 'rail' | 'build' | 'machine' | 'custody' | 'release';
};

const SYSTEM_STAGES: StageDetail[] = [
  {
    id: "F0",
    title: "ADVISORY / SOLVA",
    purpose: "Upstream business intelligence and the return point for OSIRIS deviations.",
    input: "Raw ideas, market thesis, or returning OSIRIS deviations.",
    process: "SOCRATES discovery opens the engagement; a 9-SPC ensemble authors reports with a SOLVA bear case.",
    output: "Advisory report, financial ranges, and viability thesis.",
    gate: "Non-suppressible Honesty Gate.",
    handoff: "F1 for execution or F0 Retainer for monitoring.",
    type: "advisory"
  },
  {
    id: "F1",
    title: "JCSE DIAGNOSIS / PROMPT DIAGNOSTIC",
    purpose: "Diagnose raw ideas against the 7-pillar JCSE rubric.",
    input: "Raw intent or prompt.",
    process: "Scores intent across SYSTEM, ROLE, INSTRUCTION, EXAMPLE, CONSTRAINT, FORMAT, DATA.",
    output: "Diagnosed baseline with explicit tightening recommendations.",
    gate: "Identifies fatal ambiguities before engineering begins.",
    handoff: "F2 Atomic Prompt.",
    type: "rail"
  },
  {
    id: "F2",
    title: "ATOMIC PROMPT",
    purpose: "Create executable Atomic Prompts.",
    input: "Diagnosed intent from F1.",
    process: "Rewrites into a single, atomic, executable instruction with explicit role, intent, and constraints.",
    output: "Atomic Prompt.",
    gate: "Must be a singular, bounded instruction.",
    handoff: "F3 Micro Agent Creator.",
    type: "rail"
  },
  {
    id: "F3",
    title: "CELL MICRO AGENT / MOLECULAR AGENT CREATOR",
    purpose: "Build a CELL Micro Agent birth package.",
    input: "Atomic Prompt.",
    process: "Expands the atomic instruction into persona, capabilities, guardrails, and context window requirements.",
    output: "CELL Micro Agent Birth Package.",
    gate: "Validates if scope remains a micro-agent or escalates.",
    handoff: "F4 Micro PDD.",
    type: "rail"
  },
  {
    id: "F4",
    title: "MICRO PDD / MPDD",
    purpose: "Create Audit and Specification documentation (Micro PDD).",
    input: "CELL Micro Agent Birth Package.",
    process: "Converts the birth package into a compact, deploy-shaped Product Design Document.",
    output: "Micro PDD / MPDD.",
    gate: "Architect-ready micro-specification verification.",
    handoff: "F5 SPC.",
    type: "rail"
  },
  {
    id: "F5",
    title: "SPC",
    purpose: "Build a Super Prompt Card (SPC) system contract.",
    input: "Micro PDD.",
    process: "Assembles the interactive, multi-section specification incorporating embedded ethical frameworks and compliance.",
    output: "Super Prompt Card (SPC).",
    gate: "Practitioner-tier required.",
    handoff: "F6 ATLAS PDD.",
    type: "rail"
  },
  {
    id: "F6",
    title: "ATLAS PDD",
    purpose: "Draft an ATLAS PDD for comprehensive audit and implementation.",
    input: "SPC.",
    process: "Drafts the 4-Part ATLAS PDD (Cheat Sheet, Exec Summary, Worksheet, Implementation).",
    output: "ATLAS PDD.",
    gate: "Ready for technical recommendation overlay.",
    handoff: "F7 SPARTAN.",
    type: "rail"
  },
  {
    id: "F7",
    title: "SPARTAN",
    purpose: "SPARTAN compression and MVP PDD certification.",
    input: "ATLAS PDD.",
    process: "SPARTAN compressor executes a math-audited rubric pass and scope/risk lock.",
    output: "Certified MVP PDD (or PWDD if ingested).",
    gate: "SPARTAN Certification (JCSE ≥ 45, MATHMON ≥ 70). Public verification URL stamped.",
    handoff: "F8 for Build or F9 for Machine Floor.",
    type: "rail"
  },
  {
    id: "F8",
    title: "CODE ORACLE / CODE DJ",
    purpose: "Codebase/IDE handoff and implementation generation.",
    input: "SPARTAN-certified MVP PDD / PWDD.",
    process: "Scaffolds a complete codebase against a chosen platform.",
    output: "CODEBASE_BUNDLE (up to 12 files + manifest).",
    gate: "Refuses uncertified input. Architect-tier only.",
    handoff: "F9 MECHA ULTRA SI.",
    type: "build"
  },
  {
    id: "F9",
    title: "MECHA ULTRA SI MACHINE FLOOR",
    purpose: "Emit bounded, versioned, signed Machine Artifact or refusal.",
    input: "Certified F7 MVP PDD + approved F8 lineage.",
    process: "Executes the seven ordered MECHA phases to compile verified assets.",
    output: "Immutable, bounded, signed Machine Artifact or refusal.",
    gate: "Locked until F7 certification and F8 lineage are present.",
    handoff: "F9.5 OSIRIS Custody.",
    type: "machine"
  },
  {
    id: "F9.5",
    title: "OSIRIS",
    purpose: "OSIRIS custody and continuous monitoring.",
    input: "Signed F9 Machine Artifact.",
    process: "Envelops the F9 artifact in continuous custody, performing attestation checks. Does not build, mutate, repair, or certify.",
    output: "Active attestation state or deviation alert.",
    gate: "Deviations are routed through SOLVA back to F0. Active attestation enables F10.",
    handoff: "F10 for release, or F0 for deviations.",
    type: "custody"
  },
  {
    id: "F10",
    title: "CONNECTOR & RELEASE GATEWAY",
    purpose: "Authorized release of immutable F9 artifacts with auditable delivery receipts.",
    input: "F9.5 OSIRIS attested artifact or multi-artifact export package.",
    process: "Routes the asset through distinct release lanes with policy/integrity checks.",
    output: "Delivery receipt, ZIP bundle, or provider ACK.",
    gate: "Requires active OSIRIS attestation. Provider acceptance does not confirm execution.",
    handoff: "External environments or deployment destinations.",
    type: "release"
  }
];

const SIDE_STEPS = [
  {
    id: "F6-VDJ",
    title: "VIBE ORACLE",
    desc: "Recommends IDE + coding vibe for your ATLAS PDD."
  },
  {
    id: "ATLAS 360",
    title: "PLAN / SCAN",
    desc: "Read-only origin-aware side-step. Generates structured execution plans or assurance audit profiles directly from the PDD."
  },
  {
    id: "F8-HDJ",
    title: "HOST ORACLE",
    desc: "Ranks deployment hosts for the certified MVP PDD."
  },
  {
    id: "MATHMON / PFP",
    title: "ASSURANCE OVERLAYS",
    desc: "MATHMON profiles mathematical applicability; PFP detects drift between PDD and codebase."
  },
  {
    id: "SPC PLAYER",
    title: "SPC PLAYER",
    desc: "Default plan-only cockpit with explicit-consent webhook for executing capability briefs."
  }
];

function StageCard({ stage }: { stage: StageDetail }) {
  return (
    <div className="flex flex-col h-full p-5 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 shrink-0 bg-primary/10 border border-primary/20 rounded flex items-center justify-center font-mono font-bold text-lg text-primary">
          {stage.id}
        </div>
        <div>
          <h3 className="font-display text-lg tracking-wider leading-tight">{stage.title}</h3>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{stage.type}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm flex-1">
        <div>
          <span className="font-mono text-[10px] uppercase text-muted-foreground block mb-0.5">Purpose</span>
          <span className="font-serif text-foreground">{stage.purpose}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground block mb-0.5">Input</span>
            <span className="font-serif text-foreground/90 text-xs">{stage.input}</span>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground block mb-0.5">Output</span>
            <span className="font-serif text-foreground/90 text-xs">{stage.output}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-border/50">
          <span className="font-mono text-[10px] uppercase text-muted-foreground block mb-0.5">Process</span>
          <span className="font-serif text-foreground/90 text-xs">{stage.process}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-primary/10 bg-primary/5 -mx-5 -mb-5 p-5 rounded-b-xl">
        <div className="flex items-start gap-2 mb-2">
          <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-foreground/90"><span className="text-primary font-bold">GATE:</span> {stage.gate}</div>
        </div>
        <div className="flex items-start gap-2">
          <ArrowRight className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-foreground/90"><span className="text-secondary font-bold">NEXT:</span> {stage.handoff}</div>
        </div>
      </div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-14 sm:py-16 md:py-24">
          <video
            className="absolute inset-0 w-full h-full object-cover -z-20"
            src={`${import.meta.env.BASE_URL}atanda-hero.mp4`}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] -z-10" />
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                <BookOpen className="h-3.5 w-3.5 mr-2" />
                INFORMATION GUIDE
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-6xl tracking-wider text-foreground break-words">
                HOW THE <span className="text-primary">HARNESS</span> WORKS
              </h1>
              <p className="font-serif text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                The full demo walkthrough for every feature on the floor — plus the
                video library and source publications behind the doctrine.
              </p>
              <nav
                className="flex flex-wrap justify-center gap-2 pt-2"
                aria-label="Guide sections"
              >
                {QUICK_NAV.map((n) => (
                  <a
                    key={n.href}
                    href={n.href}
                    className="rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-mono tracking-wider text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                    data-testid={`guide-nav-${n.href.slice(1)}`}
                  >
                    {n.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </section>

        {/* ATANDA Site Map */}
        <section id="role-model" className="py-16 md:py-20 bg-background scroll-mt-24">
          <div className="container px-4 md:px-6">
            <div className="mb-12 md:text-center max-w-4xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-4 text-primary">
                ATANDA SITE MAP
              </h2>
              <p className="text-muted-foreground font-serif text-lg mb-6">
                How an idea becomes a certified specification, codebase, signed machine artifact, custodied asset, and controlled release.
              </p>

              <div className="bg-muted/30 p-6 rounded-lg border text-sm font-mono text-left space-y-4">
                <p className="text-secondary font-bold uppercase tracking-wider mb-2">Authoritative Model</p>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-foreground"><span className="text-primary font-bold">F0</span> is Advisory/SOLVA: upstream intelligence and the return point for OSIRIS deviations.</p>
                    <p className="text-foreground mt-2"><span className="text-primary font-bold">F1 → F7</span> is the solid linear cockpit rail.</p>
                    <p className="text-foreground mt-2"><span className="text-primary font-bold">F8</span> is a post-certification build branch from certified F7.</p>
                  </div>
                  <div>
                    <p className="text-foreground"><span className="text-primary font-bold">F9</span> consumes F7 + F8 and emits a signed Machine Artifact.</p>
                    <p className="text-foreground mt-2"><span className="text-primary font-bold">F9.5</span> OSIRIS provides custody. Deviations return to F0. It does not mutate or certify.</p>
                    <p className="text-foreground mt-2"><span className="text-primary font-bold">F10</span> is the release gateway with distinct lanes.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Map Layout */}
            <div className="max-w-6xl mx-auto relative">

              {/* F0 Advisory (Top/Stand-alone) */}
              <div className="flex justify-center mb-8 relative z-10">
                <div className="w-full max-w-md" data-testid="guide-role-f0">
                  <StageCard stage={SYSTEM_STAGES.find(s => s.id === "F0")!} />
                </div>
              </div>

              {/* Central Rail Indicator */}
              <div className="hidden lg:block absolute left-1/2 top-[180px] bottom-[200px] w-1 bg-primary/20 -translate-x-1/2 z-0" />

              {/* F1-F7 Linear Rail Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-8 mb-12 relative z-10">
                {SYSTEM_STAGES.filter(s => s.type === 'rail').map((stage, idx) => (
                  <div
                    key={stage.id}
                    className={`relative ${idx % 2 === 0 ? 'lg:pr-8 lg:text-right' : 'lg:pl-8 lg:mt-16'}`}
                    data-testid={`guide-role-${stage.id.toLowerCase()}`}
                  >
                    {/* Connecting line to center rail */}
                    <div className={`hidden lg:block absolute top-1/2 w-8 h-px bg-primary/20 ${idx % 2 === 0 ? 'right-0' : 'left-0'}`} />
                    <StageCard stage={stage} />
                  </div>
                ))}
              </div>

              {/* Side-Steps (Advisory/Dashed) */}
              <div className="mb-16 p-6 border-2 border-dashed border-muted-foreground/30 rounded-xl bg-card">
                <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6 text-center">
                  Advisory Side-Steps
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SIDE_STEPS.map(step => (
                    <div key={step.id} className="p-4 border border-dashed border-border bg-background rounded-lg">
                      <div className="font-mono font-bold text-xs text-secondary mb-1">{step.id}</div>
                      <div className="font-display text-base tracking-wide mb-2">{step.title}</div>
                      <div className="text-xs font-serif text-muted-foreground leading-relaxed">{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post-Certification Flow (F8, F9, F9.5, F10) */}
              <div className="space-y-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  <div data-testid="guide-role-f8">
                    <StageCard stage={SYSTEM_STAGES.find(s => s.id === "F8")!} />
                  </div>
                  <div data-testid="guide-role-f9">
                    <StageCard stage={SYSTEM_STAGES.find(s => s.id === "F9")!} />
                  </div>
                </div>

                <div className="max-w-2xl mx-auto" data-testid="guide-role-f9-5">
                  <StageCard stage={SYSTEM_STAGES.find(s => s.id === "F9.5")!} />
                  <div className="mt-2 text-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                    ↑ Deviations route back to F0 SOLVA
                  </div>
                </div>

                <div className="max-w-4xl mx-auto border-t-2 border-primary/20 pt-8" data-testid="guide-role-f10">
                  <StageCard stage={SYSTEM_STAGES.find(s => s.id === "F10")!} />

                  {/* F10 Distinct Lanes */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border bg-card rounded-lg">
                      <div className="font-mono text-[10px] font-bold text-primary mb-2 uppercase">1. Signed F9 Release</div>
                      <div className="text-xs text-muted-foreground font-serif">Active OSIRIS attestation → policy checks → safe HTTPS adapter → receipt (proves delivery, not execution).</div>
                    </div>
                    <div className="p-4 border bg-card rounded-lg">
                      <div className="font-mono text-[10px] font-bold text-primary mb-2 uppercase">2. Multi-Artifact Export</div>
                      <div className="text-xs text-muted-foreground font-serif">Owned artifacts (SPC, MA, MPDD, PDD, CODE DJ) → deterministic manifest/ZIP → internal handoff.</div>
                    </div>
                    <div className="p-4 border bg-card rounded-lg">
                      <div className="font-mono text-[10px] font-bold text-primary mb-2 uppercase">3. Native Provider Deployment</div>
                      <div className="text-xs text-muted-foreground font-serif">AWS, Azure, OpenAI Agents, and Gemini Agents. User-owned provider authorization → queued → dispatch → ACK receipt. Export remains the fallback.</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Per-feature walkthroughs */}
        <section id="walkthroughs" className="py-16 md:py-20 scroll-mt-24">
          <div className="container px-4 md:px-6">
            <div className="mb-12 md:text-center max-w-3xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-4 text-primary">
                FEATURE WALKTHROUGHS
              </h2>
              <p className="text-muted-foreground font-serif text-lg">
                Step-by-step demo of every workspace on the floor. Each one links straight
                into the live feature.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {WALKTHROUGHS.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col rounded-lg border bg-card p-6"
                  data-testid={`guide-walkthrough-${w.id}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <w.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-display text-lg md:text-xl tracking-wide">
                      {w.title}
                    </h3>
                  </div>
                  <p className="text-sm font-serif text-muted-foreground leading-snug mb-4">
                    {w.tagline}
                  </p>
                  <div className="relative mb-4 overflow-hidden rounded-md border bg-background">
                    <img
                      src={w.gif ?? w.shot}
                      alt={`${w.title} — live workspace`}
                      loading="lazy"
                      className="w-full h-auto"
                      data-testid={`guide-shot-${w.id}`}
                    />
                    <span className="absolute bottom-2 right-2 rounded border border-border bg-background/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                      {w.gif ? "Live scroll-through" : "Live screenshot"}
                    </span>
                  </div>
                  <ol className="space-y-2.5 mb-5">
                    {w.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-snug">
                        <span className="font-mono text-xs font-bold text-primary shrink-0 mt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground/85">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-auto">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs tracking-wider"
                    >
                      <Link href={w.route}>
                        {w.routeLabel.toUpperCase()} <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Videos */}
        <section id="videos" className="py-16 md:py-20 border-y bg-card scroll-mt-24">
          <div className="container px-4 md:px-6">
            <div className="mb-10 md:text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/5 px-3 py-1 text-xs font-mono text-secondary mb-4">
                <BookOpen className="h-3 w-3" />
                LIBRARY · DEEP DIVES
              </div>
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-3 text-primary">
                VIDEOS
              </h2>
              <p className="text-muted-foreground font-serif text-base md:text-lg">
                Watch the HARNESS in motion — from the factory floor to the code gap.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {VIDEOS.map((v, i) => (
                <div
                  key={v.title}
                  className="rounded-lg border bg-background overflow-hidden flex flex-col"
                  data-testid={`guide-video-${i}`}
                >
                  <video
                    src={v.src}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full aspect-video bg-black"
                  />
                  <div className="p-5 flex flex-col gap-2">
                    <div className="font-display tracking-wider text-base md:text-lg">
                      {v.title}
                    </div>
                    <p className="text-sm font-serif text-foreground/80 leading-snug">
                      {v.blurb}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Publications */}
        <section id="publications" className="py-16 md:py-20 scroll-mt-24">
          <div className="container px-4 md:px-6">
            <div className="mb-10 md:text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/5 px-3 py-1 text-xs font-mono text-secondary mb-4">
                <FileText className="h-3 w-3" />
                LIBRARY · DOCTRINE
              </div>
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-3 text-primary">
                PUBLICATIONS
              </h2>
              <p className="text-muted-foreground font-serif text-base md:text-lg">
                The source doctrine behind every engine — from the JCSE diagnostic through
                SPARTAN compression and the Super Prompt Card schema.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {PUBLICATIONS.map((p, i) => (
                <a
                  key={p.title}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg border bg-card p-5 md:p-6 flex flex-col gap-3 hover:border-secondary/50 transition-colors"
                  data-testid={`guide-publication-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-md bg-secondary/10 border border-secondary/30 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display tracking-wider text-base md:text-lg">
                        {p.title}
                      </div>
                      <div className="text-[10px] font-mono tracking-wider text-muted-foreground">
                        PDF · OPENS IN NEW TAB
                      </div>
                    </div>
                    <Download className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                  </div>
                  <p className="text-sm font-serif text-foreground/80 leading-snug">
                    {p.blurb}
                  </p>
                </a>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/exemplars"
                className="text-xs font-mono tracking-wider text-secondary hover:underline inline-flex items-center gap-1"
                data-testid="guide-publications-cta"
              >
                OR BROWSE EXEMPLARS &amp; SPECS <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
