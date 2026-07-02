// Builds the SPARTAN-certified MVP PDD as an investor-grade PDF.
//
// Renders the FORGE.BONSAI HARNESS F7 output (the SPARTAN compression of the
// ATLAS Living PDD) using the SAME pdfkit design system as the 4-Part ATLAS PDD
// (Investor Edition) — shared via ./lib/atlas-pdf-theme.mjs — so the two
// documents are visually uniform.
//
// Source content: docs/ATANDA_Command_Centre_MVP_PDD_SPARTAN_Living.md
// Run: node scripts/src/build-spartan-mvp-pdd.mjs

import { createRequire } from "node:module";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTheme } from "./lib/atlas-pdf-theme.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

const OUT_PATH = resolve(repoRoot, "docs/ATANDA_Command_Centre_MVP_PDD_SPARTAN_Certified.pdf");
mkdirSync(dirname(OUT_PATH), { recursive: true });

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "ATANDA Command Centre — SPARTAN-Certified MVP PDD",
    Author: "FORGE.BONSAI HARNESS (F7 — SPARTAN Compressor)",
    Subject: "SPARTAN-certified MVP Product Design Document"
  }
});
doc.pipe(createWriteStream(OUT_PATH));

const {
  hr, partHeader, h2, h3, p, lead, bullets, kv, code, phaseBlock, table,
  NAVY, ACCENT, GREY, SOFT, GOLD, PHASE_COLOURS
} = createTheme(doc);

// ────────────────────────────────────────────────────────────────────────────
// COVER PAGE
// ────────────────────────────────────────────────────────────────────────────
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(38).text("ATANDA", { align: "left" });
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(38).text("Command Centre");
doc.moveDown(0.2);
doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(13).text("SPARTAN-CERTIFIED MVP PDD  ·  CERTIFIED EDITION", { characterSpacing: 2 });
doc.moveDown(0.4);
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(12).text("Produced via the FORGE.BONSAI HARNESS (F7 — SPARTAN Compressor)");
doc.moveDown(3);
hr(ACCENT);

h3("Document classification");
kv([
  ["Audience", "Investors, board members, engineering leadership"],
  ["Origin", "FORGE.BONSAI HARNESS · F7 SPARTAN-certified MVP PDD format"],
  ["Source artifact", "ATANDA Command Centre live codebase (Replit pnpm monorepo)"],
  ["Mode", "FROM_CODEBASE — Input Type B (Codebase), grounded entirely in shipped code"],
  ["Generated", new Date().toISOString().slice(0, 10)]
]);

h3("Certification header");
kv([
  ["Compression ID", "SPRT-AC-CC-CURRENT-2026-006"],
  ["Source", "ATANDA Command Centre live codebase (July 2026)"],
  ["Source PDD ref", "ATANDA_Command_Centre_Living_PDD_ATLAS (JNGL-ACC-PDD-CUR-2026-001)"],
  ["Supersedes", "SPRT-AC-CC-CURRENT-2026-005"],
  ["Compressor", "SPARTAN SPC v1.0 · JCSE 49/50 · Wolf · PLATINUM"],
  ["ZPOS+5", "PRISM (97.0%) · QUANTUM (96.0%) · SYNTHESIS (96.5%)"],
  ["VIBE DJ", "Replit Agent + Workspaces (94/100 · TARANTULA-class)"],
  ["HOST DJ", "Replit Deployments — Autoscale (see Section 4)"],
  ["Status", "SPARTAN COMPRESSION COMPLETE · CERTIFIED · 26/28 SHIPPED · 2 DEFERRED (B)"]
]);

doc.moveDown(0.4);
lead("\u201CSPARTAN compresses the scaffolding, not the substance. Every engine, every billing path, every drift gate — intact. The codebase leaves the building (IDE + GitHub) and, with F8-HDJ, knows where it should run.\u201D");
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(9).text("— SPARTAN SPC × VIBE DJ × HOST DJ · FORGE Institute");

doc.moveDown(0.8);
h3("Honesty legend");
p("This is a compression of the ATLAS Living PDD, so FFS measures whether features survive the compression. 26 of 28 features are SHIPPED and live in the current codebase; the 2 subscription features (F-02 Clerk auth, F-03 Stripe billing) are DEFERRED as a B-level upgrade — fully coded and tested but held dormant behind SUBSCRIPTIONS_ENABLED=false while the product runs as an internal staff tool (shared access code). Per the Honesty Gate G3, speculative ROI / cost-savings are reported as NOT CLAIMED.");

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 — SPARTAN COMPRESSION REPORT
// ────────────────────────────────────────────────────────────────────────────
partHeader("SECTION 1", "SPARTAN Compression Report · SCM 7-Step", ACCENT);

h3("Step 1 — SCAN · Source Manifest");
code(`Source:          ATANDA Command Centre live codebase
Repo shape:      pnpm monorepo (Node 24 · TypeScript 5.9)
Artifacts:       3   (api-server, command-centre web, mockup-sandbox)
API surface:     135 endpoints across 28 route files
DB tables:       31  (one Drizzle file each, barrel re-export)
HARNESS engines: 18 shipped (F1, F2, F3, F4, F5, F6, F6-VDJ, F7,
                     DE-SPC, F8 Code DJ, ATLAS-J, PFP, F8-HDJ / HOST DJ,
                     F0 advisory, F0.5 MATHMON, MAP, Magnet Calculator,
                     Magnet Test Kit)
Client pages:    active staff surface (command, sessions, F1-F8 workspaces,
                     ingest, cartridge, quests, ascension, verify, admin,
                     F0 advisory dashboard) + public magnet funnel
                     (calculate-your-savings, test-your-agent);
                     subscription/billing/org/pricing pages retained but
                     dormant (unrouted) behind SUBSCRIPTIONS_ENABLED.
Scheduled ops:   3 cron targets via scripts cron-tick + Replit Scheduled
                     Deployments, gated by CRON_SECRET:
                     reset-harness-limits (daily 00:00 UTC),
                     send-weekly-digest (Mon 09:00 UTC),
                     run-f0-monitoring (Mon 08:00 UTC — weekly retainer
                     sweep, persists f0_monitoring_runs, emails breaches).
Delivery layer:  F8 IDE export bundle (ZIP + AGENTS.md) + push-to-GitHub
Access model:    INTERNAL staff tool — one shared STAFF_ACCESS_CODE + typed
                     name (attribution); signed session cookie. Clerk +
                     subscription tiers deferred (see CLASS B / Section 3).
Billing SKUs:    DEFERRED (B-level) — subscription tiers x2 cadences,
                     per-seat team/team-lite, 2 one-time (ingestion,
                     cartridge $499.99). Code kept dormant, reversible via
                     SUBSCRIPTIONS_ENABLED=true.`);

p("Feature Registry (all user-facing — CLASS A by definition):");
code(`[F-01] Staff front door — shared access code + typed name (attribution)
[F-02] Auth (Clerk) + subscription tiers — DEFERRED (B-level, dormant)
[F-03] Subscription tier billing (Stripe + per-seat orgs) — DEFERRED (B)
[F-04] Session create / list / resume
[F-05] F1 Test Your Prompt (7-pillar JCSE diagnostic)
[F-06] F2 Build Atomic Prompt (7-pillar wizard)
[F-07] F3 Build an MA (CELL Birth Package, SSE)
[F-08] F4 Convert to Micro PDD
[F-09] F5 Build an SPC (FORGE Q&A)
[F-10] F6 Draft a 4-Part ATLAS PDD
[F-11] F6-VDJ VIBE recommendation (which IDE)
[F-12] F7 Compress to SPARTAN-certified MVP PDD + public verify URL
[F-13] DE-SPC (digital evolution, Practitioner + ASPE)
[F-14] F8 Code DJ (Architect, 5 target platforms)
[F-15] ATLAS-J — typed JSON crystallisation of an ATLAS PDD
[F-16] PFP — drift detector + F8 hard drift gate
[F-17] Ingestion engine + per-project ingestion credit
[F-18] Advanced Cartridge + per-project $499.99 credit
[F-19] Quest badges (ASPE/AISA/AISE + AISA_PWDD + AISE_BUILD + Context Craft)
[F-20] Account self-delete (Stripe -> Clerk -> local cascade)
[F-21] Daily rate-limit reset cron + per-engine telemetry + cost dashboard/cap
[F-22] F8 IDE export bundle (ZIP + AGENTS.md, per-IDE adapters)
[F-23] F8 push-to-GitHub (per-user PAT/OAuth, repo picker, seed, PR)
[F-24] F8-HDJ HOST DJ — hosting decision + deployment journey engine
[F-25] F0 advisory suite — engagements, SOCRATES discovery, ensemble
       reports (SSE), retainers + commentary, weekly CAPI monitoring
       sweep with breach alert emails (cron run-f0-monitoring)
[F-26] F0.5 MATHMON intake — mathematical-rigor applicability profiling
[F-27] MAP — Mathematical Applicability Profile (SSE, FORGE VERIFIED gate)
[F-28] Magnet funnel — public savings calculator + agent test kit
       (anonymous, IP rate-limited, global cost budget)`);

h3("Step 2 — PROFILE · Classification Results");
code(`TOTAL FEATURES CLASSIFIED: 28

CLASS A — PRESERVE (28 features · 100%)
  Every user-facing capability above. FFS target = 100%.

CLASS B — SYNTHESISE (merged into other prompts, 0 deltas to user)
  · Per-engine telemetry            -> merged into shared LLM caller
  · Rate-limit reset cron           -> merged into cron prompt
  · Stripe webhook idempotency      -> merged into webhook prompt
  · Cartridge context loader        -> merged into shared LLM caller
  · SSRF-hardened URL verifier      -> merged into badges lib
  · Cross-provider test fixtures    -> merged into test rig prompt
  · Per-user GitHub credential crypto + client -> merged into integrations
  · F8-HDJ HRP normaliser + cost/tier guard    -> merged into F8-HDJ prompt
  · F0 sweep 6-day skip window + cost-cap halt -> merged into F0 cron prompt
  · Magnet IP rate-limit + global cost budget  -> merged into magnet routes

DEFERRED — B-LEVEL UPGRADE (built, dormant, one flag away)
  · Subscriptions & billing: Clerk auth, Stripe tiers, per-seat orgs,
    per-project credits (ingestion/cartridge), F1000. Fully coded and
    tested; gated OFF behind SUBSCRIPTIONS_ENABLED=false so the active
    product runs as an internal staff tool. Flip to true to re-activate.

CLASS C — DEFER (Phase 7 / upgrade-triggered)
  · Two-way federated marketplace (Sphinx + ARK identity federation)
  · Native mobile (Expo) shell over the same API
  · Multi-region database read replicas
  · Real-time collaborative sessions (CRDT)
  · Public REST API for third-party integrations
  · F8-HDJ "execute the deploy" automation (stays advisory)`);

h3("Step 3 — ASSESS · VIBE DJ + HOST DJ Verdict");
p("VIBE DJ (which IDE builds it): Replit Agent + Workspaces — 94/100 · TARANTULA-class. Native path-routed artifacts, Replit-managed Clerk, AI Integrations proxy, App Storage, first-class Stripe + Postgres. Stack stands up with zero infra YAML.");
p("HOST DJ / F8-HDJ (where it runs): Replit Deployments — Autoscale. HSE 8-criterion run on THIS codebase:");
table(
  ["Criterion (weight)", "Replit Autoscale", "AWS ECS+RDS", "Vercel+Railway+Supabase"],
  [
    ["Stack Compatibility 25%", "native proxy", "rebuild", "split front/back"],
    ["Cost at scale 20%", "scale-to-zero", "high floor", "3 bills"],
    ["Deploy Simplicity 15%", "one click", "weeks", "3 dashboards"],
    ["Database Fit 15%", "managed PG", "RDS", "Supabase migration"],
    ["CI/CD 10%", "built-in", "GH Actions", "yes"],
    ["Compliance 10%", "GDPR", "HIPAA+BAA", "SOC2"],
    ["Scalability ceiling 3%", "autoscale", "unlimited", "yes"],
    ["Lock-in risk 2%", "Replit-specific", "AWS-deep", "3 vendors"]
  ],
  [0.31, 0.23, 0.23, 0.23]
);
p("PRIMARY: Replit Deployments (Autoscale) — matches what the codebase already targets. FALLBACK: AWS (ECS + RDS + CloudFront) if HIPAA/BAA or hard region SLAs are required.");

h3("Steps 4–5 — REDUCE + TRANSFORM");
code(`Merge log (CLASS B -> CLASS A absorption):
  · engines/shared.callLlm also loads cartridge context (LRU, fenced) and
    writes harness_engine_runs telemetry.
  · cron/reset-harness-limits zeros the per-engine daily counters.
  · routes/stripe-webhook records event_id idempotency first, rolls back on
    throw, refuses unknown price ids loudly, cartridge before ingestion.
  · lib/badges.headOk rejects RFC1918/loopback/link-local/metadata/CGNAT/
    multicast/non-https; reused by AISE_BUILD.
  · routes/integrations shares ONE per-user credential path across list-repos
    AND push; Architect-gated.
  · F8-HDJ folds the HRP normaliser, HSE matrix, DJG journey, and SDF emitter
    into one engine prompt; reuses the harness route middleware chain and
    persistArtifact(HOSTING_PLAN).
  · cron/run-f0-monitoring sweeps every ACTIVE F0 retainer weekly, skips
    retainers swept within 6 days, halts LLM spend at the monthly cost cap,
    persists f0_monitoring_runs, and emails owners on ACT_SOON/ACT_NOW
    breaches (gated on retainerAlertsEnabled).
  · Magnet routes share one anonymous path: magnetRateLimit (5/hr per IP)
    + requireGlobalCostBudget; sessions logged to magnet_sessions.

Containment check: no CLASS A feature lost. FFS = 100%.`);

h3("Step 6 — ZPOS+5 Application");
code(`PRISM     (P0 prompt compression)        applied · 97.0% retention
QUANTUM   (technical token reduction)    applied · 96.0% retention
SYNTHESIS (structured-output prompts)    applied · 96.5% retention

Net token delta on system prompts vs ATLAS Living PDD: -38%
Net feature delta:                                       0 losses (28/28 kept)`);

h3("Step 7 — PACKAGE · Quality Gate Results");
table(
  ["Gate", "Target", "Result", "Status"],
  [
    ["FFS — Feature Fidelity", "\u2265 95%", "100%", "PASS"],
    ["AVS — Architecture Viability", "\u2265 90%", "96%", "PASS"],
    ["CIS — Compression Integrity", "\u2265 90%", "94%", "PASS"],
    ["UIS — Upgrade Integrity", "\u2265 85%", "92%", "PASS"],
    ["CR_p — Prompt-count reduction", "\u2265 60%", "67% (110 \u2192 36)", "PASS"],
    ["CR_t — Token reduction", "\u2265 30%", "38%", "PASS"],
    ["CR_c — Cost-of-infra delta", "\u2264 +10%", "~0% (same Replit)", "PASS"]
  ],
  [0.4, 0.18, 0.27, 0.15]
);

// ────────────────────────────────────────────────────────────────────────────
// SECTION 2 — ARCHITECTURE REDUCTION
// ────────────────────────────────────────────────────────────────────────────
partHeader("SECTION 2", "Architecture Reduction — Stack Collapse Map", PHASE_COLOURS.GREEN);

h3("2.1 What stays — all 28 features survive the compression (FFS = 100%)");
p("All features below are SHIPPED in the current codebase. The MVP column is the compressed prompt id, not a separate claim of merge.");
table(
  ["#", "Feature", "Production Implementation", "MVP (Merged)"],
  [
    ["F-01", "Staff access code front door", "routes/staff-auth + lib/staff-auth", "MVCC-WEB-001"],
    ["F-02", "Clerk auth (DEFERRED B)", "clerkProxy + ensureLocalUser (dormant)", "MVCC-AUTH-001"],
    ["F-03", "Stripe billing + orgs (DEFERRED B)", "routes/billing + orgs + stripe-webhook (dormant)", "MVCC-BILL-001"],
    ["F-04", "Session CRUD", "routes/sessions", "MVCC-SESS-001"],
    ["F-05..F-12", "F1–F7 + F6-VDJ", "engines/f1..f7 + f6vdj", "MVCC-F1..F7"],
    ["F-13", "DE-SPC", "engines/de (open to all staff)", "MVCC-DE"],
    ["F-14", "F8 Code DJ", "engines/f8codedj + drift gate", "MVCC-F8"],
    ["F-15", "ATLAS-J", "engines/atlas-crystallise", "MVCC-ATLASJ"],
    ["F-16", "PFP", "engines/pfp + latestPfpForMvp", "MVCC-PFP"],
    ["F-17", "Ingestion + credit", "routes/ingest + ingestion-credits", "MVCC-INGEST"],
    ["F-18", "Cartridge + credit", "routes/cartridge + cartridge-context", "MVCC-CART"],
    ["F-19", "Quest badges", "lib/badges + context-craft-badges", "MVCC-QUEST"],
    ["F-20", "Account delete", "routes/me (external-first)", "MVCC-ACCT"],
    ["F-21", "Cron + telemetry + cost cap", "routes/cron + harness_engine_runs + cost-budget", "MVCC-OPS"],
    ["F-22", "F8 IDE export bundle", "command-centre/lib/codeDjExport.ts", "MVCC-EXPORT"],
    ["F-23", "F8 push-to-GitHub", "routes/integrations + lib/github + PushToGitHubButton", "MVCC-GITHUB"],
    ["F-24", "F8-HDJ HOST DJ", "engines/f8hdj + routes/harness + HOST DJ card", "MVCC-HDJ"],
    ["F-25", "F0 advisory suite + monitoring", "engines/f0 + routes/f0 + cron run-f0-monitoring", "MVCC-F0"],
    ["F-26", "F0.5 MATHMON intake", "engines/f05 + MathmonLayer", "MVCC-MATHMON"],
    ["F-27", "MAP profile (SSE)", "engines/map + routes/harness", "MVCC-MAP"],
    ["F-28", "Magnet funnel (public)", "engines/magnet-* + magnet routes + 2 public pages", "MVCC-MAGNET"]
  ],
  [0.1, 0.26, 0.42, 0.22]
);

h3("2.2 CLASS B merges (0 user impact)");
table(
  ["Original concern", "Merged into"],
  [
    ["Cartridge context loader / telemetry", "engines/shared.callLlm"],
    ["Webhook idempotency", "routes/stripe-webhook (event_id PK, rollback on throw)"],
    ["SSRF hardening", "lib/badges.headOk"],
    ["Cross-provider fixtures", "test/llm-cache (UUID + ISO normalised cache key)"],
    ["Server-side recomputed PFP counts/verdict", "engines/pfp (before persist)"],
    ["Per-user GitHub credential crypto + client", "routes/integrations (shared by list + push)"],
    ["F8-HDJ HRP + cost/tier guard", "engines/f8hdj (harness route middleware chain)"]
  ],
  [0.45, 0.55]
);

// ────────────────────────────────────────────────────────────────────────────
// SECTION 3 — COMPRESSED MVP WORKSHEET
// ────────────────────────────────────────────────────────────────────────────
partHeader("SECTION 3", "Compressed MVP Worksheet — 36 Prompts · 7 Phases", PHASE_COLOURS.YELLOW);

phaseBlock({
  colourName: "RED",
  header: "Foundation",
  duration: "Week 1 · 6 prompts",
  status: "SHIPPED",
  deliverables: [
    "MVCC-MONO-001 — pnpm monorepo skeleton + tsconfig.base + workspaces",
    "MVCC-DB-001 — Drizzle schema (all 20 tables, one file each, barrel export)",
    "MVCC-AUTH-001 — Staff access-code front door (shared code + attribution, signed cookie); Clerk proxy retained but dormant (DEFERRED B)",
    "MVCC-API-001 — Express app + middleware order (Sentry -> Clerk proxy -> webhook raw -> cors -> json -> clerkMw -> /api)",
    "MVCC-SPEC-001 — OpenAPI + Orval codegen (Zod request schemas + RQ hooks)",
    "MVCC-OPS-001 — pino + Sentry (DSN-gated) + cron route + per-engine telemetry"
  ],
  exit: "Monorepo + DB + Auth + API spine stand up; healthz green."
});

phaseBlock({
  colourName: "ORANGE",
  header: "Billing & Sessions",
  duration: "Week 2 · 5 prompts",
  status: "SESSIONS SHIPPED · BILLING DEFERRED (B)",
  deliverables: [
    "MVCC-BILL-001 — Stripe Checkout + Portal + webhook — DEFERRED (B-level, dormant behind SUBSCRIPTIONS_ENABLED)",
    "MVCC-ORG-001 — Orgs + members + invites + per-seat checkout — DEFERRED (B-level, dormant)",
    "MVCC-CRED-001 — Ingestion + cartridge credits — DEFERRED (B-level; claim/release bypassed when subscriptions off)",
    "MVCC-WEB-001 — Staff access-code front door + TopNav (pricing/billing dormant)",
    "MVCC-SESS-001 — Session CRUD + feature-state unlock chain"
  ],
  exit: "Sessions + staff front door are live; billing/orgs/credits dormant behind SUBSCRIPTIONS_ENABLED."
});

phaseBlock({
  colourName: "YELLOW",
  header: "HARNESS Engines F1–F7",
  duration: "Week 3 · 9 prompts",
  status: "SHIPPED",
  deliverables: [
    "MVCC-LLM-001 — engines/shared.callLlm + callLlmJson (cartridge ctx + telemetry + provider switching + requireCostBudget after rateLimit)",
    "MVCC-F1..F7 — F1 diagnostic, F2 atomic, F3 MA SSE, F4 micro PDD, F5 SPC + DE-SPC, F6 ATLAS PDD + F6-VDJ, F7 SPARTAN MVP PDD + public verify URL",
    "MVCC-BADGE-001 — lib/badges (ASPE/AISA/AISE live + AISE_BUILD persist + SSRF + Context Craft)"
  ],
  exit: "Core HARNESS F1–F7 + badges operate end to end."
});

phaseBlock({
  colourName: "GREEN",
  header: "Advanced Engines + Intake",
  duration: "Week 4 · 5 prompts",
  status: "SHIPPED",
  deliverables: [
    "MVCC-INGEST — POST /api/ingest (pdf-parse + mammoth + normaliser + atomic claim)",
    "MVCC-CART — POST /api/cartridge (multipart, SCOPE_REQUIRED)",
    "MVCC-F8 — F8 Code DJ (5 platforms, Architect, refuses no-spartan-cert)",
    "MVCC-ATLASJ — ATLAS-J (separate endpoint to preserve F6 fixture hashes)",
    "MVCC-PFP — PFP (server-side recompute) + F8 DRIFT_GATE (409 + acknowledge)"
  ],
  exit: "F8 + ATLAS-J + PFP + ingestion + cartridge complete."
});

phaseBlock({
  colourName: "BLUE",
  header: "Delivery / Handoff",
  duration: "Week 5 · 4 prompts",
  status: "SHIPPED",
  deliverables: [
    "MVCC-EXPORT — codeDjExport.ts: CODEBASE_BUNDLE -> ZIP + AGENTS.md + per-IDE adapters; SEND TO IDE",
    "MVCC-GH-001 — Per-user GitHub credential: paste PAT or one-click OAuth (AES-256-GCM)",
    "MVCC-GH-002 — GET /integrations/github/repos + PushToGitHubButton picker; push = create/update/empty-seed/PR",
    "MVCC-HDJ — engines/f8hdj (HOST DJ): HRP -> HSE matrix -> primary+fallback -> DJG journey -> SDF artifacts; HOSTING_PLAN; Architect"
  ],
  exit: "Codebase leaves the building: IDE export + GitHub + HOST DJ."
});

phaseBlock({
  colourName: "INDIGO",
  header: "QA + Launch",
  duration: "Week 6 · 3 prompts",
  status: "SHIPPED",
  deliverables: [
    "MVCC-TEST-001 — Vitest provider-switching rig (cached fixtures, UUID+ISO key, nightly drift)",
    "MVCC-ACCT-001 — /api/me/delete (Stripe/Clerk cascade skipped for staff users -> local cascade) + goodbye",
    "MVCC-LAUNCH-001 — Workflows + artifact registration + /healthz + Sentry + EMAIL_FROM + PUBLIC_BASE_URL + smoke E2E"
  ],
  exit: "Tests, account delete, and launch wiring all green."
});

phaseBlock({
  colourName: "VIOLET",
  header: "Advisory + Funnel",
  duration: "Week 7 · 4 prompts",
  status: "SHIPPED",
  deliverables: [
    "MVCC-F0 — F0 advisory suite: engagements + SOCRATES discovery + ensemble reports (SSE) + retainers + weekly CAPI monitoring sweep (cron run-f0-monitoring: 6-day skip window, cost-cap halt, breach emails, f0_monitoring_runs)",
    "MVCC-MATHMON — F0.5 MATHMON intake (applicability profiling, mathmon_intakes)",
    "MVCC-MAP — MAP Mathematical Applicability Profile (SSE, server-recomputed sub-scores, FORGE VERIFIED gate)",
    "MVCC-MAGNET — Public magnet funnel: savings calculator + agent test kit (magnetRateLimit 5/hr per IP + requireGlobalCostBudget, magnet_sessions)"
  ],
  exit: "Advisory layer + top-of-funnel magnets live; scheduled ops verified (3 cron targets via cron-tick, CRON_SECRET-gated)."
});

h3("Worksheet summary");
table(
  ["Phase", "Prompts", "Week", "Theme"],
  [
    ["1 RED", "6", "Week 1", "Monorepo + DB + Auth + API spine"],
    ["2 ORANGE", "5", "Week 2", "Sessions + staff front door (billing/orgs deferred B)"],
    ["3 YELLOW", "9", "Week 3", "Core HARNESS F1–F7 + badges"],
    ["4 GREEN", "5", "Week 4", "F8 + ATLAS-J + PFP + ingestion + cartridge"],
    ["5 BLUE", "4", "Week 5", "Delivery: IDE export + GitHub + F8-HDJ"],
    ["6 INDIGO", "3", "Week 6", "Tests + account delete + launch"],
    ["7 VIOLET", "4", "Week 7", "F0 advisory + MATHMON/MAP + magnet funnel + scheduled ops"],
    ["Total", "36", "7 weeks", "FFS 100% · single dev · Replit Agent"]
  ],
  [0.18, 0.14, 0.16, 0.52]
);

// ────────────────────────────────────────────────────────────────────────────
// SECTION 4 — F8-HDJ ENGINE CONTRACT
// ────────────────────────────────────────────────────────────────────────────
partHeader("SECTION 4", "F8-HDJ (HOST DJ) Engine Contract (MVP)", PHASE_COLOURS.BLUE);

code(`ENDPOINT     POST /api/harness/f8-hdj   (Architect tier)
MIDDLEWARE   requireTier("ARCHITECT") -> rateLimit -> requireCostBudget
INPUT        { sessionId, mvpPddArtifactId, codebaseBundleArtifactId, provider? }
             -> normalised to a Hosting Requirements Profile (HRP):
                { stack, dbFit, compliance[], region, trafficCeiling, budgetUsd }
OUTPUT       persistArtifact(artifactType:"HOSTING_PLAN") with:
             { hse:{matrix[], weights},
               primary:{platform,score,rationale,monthlyCostUsd},
               fallback:{...},
               journey:{tier:"A|B|C", phases:[{name,steps[]}]},
               sdf:{envTemplate /*keys only*/, ciYaml, healthCheck, rollback},
               jcse:{dimensions[]} }
REGISTRY     Reconciled to F8 targets (nextjs-vercel | react-vite-static |
             express-replit | expo-mobile | pnpm-monorepo) + Replit
             Deployments. Never recommend a host F8 cannot scaffold for.
GUARDRAILS   requireCostBudget MUST be present (gotcha #6). HSE ranking,
             primary, fallback, and jcse are recomputed server-side.
BOUNDARY     Advisory only — no cloud credentials, no executed deploy, env
             keys never carry values (key AND description sanitised server-side).`);

// ────────────────────────────────────────────────────────────────────────────
// SECTION 5 — SPARTAN FORGE CERTIFICATION BLOCK
// ────────────────────────────────────────────────────────────────────────────
partHeader("SECTION 5", "SPARTAN FORGE Certification Block", GOLD);

code(`+==============================================================+
|                  SPARTAN FORGE CERTIFICATION                 |
+==============================================================+
|  Compression ID :  SPRT-AC-CC-CURRENT-2026-006               |
|  Source         :  ATANDA Command Centre live codebase       |
|  Source PDD ref :  ATANDA_Command_Centre_Living_PDD_ATLAS     |
|  MVP Output     :  36 prompts · 7 phases · 7 weeks           |
|  IDE (VIBE DJ)  :  Replit Agent + Workspaces                 |
|  Host (HOST DJ) :  Replit Deployments — Autoscale            |
|  FFS            :  100% kept (26/28 SHIPPED · 2 DEFERRED B)  |
|  AVS            :   96%                                       |
|  CIS            :   94%                                       |
|  UIS            :   92%                                       |
|  CR_p           :   67%  (110 -> 36 prompts)                 |
|  CR_t           :   38%                                       |
|  CR_c           :   ~0%  (same Replit infra)                 |
|  JCSE           :   49/50  ·  Wolf  ·  Platinum              |
|  Status         :   CERTIFIED · 26/28 SHIPPED · 2 DEFERRED B |
+==============================================================+`);

doc.moveDown(1);
hr(ACCENT);
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(9).text(
  `Generated ${new Date().toISOString().slice(0, 10)} · ATANDA Command Centre · SPARTAN-Certified MVP PDD · Produced via the FORGE.BONSAI HARNESS (F7)`,
  { align: "center" }
);

doc.end();

doc.on("end", () => {});
process.on("exit", () => console.log(`Wrote ${OUT_PATH}`));
