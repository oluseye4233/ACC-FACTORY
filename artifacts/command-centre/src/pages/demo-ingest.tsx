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
  FileText,
  Sparkles,
  Upload,
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
  icon: typeof Upload;
};

const STEPS: Step[] = [
  {
    id: 1,
    code: "STEP 1",
    title: "BRING YOUR OWN DOCUMENT",
    tagline: "Drop a real PDD, SDD, brief, concept note, or paste raw text.",
    whyItMatters:
      "The Ingestion Engine is the front door for operators who already have a Product Design Document — formally an Ingestion PDD (IPDD). Instead of typing a fresh prompt, you bring what you already wrote and the engine seeds the HARNESS for you.",
    inputLabel: "WHAT YOU UPLOAD",
    inputBody: `File:        morning-briefing-concept.pdf  (2.4 MB · 6 pages)
Kind:        Ingestion Product Design Document (IPDD)
Source:      Human-authored Notion export, pasted as PDF
Excerpt:
  "We want a scheduled assistant that emails a 150-word
   morning briefing each day at 06:00. It should combine
   calendar, weather, and three news headlines, and end
   with a single recommended first action…"`,
    outputLabel: "WHAT THE ENGINE SEES",
    outputBody: `Accepted formats:  .pdf  ·  .docx  ·  pasted text
Extractor:         pdf-parse (PDF) · mammoth (DOCX)
Charge:            1 Ingestion Credit (atomic claim, refunded on error)
Privacy:           Document stays inside your tenant
Next:              Engine normalises this into a HARNESS seed`,
    icon: Upload,
  },
  {
    id: 2,
    code: "STEP 2",
    title: "CLAUDE-NORMALISED METADATA",
    tagline: "The raw text is distilled into structured ingest metadata.",
    whyItMatters:
      "Raw documents are messy — wandering headings, mixed concerns, no canonical title. Claude reads the extracted text once and emits a clean record the HARNESS knows how to consume: title, kind, summary, and a seed prompt that F1 can immediately diagnose.",
    inputLabel: "INPUT TO CLAUDE",
    inputBody: `~5,800 chars of extracted text from morning-briefing-concept.pdf,
plus the operator's declared sourceDocKind (PDD).`,
    outputLabel: "STRUCTURED INGESTION RECORD",
    outputBody: `{
  "detectedTitle":  "Morning Briefing Agent — concept v0.3",
  "sourceDocKind":  "product_design_document",
  "summary":        "Scheduled assistant that emails a 150-word
                     personalised briefing at 06:00, combining
                     calendar, weather, and 3 news items with a
                     single recommended first action.",
  "seedPrompt":     "Design a scheduled 'morning briefing' agent
                     that delivers a 150-word personalised email
                     at 06:00 local time, using calendar +
                     weather + 3 RSS headlines, ending with one
                     concrete first-thing-to-do recommendation."
}`,
    icon: Sparkles,
  },
  {
    id: 3,
    code: "STEP 3",
    title: "ONE-CLICK SESSION START",
    tagline: "Ingestion record becomes a live HARNESS session, F1 unlocked.",
    whyItMatters:
      "No retyping, no re-pasting. The seed prompt is loaded into a fresh session with origin='ingested' and ingestionId set, so the produced artefacts are formally PWDDs (PromptWare Design Documents) — the HARNESS-certified post-ingestion output, distinct from the IPDD you brought in.",
    inputLabel: "WHAT START-SESSION DOES",
    inputBody: `POST /api/ingest/:id/start-session
  - Creates harness_sessions row (origin='ingested')
  - Links session.ingestionId = <ingestion record id>
  - Marks F1 as AVAILABLE
  - Leaves F2..F7 LOCKED until the prior stage emits an artefact
  - Does NOT consume a second credit`,
    outputLabel: "WHAT THE OPERATOR SEES",
    outputBody: `Session #IDX-0142 — "Morning Briefing Agent — concept v0.3"
  Origin:     INGESTED  ·  Source: PDD
  Seeded:    The seed prompt is pre-loaded in F1
  Pillars:    No pillars scored yet (F1 will light them up)

  [F1 DIAGNOSE]  AVAILABLE  ←  start here
  [F2 ATOMIC ]   LOCKED
  [F3 BIRTH  ]   LOCKED
  ...
  [F7 MVP PDD]   LOCKED  →  ends with a verifiable PWDD`,
    icon: Workflow,
  },
  {
    id: 4,
    code: "STEP 4",
    title: "DRIVE THE HARNESS — TO PWDD",
    tagline: "F1 → F7 unfolds exactly like a manual session, but seeded.",
    whyItMatters:
      "Once the session is open, ingestion is invisible. You drive F1 → F7 stage by stage. The output of F7 is a SPARTAN-certified MVP PDD with a public verify URL. Because origin='ingested', that artefact is qualified as a PWDD in the UI, not an IPDD — keeping the input vs output distinction crisp.",
    inputLabel: "STAGE FLOW",
    inputBody: `F1   Diagnoses the seed prompt across 7 pillars (S R I D F E C)
F2   Synthesises the Atomic Prompt
F3   Wraps it in a CELL Micro Agent Birth Package
F4   Converts to a Micro PDD
F5   Grows the Micro PDD into a 15-section SPC via 7-step FORGE Q&A
F6   Drafts a 4-part ATLAS PDD (+ optional F6-VDJ vibe brief)
F7   Compresses to a SPARTAN-certified MVP PDD / PWDD`,
    outputLabel: "FINAL ARTEFACT (PWDD)",
    outputBody: `MVP PDD · Morning Briefing Agent v1.0  (origin: INGESTED)
  SPARTAN:    PASS  ·  cert: spartan-v1-9c4a…
  Verify URL: https://atanda.app/verify/9c4a-…
  Stored as:  harness_artifacts (artifact_type='MVP_PDD')
  Counts toward:
    AISA_PWDD  ·  Advanced Intelligence Systems Architect
    (auto-awarded at 3 PWDD-stage projects — manual,
     ingested, or cartridge sessions all count)`,
    icon: CheckCircle2,
  },
];

export default function DemoIngest() {
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
          <div className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-mono tracking-widest text-cyan-300">
            <Upload className="h-3 w-3 mr-2" /> DEMO · INGESTION ENGINE
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wider">
            BRING YOUR OWN DOCUMENT
          </h1>
          <p className="font-serif text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Walk the 4 steps that turn a real-world Product Design Document
            (IPDD) into a HARNESS-certified PWDD. No upload, no billing — just
            the exact UI and outputs an operator sees.
          </p>
        </header>

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
                    ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                    : done
                    ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-300/70"
                    : "border-border/40 bg-card/40 text-muted-foreground hover:border-border"
                }`}
              >
                <div className="tracking-widest">{s.code}</div>
                <div className="mt-1 text-foreground/90 normal-case truncate">{s.title}</div>
              </button>
            );
          })}
        </div>

        <Card className="bg-card border-2 border-cyan-500/30">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
                <Icon className="h-6 w-6 text-cyan-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] tracking-widest text-cyan-300">{step.code}</div>
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
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-cyan-300" />
                <div className="font-mono text-[10px] tracking-widest text-cyan-300">
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
              <div className="rounded-lg border-2 border-cyan-500/40 bg-cyan-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />
                  <div className="font-mono text-[10px] tracking-widest text-cyan-300">
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
            Ready to ingest a real document?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" className="font-display tracking-wider">
              <Link href="/demos/cartridge">NEXT: CARTRIDGE DEMO</Link>
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
