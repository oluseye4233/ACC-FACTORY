// Generates the ATANDA Command Centre end-user guide as a PDF.
// Run with:  node scripts/src/build-user-guide.mjs
// Output:    docs/ATANDA_Command_Centre_Guide.pdf

import { createRequire } from "node:module";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

const OUT_PATH = resolve(repoRoot, "docs/ATANDA_Command_Centre_Guide.pdf");
mkdirSync(dirname(OUT_PATH), { recursive: true });

const NAVY = "#0b1d3a";
const ACCENT = "#1f7a8c";
const GREY = "#4b5563";
const LIGHT = "#e5e7eb";

const TIERS = [
  {
    id: "EXPLORER",
    price: "Free forever",
    tagline: "For curious beginners who want to see what the HARNESS can do.",
    whoFor:
      "You. The person reading this who has never built a structured prompt and wants to try before committing.",
    daily: "5 sessions per day",
    features: [
      "Run F1 (Prompt Diagnosis) and F2 (Atomic Prompt) end-to-end.",
      "Read-only access to the Exemplar Library — see how the pros write prompts.",
      "Basic JCSE scoring so you can see how clear your prompt actually is.",
      "Standard community support."
    ],
    notFor: [
      "Building full agents (F3+) — you'll see them, but you can't run them yet.",
      "Producing certified MVP-PDDs (F7) — that needs a paid tier."
    ],
    firstThing:
      "Open the Command Centre, paste any messy prompt you wrote this week, and click 'Run F1'. The diagnosis alone will probably surprise you.",
    upgrade: "When 5 runs/day stops being enough — or you want to grow F2 prompts into real agents (F3)."
  },
  {
    id: "PRACTITIONER",
    price: "$49 / month  ·  $470 / year (2 months free)",
    tagline: "For solo prompt engineers and indie builders shipping real work.",
    whoFor:
      "Freelancers, indie devs, content people, and consultants who use LLMs every day and want repeatable, audit-friendly outputs.",
    daily: "20 sessions per day across F1–F4, plus access to F5 (SPC builder) and F6 (ATLAS PDD).",
    features: [
      "Everything in EXPLORER, plus:",
      "Full F1 → F6 pipeline: diagnose, atomic prompt, agent birth package, micro PDD, full SPC, 4-Part ATLAS PDD.",
      "ATLAS 360: Generate 12-part PLAN execution and 8-stage SCAN assurance views.",
      "SPARTAN compression preview — see your work distilled to its minimum viable form.",
      "Advanced diagnostics: per-engine telemetry so you understand why a run scored what it scored.",
      "Priority email support (usually < 1 business day).",
      "30-day free trial — cancel anytime before it ends and you won't be charged."
    ],
    notFor: [
      "F7 MVP-PDD certification with a public verify URL — that's an ARCHITECT-tier capability.",
      "Unlimited runs — if you're running batches all day, look at ARCHITECT."
    ],
    firstThing:
      "Pick a real project (a landing page, a blog post pipeline, a customer email triage flow), run it end-to-end through F1–F6, then fork an exemplar to compare your output to a known-good one.",
    upgrade: "When you want a public, verifiable certificate URL on your work, or you've hit the 20-runs/day ceiling more than once in a week."
  },
  {
    id: "ARCHITECT",
    price: "$199 / month  ·  $1,910 / year (2 months free)",
    tagline: "For product architects and small teams who ship certified blueprints.",
    whoFor:
      "Founders, lead engineers, product architects, and small product teams whose deliverable IS the prompt/agent blueprint — not just an output that uses one.",
    daily: "100 sessions per day across F1–F7. Effectively unlimited for one person.",
    features: [
      "Everything in PRACTITIONER, plus:",
      "F7 MVP-PDD certification: every certified blueprint gets a public verify URL you can share with clients or stakeholders.",
      "DE-SPC (Digitally Evolved SPC) — gated by the ASPE badge, lets you evolve an existing SPC instead of starting from scratch.",
      "Full Micro Agent (MA) Birth Packages — exportable.",
      "Custom templates for your repeated patterns.",
      "Dedicated account manager and onboarding call."
    ],
    notFor: [
      "Enterprise-scale rollout across many users or on-prem hosting — that's INSTITUTION.",
    ],
    firstThing:
      "Run one of your existing flagship deliverables all the way through F7, then send the resulting verify URL to a peer for a second opinion. The URL becomes a portable proof-of-work.",
    upgrade: "When you need to provision more than ~3 active users, or you need to run the HARNESS inside your own perimeter."
  },
  {
    id: "INSTITUTION",
    price: "Custom — contact sales",
    tagline: "For organisations who need the HARNESS as private infrastructure.",
    whoFor:
      "Companies, agencies, government teams, and education institutions deploying the methodology at scale across many users.",
    daily: "Unlimited sessions; per-seat or per-org capacity is negotiated.",
    features: [
      "Everything in ARCHITECT, plus:",
      "Unlimited sessions for every seat.",
      "On-premise or VPC deployment options.",
      "Custom integrations — pipe HARNESS outputs into your existing tooling.",
      "SLA guarantees, dedicated support channel, security review documentation.",
      "Training and certification for your team."
    ],
    notFor: [
      "Trial or proof-of-concept use — start on PRACTITIONER, then graduate up."
    ],
    firstThing:
      "Book a call from the pricing page. We'll scope deployment shape, seat count, and integration needs, then send a written proposal.",
    upgrade: "There is no upgrade above this tier — you're already at the top."
  }
];

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "ATANDA Command Centre — A Plain-English Guide for Every Plan",
    Author: "ATANDA Command Centre",
    Subject: "End-user guide to the EXPLORER, PRACTITIONER, ARCHITECT, and INSTITUTION tiers."
  }
});

doc.pipe(createWriteStream(OUT_PATH));

function hr(color = LIGHT) {
  const y = doc.y + 6;
  doc.save().strokeColor(color).lineWidth(1).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke().restore();
  doc.moveDown(0.8);
}

function h1(text) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(text, { align: "left" });
  doc.moveDown(0.3);
}

function h2(text) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(text);
  doc.moveDown(0.2);
}

function h3(text) {
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(text.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.15);
}

function p(text) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11).text(text, { align: "left", lineGap: 2 });
  doc.moveDown(0.5);
}

function bullets(items) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11);
  for (const item of items) {
    doc.text(`•  ${item}`, { indent: 8, lineGap: 2, paragraphGap: 3 });
  }
  doc.moveDown(0.4);
}

function callout(text) {
  const startY = doc.y;
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save().fillColor("#f4f7fb").rect(x, startY, w, 0).restore();
  const innerPadding = 12;
  doc.fillColor(NAVY).font("Helvetica-Oblique").fontSize(11).text(text, x + innerPadding, startY + innerPadding, {
    width: w - innerPadding * 2,
    lineGap: 2
  });
  const endY = doc.y + innerPadding;
  doc.save().fillColor("#f4f7fb").rect(x, startY, w, endY - startY).fill().restore();
  // Redraw text on top of fill (fill covers it otherwise)
  doc.fillColor(NAVY).font("Helvetica-Oblique").fontSize(11).text(text, x + innerPadding, startY + innerPadding, {
    width: w - innerPadding * 2,
    lineGap: 2
  });
  doc.moveDown(0.8);
}

// ---------- COVER ----------
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(34).text("ATANDA", { align: "left" });
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(34).text("Command Centre");
doc.moveDown(0.5);
doc.fillColor(GREY).font("Helvetica").fontSize(16).text("A Plain-English Guide for Every Plan");
doc.moveDown(0.5);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(11).text("EXPLORER · PRACTITIONER · ARCHITECT · INSTITUTION");
doc.moveDown(2);
hr(ACCENT);

h3("What this document is");
p("This is the friendly, no-jargon manual for the ATANDA Command Centre. If you've ever opened the app and thought \"okay… but what does this thing actually DO for me?\" — this is for you. We cover what each of the four plans gives you, who it's for, what you can't do on it yet, and the very first thing you should try.");

h3("What the Command Centre is, in one paragraph");
p("The Command Centre is a guided workspace that turns a vague idea (\"I want an AI that summarises support tickets\") into a structured, repeatable, certifiable blueprint. It does this through a sequence of seven steps called the HARNESS (F1 → F7), now driven by the ATOMIC UI stage cockpit. You don't need to memorise those — the linear track guides you, keeping the engine under the hood. By the end you get a clean, portable document that describes your AI system precisely enough that you (or anyone else) can build it.");

h3("The seven HARNESS steps, in plain English");
bullets([
  "F1 — Diagnose: \"How bad is the prompt I wrote? What's missing?\"",
  "F2 — Atomic Prompt: \"Rewrite it so a model can't misread it.\"",
  "F3 — Agent Birth Package: \"Turn that prompt into an actual little worker.\"",
  "F4 — Micro PDD: \"Write the short product spec for that worker.\"",
  "F5 — SPC: \"Write the full system blueprint.\"",
  "F6 — ATLAS PDD: \"Format that blueprint as the 4-part deliverable. Optionally render ATLAS 360 PLAN/SCAN views.\"",
  "F7 — MVP-PDD Certification: \"Compress, stamp, and give it a public verify URL.\""
]);
p("Lower-numbered steps are quick; higher-numbered steps are the real deliverable. The free plan lets you try the first few. The paid plans unlock progressively more.");

h3("Key Ecosystem Features");
bullets([
  "Exemplar Library: Browse canonical HARNESS references, fork them to your session, or upload your own files (SPC, MA, MPDD, PDD) to the open backend marketplace.",
  "ATLAS 360 Views: Project a PDD into a 12-part technical execution PLAN or an 8-stage assurance SCAN, then export as a single ZIP (Markdown + JSON).",
  "SPC Player: Open-access cockpit for registering and executing capability briefs, downloading final JSON packages, and explicitly authorizing per-run public HTTPS webhook delivery. It has no tier, entitlement, credit, billing, or LLM gate. Environment sketches are documentation, not live integrations."
]);

doc.addPage();

// ---------- HOW TO READ EACH TIER ----------
h2("How to read the rest of this guide");
p("For each plan you'll get the same six things, in the same order:");
bullets([
  "Price — what it costs.",
  "Tagline — the one-sentence pitch.",
  "Who it's for — a real description of the person who should pick this.",
  "Daily allowance — how many runs you get per day.",
  "What you get — the actual features, in plain words.",
  "What you DON'T get — so you don't pick the wrong plan by mistake.",
  "First thing to try — the fastest path to your first \"oh, I get it\" moment.",
  "When to upgrade — the signal that you've outgrown this plan."
]);

hr();

// ---------- ONE PAGE PER TIER ----------
for (const tier of TIERS) {
  doc.addPage();
  h1(tier.id);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(tier.price);
  doc.moveDown(0.3);
  doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(12).text(tier.tagline);
  doc.moveDown(0.8);

  h3("Who it's for");
  p(tier.whoFor);

  h3("Daily allowance");
  p(tier.daily);

  h3("What you get");
  bullets(tier.features);

  h3("What you DON'T get");
  bullets(tier.notFor);

  h3("First thing to try");
  p(tier.firstThing);

  h3("When to upgrade");
  p(tier.upgrade);
}

// ---------- CLOSING PAGE ----------
doc.addPage();
h2("Cheat sheet — pick a plan in 10 seconds");
bullets([
  "Just exploring? → EXPLORER (free).",
  "I use AI daily and want my outputs structured and repeatable. → PRACTITIONER.",
  "My deliverable is the blueprint itself, and I need to prove it. → ARCHITECT.",
  "We're an organisation rolling this out to many people. → INSTITUTION."
]);

h2("Account, billing, data — the boring-but-important stuff");
h3("Where to manage your plan");
p("Inside the Command Centre, click your avatar (top right), then \"Account\". From there you can update your display name, see which plan you're on, export every piece of data we hold about you as a JSON file, and — if you really want to — delete your account permanently.");
h3("How cancellation works");
p("Cancelling is one click in the Billing section. You keep access until the end of the period you've already paid for; we don't pro-rate refunds. If you cancel during a free trial, you're not charged at all.");
h3("How account deletion works");
p("If you delete your account from the Account page, we (in order): cancel any active subscription with our payment provider, remove your identity from our authentication provider, and then permanently delete every row of your data from our database. You'll get one final email confirming it's done. The process is irreversible — please export your data first if you want a copy.");
h3("How we email you");
p("We only send transactional emails: welcome on signup, receipt when you subscribe, certificate when an F7 run is verified, escalation notices, payment-failure alerts, cancellation confirmations, and the final goodbye email if you delete your account. We don't send marketing email.");

h2("Getting help");
p("EXPLORER and PRACTITIONER: email support — we usually reply within one business day.");
p("ARCHITECT: dedicated account manager assigned at onboarding.");
p("INSTITUTION: dedicated Slack/Teams channel and SLA-backed response times.");

doc.moveDown(1);
hr(ACCENT);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(9).text(
  `Generated ${new Date().toISOString().slice(0, 10)} · ATANDA Command Centre · This document supersedes any earlier draft.`,
  { align: "center" }
);

doc.end();
console.log(`Wrote ${OUT_PATH}`);
