import { useState } from "react";
import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Compass,
  Cpu,
  Diamond,
  FileText,
  Layers,
  Lightbulb,
  Rocket,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";

type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface StageContent {
  id: StageId;
  code: string;
  name: string;
  tagline: string;
  icon: typeof Lightbulb;
  whyItMatters: string;
  inputLabel: string;
  inputBody: string;
  outputLabel: string;
  outputBody: string;
  bridgeToNext?: string;
}

const SCENARIO = {
  rawIdea:
    "I want an AI thing that emails me every morning with a personalised summary of the day ahead — calendar, weather, top news, and what I should focus on first.",
  agentName: "Morning Briefing MA",
};

const STAGES: StageContent[] = [
  {
    id: 1,
    code: "F1",
    name: "PROMPT DIAGNOSTIC",
    tagline: "Score the raw idea, find what's missing.",
    icon: Lightbulb,
    whyItMatters:
      "Raw human ideas are vague. F1 runs the JCSE diagnostic to expose the gaps (audience, success criteria, constraints) BEFORE you waste compute on a fuzzy spec.",
    inputLabel: "RAW IDEA (what you'd type into ChatGPT)",
    inputBody: SCENARIO.rawIdea,
    outputLabel: "JCSE DIAGNOSTIC REPORT",
    outputBody: `JCSE SCORE: 28 / 50  (NEEDS REFINEMENT)

STRENGTHS
  + Clear delivery channel (email)
  + Clear cadence (every morning)
  + Personal use-case, single user

GAPS DETECTED
  - No success criteria  ("personalised" is undefined)
  - No data source priority  (which calendar? which weather API?)
  - No tone / length spec  (3 bullets? 500 words?)
  - No fallback behaviour  (what if calendar API is down?)

RECOMMENDED NEXT STEP
  Re-cast as an Atomic Prompt in F2 with explicit inputs, outputs,
  and a single measurable success criterion.`,
    bridgeToNext:
      "F1 told you WHERE the idea is weak. F2 now rewrites it as a single, surgical Atomic Prompt that closes those gaps.",
  },
  {
    id: 2,
    code: "F2",
    name: "ATOMIC PROMPT",
    tagline: "Compress to one indivisible instruction.",
    icon: Diamond,
    whyItMatters:
      "An Atomic Prompt is the smallest possible coherent task description. It has exactly one job, one output shape, and one success criterion — the precondition for letting a Micro Agent own it.",
    inputLabel: "GAPS FROM F1",
    inputBody:
      "Undefined personalisation; ambiguous data sources; no length/tone spec; no fallback.",
    outputLabel: "ATOMIC PROMPT v1",
    outputBody: `ROLE
  Morning Briefing Agent

GOAL
  Produce a 150-word personalised morning briefing, delivered by
  email at 06:00 local time, every day.

INPUTS
  - Google Calendar events for the next 24h
  - OpenWeather forecast for user's lat/long
  - 3 top stories from a configured RSS feed
  - User's stated "current focus" string

OUTPUT
  Plain-text email body, sections:
    1) Greeting + weather one-liner
    2) Top 3 calendar events with prep notes
    3) 1-line "first thing to do" recommendation

SUCCESS
  Briefing is < 200 words, contains all 4 sections,
  and the focus recommendation references at least one calendar item.

FALLBACK
  If any data source is unreachable, the email still sends with
  a marked "[unavailable]" section.`,
    bridgeToNext:
      "F2 produced a surgical instruction. But an instruction is not an agent yet. F3 wraps it in a CELL — the minimal package needed to actually BIRTH the agent.",
  },
  {
    id: 3,
    code: "F3",
    name: "MA BIRTH PACKAGE",
    tagline: "Wrap the Atomic Prompt into a runnable CELL.",
    icon: Cpu,
    whyItMatters:
      "A CELL is what turns a prompt into a deployable Micro Agent: identity, memory shape, allowed tools, and the trigger. Without F3 you have a paragraph, not software.",
    inputLabel: "ATOMIC PROMPT FROM F2",
    inputBody: "Morning Briefing Agent — 150-word daily personalised email at 06:00.",
    outputLabel: "MA BIRTH PACKAGE (CELL v1)",
    outputBody: `IDENTITY
  name:    Morning Briefing MA
  version: 0.1.0
  owner:   <operator>

MEMORY
  short_term:  last 7 briefings (for tone-drift detection)
  long_term:   user's stated focus, learned reading time

TOOLS
  - google.calendar.list_events
  - openweather.forecast
  - rss.fetch
  - email.send

TRIGGER
  cron: "0 6 * * *"  (timezone: user_profile.timezone)

GUARDRAILS
  - Hard cap: 200 words
  - Refuse to send if >2 tool calls fail
  - PII: never quote calendar attendee emails in the body`,
    bridgeToNext:
      "F3 gave you a runnable CELL. F4 now translates that CELL into a Micro PDD — a tiny product spec your engineer (or you, tomorrow) can implement without rereading the whole sequence.",
  },
  {
    id: 4,
    code: "F4",
    name: "MICRO PDD",
    tagline: "Tiny product spec — implementable in an afternoon.",
    icon: FileText,
    whyItMatters:
      "Micro PDDs are the shortest possible buildable artefact. They exist so you can ship one focused MA without inheriting the bureaucracy of a full PDD.",
    inputLabel: "MA BIRTH PACKAGE FROM F3",
    inputBody: "Morning Briefing MA CELL with cron trigger and 4 tools.",
    outputLabel: "MICRO PDD",
    outputBody: `# Micro PDD — Morning Briefing MA

## 1. Problem
Operator wastes 10–15 minutes every morning piecing together calendar,
weather, and news to decide what to do first.

## 2. Solution
A scheduled Micro Agent that emails a 150-word briefing at 06:00.

## 3. User Story
> As an operator, I want one short email at 06:00 so I can start the day
> with full situational awareness in under 60 seconds of reading.

## 4. Acceptance Tests
- AC-1: Email arrives within 5 minutes of 06:00 local, 6 days in a row.
- AC-2: Word count is between 120 and 200.
- AC-3: First-thing recommendation explicitly cites at least one calendar event.
- AC-4: When any data source fails, the email still sends with "[unavailable]".

## 5. Out of Scope
- Mobile push (email only for v0.1)
- Tone customisation
- Multi-user`,
    bridgeToNext:
      "F4 is the smallest shippable spec. But for paying customers / regulated work you need a full Strategic Product Concept. F5 grows the Micro PDD into a complete SPC.",
  },
  {
    id: 5,
    code: "F5",
    name: "SPC",
    tagline: "Strategic Product Concept — the full business case.",
    icon: Layers,
    whyItMatters:
      "The SPC is what investors, partners, and your future self need: market context, positioning, risks, success metrics. It promotes the Micro PDD from \"buildable\" to \"defensible.\"",
    inputLabel: "MICRO PDD FROM F4",
    inputBody: "Morning Briefing MA, single-operator MVP scope.",
    outputLabel: "STRATEGIC PRODUCT CONCEPT (SPC)",
    outputBody: `# SPC — Morning Briefing MA

## Market
~85M knowledge workers globally spend 10+ min/day on morning context-gathering.
Existing tools (Notion, daily.dev) are passive feeds, not synthesised summaries.

## Wedge
Sub-200-word, opinionated FIRST-THING recommendation. Not a feed — a decision.

## Differentiators
1. Tied directly to calendar (others ignore it)
2. Operator-owned focus string steers the recommendation
3. Fail-soft fallback (still ships if data source dies)

## Risks
- Calendar API quota / OAuth churn
- Tone drift over weeks (mitigated by short-term memory in F3 CELL)
- Email deliverability (mitigated by DKIM + SPF setup)

## Metrics
- North star: % of mornings the recipient opens the email within 30 min
- Guardrail: # complaints about "irrelevant" focus recommendation < 5%

## Pricing Hypothesis
$5 / month per operator. Free tier: 14-day trial.`,
    bridgeToNext:
      "The SPC is strategic — but it's still prose. F6 expands it into the 4-part ATLAS PDD: the structured document an engineering team can pick up and execute.",
  },
  {
    id: 6,
    code: "F6",
    name: "ATLAS PDD",
    tagline: "4-part executable product spec.",
    icon: Workflow,
    whyItMatters:
      "ATLAS = Aim / Terrain / Loops / Asks / Surface. It's the canonical hand-off doc — every engineer who picks it up sees the same shape and can act in hours, not days. F6-VDJ also picks the IDE + vibe.",
    inputLabel: "SPC FROM F5",
    inputBody: "Morning Briefing MA — wedge, risks, metrics, pricing.",
    outputLabel: "4-PART ATLAS PDD (+ VDJ recommendation)",
    outputBody: `# ATLAS PDD — Morning Briefing MA

## A — AIM
Ship a working Morning Briefing MA in 1 sprint that hits AC-1..4
from the Micro PDD with zero manual ops once cron is live.

## T — TERRAIN
Stack: Node 20 + tsx, Cloudflare Workers cron, Postgres (Neon),
Resend for email. OAuth via Clerk. All tool calls go through a thin
adapter so providers are swappable in <1 day each.

## L — LOOPS
- Build loop:     local tsx, dummy data fixtures
- Verify loop:    snapshot tests on 7 days of canned briefings
- Operate loop:   Sentry on every cron fire, daily delivery rate KPI

## A — ASKS
- Resend domain + DKIM (1h)
- OpenWeather + Google OAuth keys
- Decision: do we ship without RSS in v0.1? (recommend: yes)

## S — SURFACE
Single config page: focus string, timezone, RSS URL, send time.
No dashboard in v0.1.

──────────────────────────────────────────────
F6-VDJ Recommendation
  IDE:   Cursor (best for cron + adapter scaffolding)
  Vibe:  "calm operator" — monochrome theme, no Slack while building`,
    bridgeToNext:
      "The ATLAS PDD is complete but heavy. F7 SPARTAN-compresses it into the certifiable MVP PDD — the lean, signable, publicly-verifiable artefact you ship and forget.",
  },
  {
    id: 7,
    code: "F7",
    name: "MVP PDD",
    tagline: "SPARTAN-certified, publicly verifiable.",
    icon: Shield,
    whyItMatters:
      "F7 strips ATLAS to the load-bearing skeleton, runs the SPARTAN math, and mints a public verification URL anyone can hit to confirm the artefact's provenance. This is what you publish.",
    inputLabel: "ATLAS PDD FROM F6",
    inputBody: "Full 4-part Morning Briefing MA spec.",
    outputLabel: "CERTIFIED MVP PDD",
    outputBody: `# MVP PDD — Morning Briefing MA   [SPARTAN-CERTIFIED]

PROBLEM   →  10 wasted minutes every morning piecing context together.
SOLUTION  →  150-word, cron-fired briefing email at 06:00 local.
PROOF     →  AC-1..4 from Micro PDD; 7-day snapshot tests pass.
ASK       →  Resend domain + Calendar OAuth, then ship.
RISK      →  API quota churn; mitigated by adapter abstraction.

──────────────────────────────────────────────
SPARTAN MATH
  Density:        0.94   (target ≥ 0.85)
  Compression:    7.2 ×  (vs source ATLAS)
  Load-bearing:   12 / 12 sections retained
  Score:          47 / 50    ✓ CERTIFIED

VERIFICATION
  URL:   https://atanda.example/verify/MA-MORNINGBRIEF-0001
  Hash:  3b1c…d4e9   (matches issuer signature)
  Issued: 2026-05-20  by: <operator>`,
    bridgeToNext: undefined,
  },
];

const ICONS: Record<StageId, typeof Lightbulb> = {
  1: Lightbulb,
  2: Diamond,
  3: Cpu,
  4: FileText,
  5: Layers,
  6: Workflow,
  7: Shield,
};

export default function Demo() {
  const [index, setIndex] = useState(0);
  const stage = STAGES[index];
  const isFirst = index === 0;
  const isLast = index === STAGES.length - 1;
  const StageIcon = ICONS[stage.id];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        {/* Hero / intro */}
        <section className="border-b bg-gradient-to-b from-secondary/5 to-background">
          <div className="container px-4 md:px-6 py-10 md:py-16 max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-mono text-primary mb-4">
              <Sparkles className="h-3 w-3" />
              GUIDED TOUR · NO ACCOUNT NEEDED
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-6xl tracking-wider mb-4">
              THE 7-STAGE <span className="text-primary">DEMO SESSION</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground font-serif max-w-3xl leading-relaxed">
              Watch one raw idea move through the entire FORGE.BONSAI HARNESS — from
              fuzzy human prompt to SPARTAN-certified MVP PDD — using a real
              worked example. Read at your own pace. No tokens spent, no session created.
            </p>
            <div className="mt-6 p-4 rounded-lg border bg-card/60 font-mono text-xs md:text-sm">
              <div className="text-muted-foreground mb-1">WORKED EXAMPLE</div>
              <div className="text-foreground">"{SCENARIO.rawIdea}"</div>
              <div className="text-primary mt-2">
                → becomes <span className="font-bold">{SCENARIO.agentName}</span>, certified at F7.
              </div>
            </div>
          </div>
        </section>

        {/* Stage progress bar */}
        <section className="border-b bg-card/40 sticky top-14 z-30 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <div className="container px-4 md:px-6 max-w-5xl">
            <ol className="flex items-center justify-between gap-1 py-3 overflow-x-auto">
              {STAGES.map((s, i) => {
                const Icon = ICONS[s.id];
                const isActive = i === index;
                const isDone = i < index;
                return (
                  <li key={s.id} className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`group w-full flex flex-col items-center gap-1 py-1 px-1 rounded transition-colors ${
                        isActive
                          ? "text-primary"
                          : isDone
                            ? "text-foreground hover:text-primary"
                            : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`demo-stage-${s.code.toLowerCase()}`}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <span
                        className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full border flex items-center justify-center shrink-0 ${
                          isActive
                            ? "border-primary bg-primary/15"
                            : isDone
                              ? "border-primary/60 bg-primary/5"
                              : "border-border bg-background"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isActive ? (
                          <CircleDot className="h-4 w-4" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="font-mono text-[10px] sm:text-xs font-bold tracking-wider">
                        {s.code}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Active stage */}
        <section className="container px-4 md:px-6 py-8 md:py-12 max-w-5xl">
          <Card className="border-primary/20">
            <CardHeader className="border-b">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <StageIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-muted-foreground tracking-wider mb-1">
                    STAGE {stage.id} OF 7 · {stage.code}
                  </div>
                  <CardTitle className="font-display text-2xl md:text-3xl tracking-wider">
                    {stage.name}
                  </CardTitle>
                  <CardDescription className="font-serif text-base mt-1">
                    {stage.tagline}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Why this matters explainer */}
              <div className="rounded-md border border-secondary/30 bg-secondary/5 p-4">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-secondary mb-2">
                  <Compass className="h-3.5 w-3.5" />
                  WHY THIS STAGE MATTERS
                </div>
                <p className="text-sm md:text-base text-foreground/90 leading-relaxed font-serif">
                  {stage.whyItMatters}
                </p>
              </div>

              {/* Input → Output */}
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
                <div className="rounded-md border bg-muted/30 p-4 flex flex-col">
                  <div className="text-[10px] font-mono font-bold text-muted-foreground tracking-wider mb-2">
                    {stage.inputLabel}
                  </div>
                  <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap break-words text-foreground/80 flex-1">
{stage.inputBody}
                  </pre>
                </div>
                <div className="flex items-center justify-center text-primary">
                  <ArrowRight className="h-5 w-5 hidden md:block" />
                  <ArrowDown className="h-5 w-5 md:hidden" />
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 flex flex-col">
                  <div className="text-[10px] font-mono font-bold text-primary tracking-wider mb-2">
                    {stage.outputLabel}
                  </div>
                  <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap break-words text-foreground flex-1">
{stage.outputBody}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checkpoint bridge to next stage */}
          {stage.bridgeToNext && (
            <div className="my-6 flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 md:p-5">
              <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                <ArrowDown className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[10px] md:text-xs font-bold text-primary tracking-wider mb-1">
                  CHECKPOINT · {stage.code} → {STAGES[index + 1]?.code}
                </div>
                <p className="text-sm md:text-base font-serif leading-relaxed">
                  {stage.bridgeToNext}
                </p>
              </div>
            </div>
          )}

          {/* Stage nav */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className="font-mono w-full sm:w-auto"
              data-testid="demo-prev"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> PREVIOUS STAGE
            </Button>
            <div className="text-center font-mono text-xs text-muted-foreground order-first sm:order-none">
              {index + 1} / {STAGES.length}
            </div>
            {isLast ? (
              <Button asChild className="font-display tracking-wider w-full sm:w-auto">
                <Link href="/sign-up">
                  INITIATE YOUR REAL SESSION <Rocket className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button
                onClick={() => setIndex((i) => Math.min(STAGES.length - 1, i + 1))}
                className="font-display tracking-wider w-full sm:w-auto"
                data-testid="demo-next"
              >
                NEXT STAGE <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Final CTA shows on F7 */}
          {isLast && (
            <Card className="mt-8 border-primary/40 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
              <CardContent className="p-6 md:p-8 text-center space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-mono text-primary">
                  <CheckCircle2 className="h-3 w-3" /> TOUR COMPLETE
                </div>
                <h2 className="font-display text-2xl md:text-4xl tracking-wider">
                  YOU'VE SEEN THE WHOLE SEQUENCE
                </h2>
                <p className="text-muted-foreground font-serif max-w-2xl mx-auto">
                  Now run YOUR idea through it. Every real session starts at F1 with
                  your own raw prompt — the HARNESS handles the rest.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button asChild size="lg" className="font-display tracking-wider">
                    <Link href="/sign-up">INITIATE SESSION</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="font-display tracking-wider">
                    <Link href="/pricing">VIEW PRICING</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
