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
  Award,
  CheckCircle2,
  CircleDot,
  Code2,
  Compass,
  Cpu,
  Database,
  Diamond,
  FileText,
  Layers,
  Lightbulb,
  Package,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Workflow,
} from "lucide-react";
import { PillarTriangle } from "@/components/shared/PillarTriangle";
import type { ContextCraftBadge } from "@workspace/api-client-react";

type PillarCode = ContextCraftBadge["pillar"];

const PILLAR_MAX_DEMO: Record<PillarCode, number> = {
  SYSTEM: 7,
  ROLE: 7,
  INSTRUCTION: 8,
  DATA: 7,
  FORMAT: 7,
  EXAMPLE: 7,
  CONSTRAINT: 7,
};
const PILLAR_LETTER_DEMO: Record<PillarCode, string> = {
  SYSTEM: "S",
  ROLE: "R",
  INSTRUCTION: "I",
  DATA: "D",
  FORMAT: "F",
  EXAMPLE: "E",
  CONSTRAINT: "C",
};

function demoBadge(pillar: PillarCode, score: number | null): ContextCraftBadge {
  return {
    pillar,
    letter: PILLAR_LETTER_DEMO[pillar],
    earned: score !== null,
    bestScore: score ?? 0,
    maxScore: PILLAR_MAX_DEMO[pillar],
    threshold: 6,
    firstEarnedAt: score !== null ? new Date().toISOString() : null,
    evidenceArtifactId: null,
  };
}

// Cumulative pillar scores after each stage completes — F1 lights up a few,
// F2 (atomic prompt) drives every pillar past the threshold.
const PILLAR_SCORES_BY_STAGE: Record<StageId, Partial<Record<PillarCode, number>>> = {
  1: { SYSTEM: 6, ROLE: 6 },
  2: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
  3: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
  4: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
  5: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
  6: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
  7: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
  8: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, DATA: 6, FORMAT: 7, EXAMPLE: 6, CONSTRAINT: 7 },
};

// Which pillars become *newly* earned at each stage (for the per-stage WIN strip).
const NEW_PILLARS_AT_STAGE: Record<StageId, PillarCode[]> = {
  1: ["SYSTEM", "ROLE"],
  2: ["INSTRUCTION", "DATA", "FORMAT", "EXAMPLE", "CONSTRAINT"],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
};

// Main Quest Badges (ASPE / AISA / AISE) and where they conceptually unlock.
type QuestBadge = {
  id: "ASPE" | "AISA" | "AISE";
  name: string;
  icon: typeof Trophy;
  blurb: string;
  unlocksAtStage: StageId | null; // null = post-publish
};
const QUEST_BADGES: QuestBadge[] = [
  {
    id: "ASPE",
    name: "ADAPTIVE SPC PRACTITIONER",
    icon: ShieldCheck,
    blurb: "Earned after shipping 3 SPCs and 4 MA Birth Packages — unlocks DE-SPC auto-evolution.",
    unlocksAtStage: 5,
  },
  {
    id: "AISA",
    name: "AI SOLUTION ARCHITECT",
    icon: Award,
    blurb: "Earned after a complete ATLAS → Micro → MVP PDD lifecycle.",
    unlocksAtStage: 7,
  },
  {
    id: "AISE",
    name: "AI SOLUTION ENGINEER",
    icon: Trophy,
    blurb: "Earned by submitting a verified URL of a working SPC-DNA agent (GPT, Copilot, native app).",
    unlocksAtStage: null,
  },
];

const NEW_QUEST_AT_STAGE: Record<StageId, QuestBadge["id"][]> = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: ["ASPE"],
  6: [],
  7: ["AISA"],
  8: [],
};

type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
      "F4 is the smallest shippable spec. To certify the agent as a real, transferable artefact you need a Super Prompt Card. F5 grows the Micro PDD into a 15-section SPC through a disciplined 7-step FORGE Q&A.",
  },
  {
    id: 5,
    code: "F5",
    name: "SPC",
    tagline: "Super Prompt Card — 15 sections, born of 7-step FORGE Q&A.",
    icon: Layers,
    whyItMatters:
      "A Super Prompt Card (SPC) is the canonical, FORGE-certified specification for the agent. F5 doesn't free-write it — it walks you through a strict 7-step FORGE Q&A and only then synthesises the 15-section card in canonical order (BUGMXT SI is the exemplar). This is the artefact that promotes a Micro PDD into something defensible, transferable, and scoreable on JCSE.",
    inputLabel: "MICRO PDD FROM F4  +  7-STEP FORGE Q&A",
    inputBody: `Step 1  Identity & class
Step 2  Mission & doctrine
Step 3  Inputs, outputs, guardrails
Step 4  Workflow & decision logic
Step 5  Quality / refusal criteria
Step 6  Evidence & worked examples
Step 7  Score targets & certification level

(All 7 answered for: Morning Briefing MA, SI-class operator agent.)`,
    outputLabel: "SUPER PROMPT CARD (SPC) · 15 SECTIONS · FORGE CERTIFIED",
    outputBody: `# Super Prompt Card — Morning Briefing MA
# Class: SI · Cert: FORGE Certified · JCSE: 44 / 50

 1. Card Identity           Morning Briefing MA · SI Class · v0.1.0
 2. Mission Statement       Deliver a 150-word morning briefing at 06:00 local
                            that turns scattered context into one decision.
 3. Operating Doctrine      One agent, one trigger, one decision. Fail-soft.
 4. Capability Surface      cron · calendar · weather · rss · email
 5. Inputs Contract         calendar.events[24h], weather.forecast, rss.top3,
                            user.focus_string, user.timezone
 6. Outputs Contract        Plain-text email body, 4 sections, ≤ 200 words,
                            FIRST-THING line cites ≥ 1 calendar event.
 7. Workflow                fetch → compose → guardrail → send → log
 8. Decision Logic          If ≥ 2 sources fail → still send w/ "[unavailable]"
 9. Guardrails              200-word cap · no attendee emails in body
10. Refusal Criteria        Refuse send if compose() returns empty / off-topic
11. Worked Examples         3 canned briefings (Mon / Wed / Fri archetypes)
12. Evidence Anchors        AC-1..4 from Micro PDD + 7-day snapshot tests
13. Failure Modes           OAuth churn · tone drift · deliverability
14. JCSE Self-Score         S:6 R:7 I:7 D:6 F:7 E:5 C:6  → 44 / 50
15. Certification Block     FORGE Certified · SI Class · Issued 2026-05-20`,
    bridgeToNext:
      "The SPC is the certified spec — but it's still a card. F6 expands it into the 4-Part ATLAS Project Definition Document: the structured build plan an engineering team can pick up and execute.",
  },
  {
    id: 6,
    code: "F6",
    name: "ATLAS PDD",
    tagline: "4-part executable product spec.",
    icon: Workflow,
    whyItMatters:
      "The ATLAS PDD is the 4-Part Project Definition Document — cheat sheet, worksheet, evolution roadmap, and implementation plan. It's the canonical hand-off doc: every engineer who picks it up sees the same shape and can act in hours, not days. F6 inherits its executive summary directly FROM_SPC. F6-VDJ then recommends the IDE and vibe.",
    inputLabel: "SUPER PROMPT CARD FROM F5",
    inputBody: "Morning Briefing MA — 15-section FORGE-certified SPC, JCSE 44/50.",
    outputLabel: "4-PART ATLAS PDD (+ F6-VDJ recommendation)",
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
    bridgeToNext:
      "The MVP PDD is the spec. F8 Code DJ (Architect tier) takes that certified spec and scaffolds the actual codebase — a runnable bundle for your chosen platform, with the PDD baked into the manifest.",
  },
  {
    id: 8,
    code: "F8",
    name: "CODE DJ",
    tagline: "Scaffold the codebase from the certified MVP PDD.",
    icon: Code2,
    whyItMatters:
      "F8 turns the SPARTAN-certified MVP PDD into a runnable starter project — up to 12 files plus a manifest — targeted at one of five platforms (Next.js + Vercel, React + Vite static, Express on Replit, Expo mobile, or a pnpm monorepo). It refuses any MVP PDD that isn't SPARTAN-certified, so you can only DJ specs that survived F7. Architect tier only.",
    inputLabel: "CERTIFIED MVP PDD FROM F7  +  PLATFORM CHOICE",
    inputBody:
      "MVP PDD: Morning Briefing MA (SPARTAN-certified, score 47/50)\nPlatform: express-replit",
    outputLabel: "CODEBASE_BUNDLE (≤ 12 files + manifest)",
    outputBody: `# CODEBASE_BUNDLE — Morning Briefing MA
# platform: express-replit
# source:   MA-MORNINGBRIEF-0001  (SPARTAN ✓)

manifest.json
package.json
tsconfig.json
src/index.ts                      # Express boot + /healthz
src/cron/morningBriefing.ts       # cron handler @ 06:00
src/adapters/calendar.ts          # Google Calendar tool wrapper
src/adapters/weather.ts           # OpenWeather tool wrapper
src/adapters/rss.ts               # RSS fetch tool wrapper
src/adapters/email.ts             # Resend tool wrapper
src/lib/compose.ts                # 150-word briefing composer
src/lib/guardrails.ts             # word cap + PII redaction
README.md                         # how to run, env vars, ACs
.env.example                      # CAL / WEATHER / RSS / RESEND keys

──────────────────────────────────────────────
MANIFEST EXCERPT
  sourcePddId:   MA-MORNINGBRIEF-0001
  sourceCertId:  SPARTAN-2026-05-20-3b1c
  platform:      express-replit
  fileCount:     12 / 12  ✓ within cap
  acceptanceTests:
    - AC-1 cron-fires-within-5min   → tests/cron.spec.ts
    - AC-2 word-count-120-200       → tests/compose.spec.ts
    - AC-3 cites-calendar-event     → tests/compose.spec.ts
    - AC-4 graceful-source-failure  → tests/adapters.spec.ts`,
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
  8: Code2,
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
              THE 8-STAGE <span className="text-primary">DEMO SESSION</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground font-serif max-w-3xl leading-relaxed">
              Watch one raw idea move through the entire FORGE.BONSAI HARNESS — from
              fuzzy human prompt to SPARTAN-certified MVP PDD, and on into a runnable
              codebase via F8 Code DJ — using a real worked example. Read at your own
              pace. No tokens spent, no session created.
            </p>
            <div className="mt-6 p-4 rounded-lg border bg-card/60 font-mono text-xs md:text-sm">
              <div className="text-muted-foreground mb-1">WORKED EXAMPLE</div>
              <div className="text-foreground">"{SCENARIO.rawIdea}"</div>
              <div className="text-primary mt-2">
                → becomes <span className="font-bold">{SCENARIO.agentName}</span>, certified at F7,
                <span className="text-foreground"> earning </span>
                <span className="font-bold">7 Context Craft triangles</span>
                <span className="text-foreground"> + </span>
                <span className="font-bold">2 Quest crests</span> along the way, then DJ'd
                into a runnable codebase at F8.
              </div>
            </div>
          </div>
        </section>

        {/* ON-RAMPS — three ways to start a session */}
        <section className="border-b bg-card/30">
          <div className="container px-4 md:px-6 py-8 md:py-12 max-w-5xl">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-primary tracking-wider mb-3">
              <Compass className="h-3.5 w-3.5" />
              ON-RAMPS · THREE WAYS TO START A SESSION
            </div>
            <h2 className="font-display text-2xl md:text-3xl tracking-wider mb-2">
              BRING WHATEVER YOU HAVE
            </h2>
            <p className="text-sm md:text-base text-muted-foreground font-serif max-w-3xl leading-relaxed mb-6">
              The 8-stage HARNESS below is the same regardless of how you enter it.
              What changes is the seed: a raw idea, an existing design doc you upload,
              or a full project cartridge of docs + prior SPCs + live code/database
              links. Pick the on-ramp that matches the context you already have.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Manual */}
              <div
                className="rounded-lg border bg-background p-5 flex flex-col gap-3"
                data-testid="demo-onramp-manual"
              >
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-display tracking-wider text-base">MANUAL</div>
                  <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border border-primary/40 bg-primary/5 text-primary">
                    ANY TIER
                  </span>
                </div>
                <div className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground">
                  RAW IDEA → F1 DIAGNOSTIC
                </div>
                <p className="text-sm font-serif text-foreground/90 leading-snug">
                  Type a fuzzy prompt, hit F1, walk the eight stages yourself. This is
                  the worked example below.
                </p>
                <ul className="text-xs font-mono text-muted-foreground space-y-1 mt-auto">
                  <li>· Origin: <span className="text-foreground">manual</span></li>
                  <li>· Output: <span className="text-foreground">MVP PDD</span></li>
                  <li>· Cost: <span className="text-foreground">subscription only</span></li>
                </ul>
              </div>

              {/* Ingestion */}
              <div
                className="rounded-lg border border-secondary/40 bg-secondary/5 p-5 flex flex-col gap-3"
                data-testid="demo-onramp-ingestion"
              >
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-md bg-secondary/15 border border-secondary/40 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-secondary" />
                  </div>
                  <div className="font-display tracking-wider text-base">INGESTION</div>
                  <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border border-secondary/40 bg-secondary/10 text-secondary">
                    1 CREDIT / PROJECT
                  </span>
                </div>
                <div className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground">
                  IPDD UPLOAD → PWDD SESSION
                </div>
                <p className="text-sm font-serif text-foreground/90 leading-snug">
                  Already have a Product Design Document, brief, or spec sheet? Upload
                  the <span className="font-bold">IPDD</span> (PDF / DOCX / pasted text).
                  We extract, summarise, and seed F1 with a clean prompt. The session
                  produces a <span className="font-bold">PWDD</span> instead of a manual MVP PDD.
                </p>
                <ul className="text-xs font-mono text-muted-foreground space-y-1 mt-auto">
                  <li>· Origin: <span className="text-foreground">ingested</span></li>
                  <li>· Output: <span className="text-foreground">PWDD (PromptWare DD)</span></li>
                  <li>· Cost: <span className="text-foreground">one-off credit, any tier</span></li>
                </ul>
              </div>

              {/* Advanced Cartridge */}
              <div
                className="rounded-lg border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-secondary/5 p-5 flex flex-col gap-3"
                data-testid="demo-onramp-cartridge"
              >
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-md bg-primary/15 border border-primary/40 flex items-center justify-center">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-display tracking-wider text-base">CARTRIDGE</div>
                  <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border border-primary/50 bg-primary/15 text-primary">
                    $499.99 / PROJECT
                  </span>
                </div>
                <div className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground">
                  FULL CONTEXT BUNDLE → F1–F7 ALL UNLOCKED
                </div>
                <p className="text-sm font-serif text-foreground/90 leading-snug">
                  Premium on-ramp for projects with multi-document context, prior SPCs,
                  and live <span className="font-bold">git</span> or{" "}
                  <span className="font-bold">database</span> link descriptors.
                  Define scope (hard-validated, ≥ 80 chars), drop in your assets, and
                  every engine call gets your authoritative cartridge context prepended
                  automatically.
                </p>
                <ul className="text-xs font-mono text-muted-foreground space-y-1 mt-auto">
                  <li className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Multi-doc summaries
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" /> Prior SPCs accepted
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Database className="h-3 w-3" /> Git + DB link descriptors
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-4 text-[11px] font-mono text-muted-foreground">
              All three on-ramps feed the same F1–F8 pipeline shown below.
              <span className="text-foreground">
                {" "}
                F8 Code DJ remains Architect-tier-only regardless of how the session started.
              </span>
            </div>
          </div>
        </section>

        {/* WIN STATES PREVIEW — what you'll have at the end */}
        <section className="border-b bg-gradient-to-b from-background to-secondary/5">
          <div className="container px-4 md:px-6 py-8 md:py-12 max-w-5xl">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-secondary tracking-wider mb-3">
              <Trophy className="h-3.5 w-3.5" />
              TROPHY ROOM · WHAT YOU'LL UNLOCK
            </div>
            <h2 className="font-display text-2xl md:text-3xl tracking-wider mb-2">
              EVERY STAGE EARNS A BADGE
            </h2>
            <p className="text-sm md:text-base text-muted-foreground font-serif max-w-3xl leading-relaxed mb-6">
              The HARNESS turns prompt-engineering into a quest. Every certified
              artefact bumps your scores; every threshold crossed mints a permanent
              badge. This is the trophy shelf you walk away with after one
              complete session of the worked example.
            </p>

            {/* Context Craft triangles — preview as earned */}
            <Card className="border-l-4 border-l-primary/60 mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="font-display text-base md:text-lg tracking-wider">
                      CONTEXT CRAFT · 7 PILLAR BADGES
                    </CardTitle>
                    <CardDescription className="text-xs font-mono mt-1">
                      Auto-awarded when an F1 / F2 prompt scores ≥ 6 on the pillar.
                    </CardDescription>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded border border-primary/40 bg-primary/10 text-primary">
                    PREVIEW · DEMO RUN EARNS ALL 7
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 sm:gap-6 justify-center sm:justify-start">
                  {(Object.keys(PILLAR_LETTER_DEMO) as PillarCode[]).map((p) => (
                    <PillarTriangle
                      key={p}
                      badge={demoBadge(p, PILLAR_SCORES_BY_STAGE[2][p] ?? 6)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quest crests — preview */}
            <div className="grid gap-3 sm:grid-cols-3">
              {QUEST_BADGES.map((q) => {
                const Icon = q.icon;
                const wouldEarn = q.unlocksAtStage !== null;
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-4 flex flex-col gap-2 ${
                      wouldEarn
                        ? "border-primary/40 bg-primary/5"
                        : "border-muted-foreground/30 bg-muted/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-5 w-5 ${
                          wouldEarn ? "text-yellow-300" : "text-muted-foreground"
                        }`}
                      />
                      <span className="font-display tracking-wider text-sm">
                        {q.id}
                      </span>
                      <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border">
                        {wouldEarn ? "EARNS IN DEMO" : "POST-LAUNCH"}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground">
                      {q.name}
                    </div>
                    <p className="text-xs font-serif text-foreground/80 leading-snug">
                      {q.blurb}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stage progress bar */}
        <section className="border-b bg-card/40 sticky top-20 z-30 backdrop-blur supports-[backdrop-filter]:bg-card/40">
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
                    STAGE {stage.id} OF 8 · {stage.code}
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

          {/* BADGES UNLOCKED THIS STAGE */}
          {(NEW_PILLARS_AT_STAGE[stage.id].length > 0 ||
            NEW_QUEST_AT_STAGE[stage.id].length > 0) && (
            <div className="mt-5 rounded-lg border border-primary/40 bg-primary/5 p-4 md:p-5">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-mono font-bold text-primary tracking-wider mb-3">
                <Trophy className="h-3.5 w-3.5" />
                BADGES UNLOCKED THIS STAGE
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                {NEW_PILLARS_AT_STAGE[stage.id].map((p) => (
                  <PillarTriangle
                    key={p}
                    badge={demoBadge(p, PILLAR_SCORES_BY_STAGE[stage.id][p] ?? 6)}
                    size={48}
                  />
                ))}
                {NEW_QUEST_AT_STAGE[stage.id].map((qid) => {
                  const q = QUEST_BADGES.find((x) => x.id === qid)!;
                  const Icon = q.icon;
                  return (
                    <div
                      key={qid}
                      className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2"
                      data-testid={`demo-quest-${qid.toLowerCase()}`}
                    >
                      <Icon className="h-6 w-6 text-yellow-300" />
                      <div>
                        <div className="font-display tracking-wider text-sm">{qid}</div>
                        <div className="text-[9px] font-mono text-muted-foreground tracking-wider">
                          {q.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                <div className="pt-2">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-primary mb-3">
                    YOUR TROPHY WALL AFTER ONE SESSION
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {(Object.keys(PILLAR_LETTER_DEMO) as PillarCode[]).map((p) => (
                      <PillarTriangle
                        key={p}
                        badge={demoBadge(p, PILLAR_SCORES_BY_STAGE[7][p] ?? 6)}
                        size={44}
                        showLabel={false}
                      />
                    ))}
                    {QUEST_BADGES.filter((q) => q.unlocksAtStage !== null).map((q) => {
                      const Icon = q.icon;
                      return (
                        <div
                          key={q.id}
                          className="h-[44px] w-[44px] rounded-md border border-primary/50 bg-primary/15 flex items-center justify-center"
                          title={`${q.id} — ${q.name}`}
                        >
                          <Icon className="h-5 w-5 text-yellow-300" />
                        </div>
                      );
                    })}
                  </div>
                </div>
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
