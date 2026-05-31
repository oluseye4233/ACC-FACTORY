import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Package, Upload, Workflow } from "lucide-react";

type DemoTile = {
  href: string;
  code: string;
  title: string;
  blurb: string;
  bullets: string[];
  cta: string;
  icon: typeof Workflow;
  accent: string;
};

const DEMOS: DemoTile[] = [
  {
    href: "/demos/ingest",
    code: "DEMO · 01",
    title: "INGESTION ENGINE",
    blurb:
      "Paste or upload a real document (PDD, SDD, concept note) and watch it normalise into a HARNESS-ready seed prompt, then auto-start a session with F1 unlocked.",
    bullets: [
      "PDF / DOCX / pasted-text extraction",
      "Claude-normalised title, kind, summary, seed prompt",
      "One-click start of an ingested session",
    ],
    cta: "Run the Ingestion demo",
    icon: Upload,
    accent: "from-cyan-500/20 via-cyan-500/5",
  },
  {
    href: "/demos/cartridge",
    code: "DEMO · 02",
    title: "ADVANCED CARTRIDGE",
    blurb:
      "Watch the premium project wizard package a scope statement, multi-document context, prior SPCs, and Git / database links into a single protected cartridge — then unlock the full F1–F7 workspace in one shot.",
    bullets: [
      "Step 1: hard-validated project scope (required)",
      "Step 2: documents, SPCs, links (optional)",
      "Cartridge context auto-injected into every engine call",
    ],
    cta: "Run the Cartridge demo",
    icon: Package,
    accent: "from-amber-500/20 via-amber-500/5",
  },
  {
    href: "/demo",
    code: "DEMO · 03",
    title: "FULL F1 → F8 PROCESS",
    blurb:
      "The complete 8-stage FORGE.BONSAI tour: raw prompt → atomic prompt → CELL → Micro PDD → SPC → ATLAS PDD → SPARTAN-certified MVP PDD → F8 Code ORACLE codebase bundle.",
    bullets: [
      "Animated walkthrough of every engine",
      "Pillar scores and badge unlocks light up live",
      "Ends at an F8 codebase bundle ready to publish",
    ],
    cta: "Take the 8-stage tour",
    icon: Workflow,
    accent: "from-primary/20 via-primary/5",
  },
];

export default function DemosIndex() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-12 px-4 md:px-6 max-w-6xl">
        <header className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-mono tracking-widest text-primary">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary mr-2 animate-pulse" />
            NO SUBSCRIPTION REQUIRED
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl tracking-wider">
            INTERACTIVE DEMOS
          </h1>
          <p className="font-serif text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Three guided walkthroughs covering every way an operator can enter
            the HARNESS. Every step is real UI, real outputs, and zero billing
            — explore before you commit.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DEMOS.map((d) => {
            const Icon = d.icon;
            return (
              <Card
                key={d.href}
                className={`relative overflow-hidden bg-gradient-to-br ${d.accent} to-background border-2 hover:border-primary/60 transition-all duration-300 group flex flex-col`}
                data-testid={`demo-card-${d.href.split("/").pop()}`}
              >
                <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl group-hover:bg-primary/20 transition-all" />
                <CardHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div className="font-mono text-[10px] tracking-widest text-primary/80">
                      {d.code}
                    </div>
                    <Icon className="h-7 w-7 text-primary/80 group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="font-display tracking-wider text-2xl mt-3">
                    {d.title}
                  </CardTitle>
                  <CardDescription className="font-serif text-sm leading-relaxed mt-2">
                    {d.blurb}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative flex-1 flex flex-col">
                  <ul className="space-y-2 mb-6 flex-1">
                    {d.bullets.map((b) => (
                      <li
                        key={b}
                        className="font-mono text-xs text-muted-foreground flex gap-2"
                      >
                        <span className="text-primary mt-1">▸</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="w-full font-display tracking-wider gap-2 group-hover:shadow-lg group-hover:shadow-primary/30 transition-all"
                    data-testid={`demo-cta-${d.href.split("/").pop()}`}
                  >
                    <Link href={d.href}>
                      {d.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <div className="rounded-lg border bg-card/40 p-4">
            <div className="font-mono text-[10px] tracking-widest text-primary mb-1">
              SIDE ENGINES
            </div>
            <p className="font-serif text-xs text-foreground/80 leading-snug">
              ATLAS J crystallises the F6 ATLAS PDD into typed JSON; PFP scores
              an F8 codebase bundle against its MVP PDD and hard-gates F8 on
              critical drift.
            </p>
          </div>
          <div className="rounded-lg border bg-card/40 p-4">
            <div className="font-mono text-[10px] tracking-widest text-primary mb-1">
              SPHINX MARKETPLACE
            </div>
            <p className="font-serif text-xs text-foreground/80 leading-snug">
              One-click publish from any F5 SPC to your Ark.Onecraft Sphinx
              Marketplace via a per-user bearer key.
            </p>
          </div>
          <div className="rounded-lg border bg-card/40 p-4">
            <div className="font-mono text-[10px] tracking-widest text-primary mb-1">
              TEAMS · TEAM LITE / TEAM
            </div>
            <p className="font-serif text-xs text-foreground/80 leading-snug">
              Per-seat org subs. TEAM LITE ($99 → Architect, 2 F8/day) and TEAM
              ($149 → Institution, unlimited F8). Sessions can be flagged
              org-visible on a per-row basis.
            </p>
          </div>
          <div className="rounded-lg border bg-card/40 p-4">
            <div className="font-mono text-[10px] tracking-widest text-primary mb-1">
              ACTIVITY · AUDIT LOG
            </div>
            <p className="font-serif text-xs text-foreground/80 leading-snug">
              Per-user and per-org activity feeds with date / engine / session
              filters and CSV export — billing + every engine call in one view.
            </p>
          </div>
        </div>

        <div className="text-center mt-10 space-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            Ready to run a real session?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" className="font-display tracking-wider">
              <Link href="/pricing">VIEW PRICING</Link>
            </Button>
            <Button asChild className="font-display tracking-wider">
              <Link href="/sign-up">INITIATE SESSION</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
