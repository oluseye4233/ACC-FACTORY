import { useState } from "react";
import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Package,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

type Step = {
  id: number;
  code: string;
  title: string;
  tagline: string;
  whyItMatters: string;
  inputLabel: string;
  inputBody: string;
  outputLabel: string;
  outputBody: string;
  icon: typeof Package;
};

const STEPS: Step[] = [
  {
    id: 1,
    code: "STEP 1",
    title: "DEFINE PROJECT SCOPE",
    tagline: "Required — a hard-validated scope + outcome statement.",
    whyItMatters:
      "The Advanced Cartridge is a premium $499.99 / project SKU. It exists for operators arriving with multi-document context, prior SPCs, and live system links. Before anything else, the wizard forces you to commit a precise project scope — server-side hard-validated (min 80 chars scope, 12 chars outcome, non-empty name). This scope becomes the very first line of every cartridge-injected prompt.",
    inputLabel: "WIZARD FIELDS · STEP 1 (REQUIRED)",
    inputBody: `Project Name *
  Morning Briefing Agent v2 — Multi-channel rollout

Scope Statement *  (≥ 80 chars)
  Re-platform the existing Morning Briefing MA from email-only
  to a multi-channel agent that delivers the same 150-word
  briefing via email, SMS, and a Slack DM, sourced from the
  same calendar + weather + RSS triad.

Target Outcome *  (≥ 12 chars)
  Three delivery channels, zero regressions on AC-1..AC-4.`,
    outputLabel: "SERVER-SIDE VALIDATION",
    outputBody: `Endpoint:    POST /api/cartridge
Validator:   lib/cartridge-credits.ts + zod
Codes:
  SCOPE_REQUIRED            ← thrown if scope < 80 chars
                              or outcome < 12 chars
                              or projectName is empty
  CREDIT_REQUIRED           ← thrown if no available cartridge_credit
Credit claim:
  UPDATE cartridge_credits
    SET status='consumed', consumed_at=NOW()
    WHERE id = (
      SELECT id FROM cartridge_credits
       WHERE user_id=$1 AND status='available'
       FOR UPDATE SKIP LOCKED
       LIMIT 1
    )`,
    icon: Shield,
  },
  {
    id: 2,
    code: "STEP 2",
    title: "ATTACH CONTEXT (OPTIONAL)",
    tagline: "Documents, prior SPCs, Git + database links.",
    whyItMatters:
      "Optional but where cartridges earn their price. You can drop in the original concept PDD, the v1 SPC card you've already certified, a link to the existing repo, and a descriptor for the production database — without ever handing over credentials. Each document is summarised by Claude; links are stored as descriptors only (kind ∈ {git, database}).",
    inputLabel: "WIZARD FIELDS · STEP 2 (OPTIONAL)",
    inputBody: `Documents (× 2)
  morning-briefing-concept-v1.pdf    ·  4.1 MB
  v1-postmortem.docx                  ·  220 KB

Prior SPCs (× 1)
  SPC-MorningBriefing-v1.json   (BUGMXT-aligned, 15 sections)

Links (× 2)
  GIT       ·  https://github.com/acme/morning-briefing-ma
              ·  "Main branch, MIT license, ~1.2k LOC TS"
  DATABASE  ·  postgres://prod  (descriptor only)
              ·  "Schema: subscribers, briefings, delivery_log"`,
    outputLabel: "WHAT GETS PERSISTED",
    outputBody: `Single Drizzle transaction:
  cartridge_packages         × 1
    ├─ cartridge_documents   × 2  (with Claude summary per doc)
    ├─ cartridge_spcs        × 1
    └─ cartridge_links       × 2  (kind, url descriptor, label)

Credit row linked → cartridge_credits.cartridge_package_id
Total wall time:  ~9 s for 2 documents (provider-dependent)`,
    icon: FileText,
  },
  {
    id: 3,
    code: "STEP 3",
    title: "UNLOCK FULL F1–F7 IN ONE SHOT",
    tagline: "All engines flip to AVAILABLE simultaneously.",
    whyItMatters:
      "Manual and ingested sessions unlock engines one-by-one as you produce artefacts. Cartridge-origin sessions don't — because you already have the context, you get F1 through F7 unlocked at session start. F8 Code DJ stays gated to Architect tier (it is not auto-run from the cartridge start).",
    inputLabel: "POST /api/cartridge/:id/start-session",
    inputBody: `Creates:    harness_sessions  (origin='cartridge')
            session.cartridgeId = <package id>
Unlocks:    F1 AVAILABLE
            F2 AVAILABLE
            F3 AVAILABLE
            F4 AVAILABLE
            F5 AVAILABLE
            F6 AVAILABLE
            F7 AVAILABLE
            F8 — gated by Architect tier (unchanged)`,
    outputLabel: "SESSION-DETAIL VIEW",
    outputBody: `Session #IDX-0288 — "Morning Briefing Agent v2 …"
  Origin:    CARTRIDGE  ·  Package: pkg_4f8b…
  Scope:     "Re-platform the existing Morning Briefing
              MA from email-only to a multi-channel agent…"
  Assets:    2 docs · 1 prior SPC · 2 links

  [F1 DIAGNOSE]  AVAILABLE
  [F2 ATOMIC ]   AVAILABLE
  [F3 BIRTH  ]   AVAILABLE
  [F4 MICRO  ]   AVAILABLE
  [F5 SPC    ]   AVAILABLE
  [F6 ATLAS  ]   AVAILABLE
  [F7 MVP PDD]   AVAILABLE
  [F8 CODE DJ]   ARCHITECT TIER REQUIRED`,
    icon: Workflow,
  },
  {
    id: 4,
    code: "STEP 4",
    title: "PROTECTED CONTEXT INJECTION",
    tagline: "Every engine call receives the cartridge as authoritative context.",
    whyItMatters:
      "This is the cartridge's signature feature. Every Claude call from any engine in the session is automatically prefixed with a fenced 'CARTRIDGE CONTEXT' block — scope first, then assets — and the LLM is instructed not to contradict it. You don't have to re-paste anything; the cartridge is the instruction layer.",
    inputLabel: "WHAT EVERY ENGINE SEES",
    inputBody: `=== CARTRIDGE CONTEXT (authoritative · do not contradict) ===

PROJECT SCOPE
  Re-platform the existing Morning Briefing MA from email-only
  to a multi-channel agent that delivers the same 150-word
  briefing via email, SMS, and a Slack DM, sourced from the
  same calendar + weather + RSS triad.

ASSETS
  · DOC  morning-briefing-concept-v1.pdf   (summary: …)
  · DOC  v1-postmortem.docx                (summary: …)
  · SPC  SPC-MorningBriefing-v1.json       (15 sections)
  · GIT  github.com/acme/morning-briefing-ma  (~1.2k LOC TS)
  · DB   postgres://prod (descriptor)

=== END CARTRIDGE CONTEXT ===

[ engine system prompt continues here ]`,
    outputLabel: "INJECTION MECHANICS",
    outputBody: `Loader:        lib/cartridge-context.ts#loadCartridgeContext
Trigger:       Called once per request from engines/shared.ts#callLlm
               via ctx.sessionId
Cache:         60-second LRU by mtime
Hard cap:      24,000 bytes (assets truncated, scope always intact)
Order:         Scope → Assets   (scope is never dropped)
Side-effect:   None — read-only, no token billed to operator
               for the injection itself, beyond Claude's usage`,
    icon: Sparkles,
  },
];

export default function DemoCartridge() {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep]!;
  const Icon = step.icon;
  const isLast = activeStep === STEPS.length - 1;
  const isFirst = activeStep === 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-10 px-4 md:px-6 max-w-5xl">
        <div className="mb-6">
          <Link
            href="/demos"
            className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> back to all demos
          </Link>
        </div>

        <header className="mb-8 space-y-3">
          <div className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-mono tracking-widest text-amber-300">
            <Package className="h-3 w-3 mr-2" /> DEMO · ADVANCED CARTRIDGE
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wider">
            PACKAGE EVERYTHING. UNLOCK EVERYTHING.
          </h1>
          <p className="font-serif text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
            The Cartridge wizard ($499.99 / project) is the premium entry
            point. Walk the 4 steps that turn a project scope, supporting
            documents, prior SPCs, and live system links into a protected
            context layer injected into every engine call.
          </p>
        </header>

        {/* Asset rail (visual flair) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {[
            { Icon: Shield, label: "SCOPE" },
            { Icon: FileText, label: "DOCS" },
            { Icon: GitBranch, label: "GIT" },
            { Icon: Database, label: "DB" },
          ].map(({ Icon: I, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5 font-mono text-[10px] tracking-widest text-amber-300/90"
            >
              <I className="h-3.5 w-3.5" /> {label}
            </div>
          ))}
        </div>

        {/* Step rail */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const active = i === activeStep;
            const done = i < activeStep;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(i)}
                data-testid={`step-tab-${s.id}`}
                className={`flex-1 min-w-[140px] text-left px-3 py-2 rounded border-2 font-mono text-[11px] transition-all ${
                  active
                    ? "border-amber-400 bg-amber-500/15 text-amber-100"
                    : done
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-300/70"
                    : "border-border/40 bg-card/40 text-muted-foreground hover:border-border"
                }`}
              >
                <div className="tracking-widest">{s.code}</div>
                <div className="mt-1 text-foreground/90 normal-case truncate">{s.title}</div>
              </button>
            );
          })}
        </div>

        <Card className="bg-card border-2 border-amber-500/30">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <Icon className="h-6 w-6 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] tracking-widest text-amber-300">{step.code}</div>
                <CardTitle className="font-display tracking-wider text-2xl mt-1">
                  {step.title}
                </CardTitle>
                <CardDescription className="font-serif text-sm mt-2">
                  {step.tagline}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-300" />
                <div className="font-mono text-[10px] tracking-widest text-amber-300">
                  WHY THIS STEP MATTERS
                </div>
              </div>
              <p className="font-serif text-sm text-foreground/90 leading-relaxed">
                {step.whyItMatters}
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-background/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    {step.inputLabel}
                  </div>
                </div>
                <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-foreground/85">
                  {step.inputBody}
                </pre>
              </div>
              <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />
                  <div className="font-mono text-[10px] tracking-widest text-amber-300">
                    {step.outputLabel}
                  </div>
                </div>
                <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-foreground">
                  {step.outputBody}
                </pre>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border/60">
              <Button
                variant="outline"
                disabled={isFirst}
                onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                className="font-mono text-xs gap-2"
                data-testid="button-prev"
              >
                <ArrowLeft className="h-3 w-3" /> PREVIOUS
              </Button>
              <div className="font-mono text-xs text-muted-foreground">
                {activeStep + 1} / {STEPS.length}
              </div>
              {isLast ? (
                <Button asChild className="font-mono text-xs gap-2" data-testid="button-finish">
                  <Link href="/demos">
                    ALL DEMOS <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="font-mono text-xs gap-2"
                  data-testid="button-next"
                >
                  NEXT <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-10 text-center space-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            See how it all plays out:
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" className="font-display tracking-wider">
              <Link href="/demo">NEXT: FULL F1 → F8 TOUR</Link>
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
