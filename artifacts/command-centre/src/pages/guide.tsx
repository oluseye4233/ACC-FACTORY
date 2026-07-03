import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { ENGINES } from "@/lib/constants";
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
      "A look at the engine bay: how F1–F8 chain together as one coherent production line.",
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
    title: "SESSIONS · THE HARNESS PRODUCTION LINE",
    route: "/session/new",
    routeLabel: "Start a Session",
    tagline:
      "One coherent run from raw idea to certified MVP PDD. Each engine consumes the previous engine's output — see the engine-by-engine walkthrough below.",
    steps: [
      "Open Sessions and hit NEW SESSION. Give it a working name — the session is the container every engine writes into.",
      "Run F1 on your raw prompt: it scores the idea against the 7-pillar JCSE rubric and tells you exactly which dimensions to tighten.",
      "Advance engine by engine (F2 → F7). Each workspace streams its output live; you can leave the tab — completed results are persisted and waiting when you return.",
      "At F7, the SPARTAN compressor certifies the MVP PDD and stamps a public verification URL you can hand to anyone.",
      "Optional side-steps never block the line: BUILD INSTRUCTIONS (VIBE + HOST ORACLE) and the MATHMON math-verification layer.",
      "Architect-grade finish: run F8 CODE ORACLE on the certified spec to scaffold a runnable codebase — export as ZIP, IDE bundle, or push straight to GitHub.",
    ],
    shot: shotSessions,
    gif: gifSessions,
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
      "Browse the library of certified exemplar specs.",
      "Open any exemplar to read the full document the way a build team would receive it.",
      "Hit FORK TO SESSION to clone an exemplar into your own session and evolve it from a proven baseline.",
    ],
    shot: shotExemplars,
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
  { href: "#pipeline", label: "ENGINE PIPELINE" },
  { href: "#walkthroughs", label: "FEATURE WALKTHROUGHS" },
  { href: "#videos", label: "VIDEOS" },
  { href: "#publications", label: "PUBLICATIONS" },
] as const;

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

        {/* Engine pipeline walkthrough */}
        <section id="pipeline" className="py-16 md:py-20 bg-card border-y scroll-mt-24">
          <div className="container px-4 md:px-6">
            <div className="mb-12 md:text-center max-w-3xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-4 text-primary">
                THE ENGINE PIPELINE
              </h2>
              <p className="text-muted-foreground font-serif text-lg">
                A session is one coherent run down this line. Each engine consumes the
                previous engine&apos;s output — this is what each stage does and what it
                hands to the next.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {ENGINES.map((engine) => (
                <div
                  key={engine.id}
                  className="flex flex-col p-6 rounded-lg border bg-background"
                  data-testid={`guide-engine-${engine.name.toLowerCase()}`}
                >
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono font-bold text-xl text-primary">
                      {engine.name}
                    </span>
                    <h3 className="font-display text-lg tracking-wide">{engine.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{engine.description}</p>
                  <p className="text-sm font-serif text-foreground/80 leading-relaxed mt-auto">
                    {engine.explainer}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild size="lg" className="font-display tracking-wider">
                <Link href="/session/new">
                  RUN THE LINE — START A SESSION <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
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
