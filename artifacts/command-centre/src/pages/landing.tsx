import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { ENGINES } from "@/lib/constants";
import { Shield, Target, Cpu, CheckCircle, FileText, BookOpen, ArrowRight, Download } from "lucide-react";
import { DEMO_MODE } from "@/lib/demo-mode";
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

const WHITEPAPERS = [
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

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        {/* Declarative Banner — blended over hero video backdrop */}
        <section
          aria-label="Brand declaration"
          className="relative overflow-hidden"
          data-testid="banner-declaration"
        >
          <video
            className="absolute inset-0 w-full h-full object-cover -z-20"
            src={`${import.meta.env.BASE_URL}atanda-hero.mp4`}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/95 -z-10" />
          <div className="container px-4 md:px-6 py-4 sm:py-5 md:py-6">
            <p className="text-center font-display tracking-[0.12em] sm:tracking-[0.16em] text-base sm:text-xl md:text-2xl lg:text-3xl text-foreground/95 leading-snug max-w-5xl mx-auto">
              WE DON&apos;T BUILD AI AGENTS.{" "}
              <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-primary bg-clip-text text-transparent bg-[length:200%_100%] animate-[shimmer_8s_linear_infinite]">
                WE ENGINEER THE DNA THAT GOVERNS THEM
              </span>{" "}
              <span className="text-muted-foreground/90 text-sm sm:text-base md:text-lg lg:text-xl">
                — POWERED BY YOUR COGNITION, OWNED BY YOU.
              </span>
            </p>
          </div>
        </section>

        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 sm:py-20 md:py-32 lg:py-40">
          <video
            className="absolute inset-0 w-full h-full object-cover -z-20"
            src={`${import.meta.env.BASE_URL}atanda-hero.mp4`}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] -z-10" />
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-4">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                SYSTEM ONLINE
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl tracking-wider text-foreground break-words">
                FORGE.BONSAI <span className="text-primary">HARNESS</span>
              </h1>
              <p className="font-serif text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                The Production Floor for Cognitive Assets
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 w-full sm:w-auto">
                {DEMO_MODE ? (
                  <>
                    <Button asChild size="lg" className="relative h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-display tracking-wider w-full sm:w-auto shadow-[0_0_24px_rgba(168,85,247,0.55)] hover:shadow-[0_0_40px_rgba(168,85,247,0.85)] ring-2 ring-primary/60 animate-pulse">
                      <Link href="/demos">▶ EXPLORE DEMOS</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-display tracking-wider w-full sm:w-auto">
                      <Link href="/pricing">VIEW PRICING</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="relative h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-display tracking-wider w-full sm:w-auto bg-gradient-to-r from-primary via-fuchsia-500 to-primary bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] shadow-[0_0_24px_rgba(168,85,247,0.55)] hover:shadow-[0_0_40px_rgba(168,85,247,0.9)] ring-2 ring-primary/60">
                      <Link href="/f1000">★ CLAIM A FIRST-1000 SEAT</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-display tracking-wider w-full sm:w-auto">
                      <Link href="/demos">▶ EXPLORE DEMOS</Link>
                    </Button>
                  </>
                )}
              </div>
              <Link
                href="/pricing"
                className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
              >
                or view pricing &amp; capabilities →
              </Link>
            </div>
          </div>
        </section>

        {/* First-1000 Soft Launch */}
        <section className="py-16 md:py-20 border-y bg-card" data-testid="landing-f1000">
          <div className="container px-4 md:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center max-w-5xl mx-auto">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-mono text-primary">
                  <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                  SOFT LAUNCH · THE FIRST 1000
                </div>
                <h2 className="font-display text-3xl md:text-4xl tracking-wide text-foreground">
                  CLAIM A <span className="text-primary">FOUNDING SEAT</span>
                </h2>
                <p className="font-serif text-base md:text-lg text-muted-foreground leading-relaxed">
                  The first 1000 operators get free EXPLORER onboarding, then
                  PRACTITIONER at{" "}
                  <span className="text-foreground font-bold">$10/month</span>{" "}
                  (normally $49) with a $49 AI-usage budget — and a one-click
                  on-ramp to ARCHITECT the moment they outgrow it.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button asChild size="lg" className="font-display tracking-wider">
                    <Link href="/f1000">CLAIM MY INVITE</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="font-display tracking-wider">
                    <Link href="/pricing">SEE THE TIERS</Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-4 shadow-[0_0_40px_rgba(26,107,58,0.25)] border border-primary/20">
                  <img
                    src={`${import.meta.env.BASE_URL}f1000-qr.png`}
                    alt="Scan to claim a First-1000 founding seat"
                    className="h-44 w-44 md:h-52 md:w-52"
                    data-testid="landing-f1000-qr"
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground tracking-wider text-center">
                  SCAN TO CLAIM · ONE SEAT PER OPERATOR
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-card border-y">
          <div className="container px-4 md:px-6">
            <div className="mb-16 md:text-center max-w-3xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-4 text-primary">THE 8 ENGINES</h2>
              <p className="text-muted-foreground font-serif text-lg">
                Eight specialized engines working in concert to refine, grow, and compress your ideas into certified specifications.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ENGINES.map((engine) => (
                <div key={engine.id} className="flex flex-col p-6 rounded-lg border bg-background hover:bg-accent/50 transition-colors">
                  <div className="font-mono font-bold text-xl text-primary mb-2">{engine.name}</div>
                  <h3 className="font-display text-xl tracking-wide mb-3">{engine.title}</h3>
                  <p className="text-sm text-muted-foreground mt-auto">{engine.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Videos & Whitepapers */}
        <section className="py-20 md:py-24 border-b bg-background">
          <div className="container px-4 md:px-6">
            <div className="mb-12 md:text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/5 px-3 py-1 text-xs font-mono text-secondary mb-4">
                <BookOpen className="h-3 w-3" />
                LIBRARY · DEEP DIVES & DOCTRINE
              </div>
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-3 text-primary">
                VIDEOS &amp; WHITEPAPERS
              </h2>
              <p className="text-muted-foreground font-serif text-base md:text-lg">
                Watch the HARNESS in motion, then read the source doctrine behind every
                engine — from the JCSE diagnostic through SPARTAN compression and the
                Super Prompt Card schema.
              </p>
            </div>

            {/* Videos */}
            <div className="max-w-5xl mx-auto mb-10">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-primary tracking-wider mb-4">
                <BookOpen className="h-3.5 w-3.5" />
                VIDEOS
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {VIDEOS.map((v, i) => (
                  <div
                    key={v.title}
                    className="rounded-lg border bg-card overflow-hidden flex flex-col"
                    data-testid={`landing-video-${i}`}
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
              <div className="mt-4 text-right">
                <Link
                  href="/demo"
                  className="text-xs font-mono tracking-wider text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="landing-videos-cta"
                >
                  OR TAKE THE 8-STAGE WALKTHROUGH <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Whitepapers */}
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-secondary tracking-wider mb-4">
                <FileText className="h-3.5 w-3.5" />
                WHITEPAPERS
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {WHITEPAPERS.map((p, i) => (
                  <a
                    key={p.title}
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-lg border bg-card p-5 md:p-6 flex flex-col gap-3 hover:border-secondary/50 transition-colors"
                    data-testid={`landing-whitepaper-${i}`}
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
              <div className="mt-4 text-right">
                <Link
                  href="/exemplars"
                  className="text-xs font-mono tracking-wider text-secondary hover:underline inline-flex items-center gap-1"
                  data-testid="landing-whitepapers-cta"
                >
                  OR BROWSE EXEMPLARS &amp; SPECS <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-24 relative overflow-hidden">
          <div className="container px-4 md:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="space-y-8">
                <h2 className="font-display text-4xl md:text-5xl tracking-wide text-secondary">
                  CERTIFIED EXCELLENCE
                </h2>
                <div className="space-y-6">
                  {[
                    { icon: Shield, text: "SPARTAN-compressed MVP PDDs" },
                    { icon: Target, text: "Rigorous JCSE diagnostic scoring" },
                    { icon: Cpu, text: "Micro Agent (MA) Birth Packages" },
                    { icon: CheckCircle, text: "Public verification URLs for all output" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                        <item.icon className="h-6 w-6 text-secondary" />
                      </div>
                      <span className="font-medium text-lg">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative border border-primary/20 rounded-lg p-8 bg-card/50 backdrop-blur">
                <div className="absolute -top-3 -left-3 h-6 w-6 border-t-2 border-l-2 border-primary"></div>
                <div className="absolute -bottom-3 -right-3 h-6 w-6 border-b-2 border-r-2 border-primary"></div>
                <div className="font-mono text-sm text-muted-foreground mb-6 flex justify-between">
                  <span>TELEMETRY STREAM</span>
                  <span className="text-primary animate-pulse">LIVE</span>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">SESSIONS_ACTIVE</span>
                    <span className="text-foreground">1,042</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">CERTIFICATES_ISSUED</span>
                    <span className="text-secondary">8,934</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-muted-foreground">AVG_JCSE_SCORE</span>
                    <span className="text-primary">42.8/50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
