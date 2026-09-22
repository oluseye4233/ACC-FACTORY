// Generates the ATANDA Command Centre scenario-based F1→F7 walkthrough as a PDF.
// One persona per subscriber tier, walked through every engine they have access to.
//
// Run with:  node scripts/src/build-walkthrough-guide.mjs
// Output:    docs/ATANDA_Command_Centre_Walkthrough.pdf

import { createRequire } from "node:module";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

const OUT_PATH = resolve(repoRoot, "docs/ATANDA_Command_Centre_Walkthrough.pdf");
mkdirSync(dirname(OUT_PATH), { recursive: true });

const NAVY = "#0b1d3a";
const ACCENT = "#1f7a8c";
const GREY = "#4b5563";
const SOFT = "#f4f7fb";
const LIGHT = "#e5e7eb";

// ----- Engine glossary used in every persona -----
const ENGINE_BLURB = {
  F1: "Diagnose — the ATOMIC UI stage cockpit reads your raw idea and tells you exactly what's vague, missing, or contradictory.",
  F2: "Atomic Prompt — it rewrites your idea as a single, unambiguous prompt a model can't misread.",
  F3: "Agent Birth Package — it grows that prompt into a CELL: a small, repeatable AI worker with a clear job.",
  F4: "Micro PDD — it writes the short product spec for that worker (who, what, why, success criteria).",
  F5: "SPC — it writes the full system blueprint: inputs, outputs, edge cases, rails, evaluation.",
  F6: "ATLAS PDD — it formats the blueprint into the 4-part ATLAS deliverable (and recommends a VIBE DJ). You can also render 360 PLAN/SCAN views here.",
  F7: "MVP-PDD Certification — it compresses everything into the SPARTAN-certified MVP-PDD with a public verify URL you can share."
};

// ----- Personas -----
const PERSONAS = [
  {
    tier: "EXPLORER",
    persona: "Maya, a one-person newsletter writer",
    plan: "EXPLORER (free) · 5 sessions/day · F1 and F2 only",
    backstory:
      "Maya writes a weekly culture newsletter (3,400 subscribers). Every Sunday she pastes a long, rambling prompt into ChatGPT to draft her 'five-things-I-loved-this-week' section. The drafts are inconsistent — sometimes great, sometimes off-topic. She wants to fix the prompt itself.",
    goal: "Get a clean, repeatable prompt for her weekly 'five things' section that always returns the same shape of output.",
    runs: [
      {
        engine: "F1",
        what: "Paste her current Sunday prompt into the F1 box and click Run.",
        input:
          "\"Hey, can you give me five things I loved this week, make it sound like me, kinda fun and a bit nerdy, no boring stuff, maybe music or films or a book, and keep it short but not too short, also pick a theme if you can.\"",
        engineDoes:
          ENGINE_BLURB.F1 +
          " It scores the prompt on the JCSE rubric (clarity, specificity, etc.) and lists every ambiguous phrase.",
        output:
          "JCSE score: 3.2 / 10. Flags: \"sound like me\" has no voice reference; \"short but not too short\" gives no length target; \"pick a theme if you can\" is optional and contradicts the fixed structure; no output format is specified.",
        moaning:
          "Maya is mildly embarrassed (she wrote this every Sunday for six months) but now she can see why some drafts went off."
      },
      {
        engine: "F2",
        what: "Click 'Generate Atomic Prompt' on the F1 diagnosis. F2 rewrites her prompt as a single deterministic block.",
        input:
          "(F2 reads the F1 diagnosis automatically — Maya doesn't have to retype anything.)",
        engineDoes:
          ENGINE_BLURB.F2 +
          " Every ambiguous phrase from F1 is replaced with a concrete constraint, and an output format is added.",
        output:
          "A reusable prompt that says: voice reference = 3 attached past issues; format = 5 items, each with a one-sentence pitch + one-sentence why-it-mattered, max 60 words each; theme = inferred from the 5 items, stated as a single line at the top; no preamble, no sign-off.",
        moaning:
          "Maya saves it as her Sunday template. Next week's draft lands in the right shape on the first try. She has used 2 of her 5 daily sessions."
      }
    ],
    closing:
      "Maya does not need F3 onward — she isn't building an AI product, she's just making her own prompt better. The free EXPLORER tier was the right call. If she ever decides to package this prompt as a paid \"weekly newsletter agent\" service for other writers, that's when she'd move to PRACTITIONER and continue from F3."
  },
  {
    tier: "PRACTITIONER",
    persona: "Daniel, a freelance developer building for a SaaS client",
    plan: "PRACTITIONER ($49/mo) · 20 sessions/day · F1 through F6",
    backstory:
      "Daniel is a freelancer. A SaaS client has hired him to build a support-ticket triage agent that reads incoming Zendesk tickets and routes them to the right team (billing / bug / feature-request / abuse). The client wants a written blueprint they can hand to their internal dev team to maintain after Daniel is done.",
    goal: "Deliver a maintainable, documented triage agent — not just a working script — by the end of the two-week engagement.",
    runs: [
      {
        engine: "F1",
        what: "Paste the client's brief (\"we want AI to sort tickets\") into F1.",
        input:
          "\"Build us an AI thing that reads support tickets and figures out where they should go. We get maybe 200 tickets a day. Should be cheap and accurate.\"",
        engineDoes: ENGINE_BLURB.F1,
        output:
          "JCSE score 2.8 / 10. Flags: no list of categories; \"accurate\" is undefined; no SLA; no privacy/PII rules; no escalation path for ambiguous tickets; \"cheap\" has no budget."
      },
      {
        engine: "F2",
        what: "Daniel meets with the client for 20 minutes to fill the gaps, then runs F2.",
        input: "F1 diagnosis + Daniel's notes from the client call.",
        engineDoes: ENGINE_BLURB.F2,
        output:
          "Atomic prompt: classify each ticket into exactly one of {billing, bug, feature, abuse, other}; return JSON with category, confidence (0-1), and a one-sentence reason; if confidence < 0.7 route to 'other' for human review."
      },
      {
        engine: "F3",
        what: "Click 'Grow CELL'. F3 turns the atomic prompt into a Micro Agent (MA) Birth Package.",
        input: "The F2 atomic prompt.",
        engineDoes: ENGINE_BLURB.F3,
        output:
          "A CELL spec: input schema (ticket text + metadata), output schema (the JSON above), tools = none required, rails = strip PII before logging, fallback = 'other' on any parse failure. Estimated cost per 1k tickets included."
      },
      {
        engine: "F4",
        what: "Click 'Write Micro PDD'.",
        input: "The CELL spec.",
        engineDoes: ENGINE_BLURB.F4,
        output:
          "A one-page Micro PDD: problem statement, user (the support lead), success criterion (= 90% of tickets routed correctly without human touch, measured weekly), and what's explicitly out of scope (auto-replying, multi-language)."
      },
      {
        engine: "F5",
        what: "Click 'Build SPC'. This is the full system blueprint.",
        input: "Everything from F1-F4.",
        engineDoes: ENGINE_BLURB.F5,
        output:
          "A full SPC: input contract, output contract, every edge case Daniel can think of (empty ticket, attachment-only ticket, non-English, profanity, looks-like-spam), the eval set (50 historical tickets the client labelled), and the rollback plan if accuracy drops."
      },
      {
        engine: "F6",
        what: "Click 'Render ATLAS PDD'. This is the deliverable Daniel hands to the client.",
        input: "The SPC from F5.",
        engineDoes:
          ENGINE_BLURB.F6 +
          " The app also recommends a VIBE DJ — a stylistic 'voice' for how the agent should phrase its rationale text.",
        output:
          "A 4-part ATLAS PDD (Audience · Trigger · Logic · Artefact · Standard), plus a recommended VIBE DJ profile ('crisp internal-tool tone'). Exportable as PDF and JSON."
      }
    ],
    closing:
      "Daniel hands the ATLAS PDD + the working code to the client. The internal dev team can now maintain the agent because the blueprint is explicit. Daniel decides not to certify (F7) because the client owns the IP and prefers a private deliverable. He has used 6 sessions today — well under the 20/day cap. If the next client wants a public, verifiable certificate (e.g. to show investors), that's when Daniel will upgrade to ARCHITECT."
  },
  {
    tier: "ARCHITECT",
    persona: "Priya, CTO of a 6-person legal-tech startup",
    plan: "ARCHITECT ($199/mo) · 100 sessions/day · F1 through F7 + DE-SPC",
    backstory:
      "Priya's startup sells an AI assistant that pre-reviews NDAs for small businesses. She is about to raise a seed round, and her lead investor has asked for proof that the AI behaviour is auditable. She needs a public, verifiable blueprint — not just \"trust us, we tested it\".",
    goal: "Produce a SPARTAN-certified MVP-PDD with a public verify URL she can paste into her data room.",
    runs: [
      {
        engine: "F1",
        what: "Paste the current product description into F1.",
        input:
          "\"NDA Buddy reads an NDA and flags clauses that are unusual for a small business signing it.\"",
        engineDoes: ENGINE_BLURB.F1,
        output:
          "JCSE 4.5 / 10. Flags: \"unusual\" is undefined; \"small business\" has no jurisdiction; no list of clause types in scope; no failure mode for non-NDAs accidentally uploaded."
      },
      {
        engine: "F2",
        what: "Resolve the flags with Priya's lead lawyer, then F2.",
        input: "F1 diagnosis + lawyer notes.",
        engineDoes: ENGINE_BLURB.F2,
        output:
          "Atomic prompt: detect document type first; if not an NDA, refuse with a fixed message; if NDA, classify each clause against a list of 14 known clause types and rate each on a 3-level unusual-for-SMB scale with a one-sentence explanation."
      },
      {
        engine: "F3",
        what: "Grow the CELL.",
        input: "F2 atomic prompt.",
        engineDoes: ENGINE_BLURB.F3,
        output:
          "CELL with input = PDF or DOCX upload, tool = clause-segmenter, rails = never give legal advice, fallback = escalate to human reviewer for jurisdiction-specific clauses."
      },
      {
        engine: "F4",
        what: "Write the Micro PDD.",
        input: "CELL.",
        engineDoes: ENGINE_BLURB.F4,
        output:
          "Micro PDD: target user = SMB founder; success = founder understands risk in < 5 minutes; out of scope = redlining, negotiation drafting, jurisdictions outside UK/US/EU."
      },
      {
        engine: "F5",
        what: "Build the full SPC. Because Priya already has a previous SPC (v0.3) from a hackathon, she uses DE-SPC instead of starting fresh.",
        input: "The previous SPC v0.3 + the new Micro PDD.",
        engineDoes:
          "DE-SPC (Digitally Evolved SPC) — gated by Priya's ASPE badge. It evolves the old SPC instead of rewriting from scratch, preserving the parts that already worked and updating only what changed.",
        output: "SPC v0.4 with a documented diff showing exactly what changed since v0.3."
      },
      {
        engine: "F6",
        what: "Render the ATLAS PDD.",
        input: "SPC v0.4.",
        engineDoes: ENGINE_BLURB.F6,
        output:
          "ATLAS PDD with a recommended VIBE DJ profile ('cautious legal-explainer tone — never affirms, never advises')."
      },
      {
        engine: "F7",
        what: "Click 'Certify'. This is the moment Priya was building toward.",
        input: "ATLAS PDD from F6.",
        engineDoes:
          ENGINE_BLURB.F7 +
          " The engine runs the SPARTAN compression and audit-grade math, then issues a certificate stored under a public URL.",
        output:
          "MVP-PDD signed and verifiable at https://atanda.<your-domain>/verify/<cert-id>. Priya drops the URL into her data room and her pitch deck."
      }
    ],
    closing:
      "Priya now has a public, third-party-verifiable artefact that proves her AI behaviour is bounded and audited. The investor closes the round two weeks later. She has used 8 sessions today (cap is 100). Next quarter she plans to certify the four other agents in the product suite the same way."
  },
  {
    tier: "INSTITUTION",
    persona: "Westbridge Council — citizen-services team rolling out at scale",
    plan: "INSTITUTION (custom pricing) · Unlimited sessions · F1 through F7, on-prem deployment, dedicated support",
    backstory:
      "Westbridge Council wants to deploy an AI form-completion assistant inside their citizen-services portal. It must help residents fill in housing-benefit applications in plain English. Privacy, fairness, and FOI obligations mean the model must run inside the council's own perimeter, and every assisted form must be auditable.",
    goal: "Roll the assistant out to 22 frontline officers and 180,000 residents, with a certified blueprint for each of the 7 form types in scope.",
    runs: [
      {
        engine: "F1",
        what: "The product lead (Asha) pastes the council's policy intent into F1.",
        input:
          "\"Help residents complete housing-benefit applications correctly so we reduce returned-for-correction rate, which is currently 38%.\"",
        engineDoes: ENGINE_BLURB.F1,
        output:
          "JCSE 5.1 / 10. Flags: 'correctly' undefined; no accessibility commitments; no language coverage; no handling for residents who lack documents; no rule for what the assistant must NOT do (e.g. estimate award amounts)."
      },
      {
        engine: "F2",
        what: "Asha runs F2 after resolving the flags with the policy team and the Equalities Lead.",
        input: "F1 diagnosis + policy notes + Equalities sign-off.",
        engineDoes: ENGINE_BLURB.F2,
        output:
          "Atomic prompt: explain each field in plain English at reading age 11; never estimate award amounts; flag missing documents and link to the upload step; offer to switch to large text or screen-reader mode."
      },
      {
        engine: "F3",
        what: "Grow the CELL.",
        input: "F2 atomic prompt.",
        engineDoes: ENGINE_BLURB.F3,
        output:
          "CELL: input = current form field + resident's question; tool = council policy retrieval index (on-prem vector store); rails = no PII echoed back, no advice on award value, full transcript persisted for FOI."
      },
      {
        engine: "F4",
        what: "Write the Micro PDD.",
        input: "CELL.",
        engineDoes: ENGINE_BLURB.F4,
        output:
          "Micro PDD per form type (7 forms × 1 each), each with its own success metric and out-of-scope list."
      },
      {
        engine: "F5",
        what: "Build the SPCs. Because the 7 forms share most of their behaviour, the team uses DE-SPC after building the first one — every later SPC is evolved from the first.",
        input: "Form 1 SPC v1.0 → evolved into Forms 2-7.",
        engineDoes:
          "F5 for the first form; DE-SPC for forms 2 through 7. Each evolution is documented with a clean diff.",
        output: "7 SPCs sharing a common base, with explicit per-form deviations."
      },
      {
        engine: "F6",
        what: "Render all 7 ATLAS PDDs.",
        input: "The 7 SPCs.",
        engineDoes: ENGINE_BLURB.F6,
        output:
          "7 ATLAS PDDs, each with a shared VIBE DJ profile ('warm, plain-English, never-condescending public-service tone')."
      },
      {
        engine: "F7",
        what: "Certify all 7 in one batch.",
        input: "The 7 ATLAS PDDs.",
        engineDoes: ENGINE_BLURB.F7,
        output:
          "7 MVP-PDDs, each with a public verify URL that the council publishes on its transparency page. The transparency page itself links to all 7 — anyone (a resident, a journalist, an auditor) can see the bounded behaviour of every assistant."
      }
    ],
    closing:
      "Six months after rollout, returned-for-correction rate drops from 38% to 14%. The transparency page receives one FOI request, which is answered by sending the link to the relevant verify URL. Asha presents the case study at LocalGovCamp. Because the council is on INSTITUTION, the same blueprint approach now scales to the next 9 form types without new procurement."
  }
];

// ----- PDF builder helpers -----
const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "ATANDA Command Centre — Scenario Walkthroughs (F1 to F7) for Every Plan",
    Author: "ATANDA Command Centre",
    Subject:
      "End-user scenario walkthroughs showing how each subscriber tier moves through the HARNESS from F1 to F7."
  }
});

doc.pipe(createWriteStream(OUT_PATH));

function hr(color = LIGHT) {
  const y = doc.y + 6;
  doc.save().strokeColor(color).lineWidth(1)
    .moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke().restore();
  doc.moveDown(0.8);
}

function h1(text) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(text);
  doc.moveDown(0.3);
}

function h2(text) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(text);
  doc.moveDown(0.2);
}

function h3(text) {
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(11).text(text.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.15);
}

function p(text) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11).text(text, { align: "left", lineGap: 2 });
  doc.moveDown(0.5);
}

function quote(text) {
  doc.fillColor(NAVY).font("Helvetica-Oblique").fontSize(11)
    .text(text, { align: "left", lineGap: 2, indent: 10 });
  doc.moveDown(0.5);
}

function bullets(items) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11);
  for (const item of items) {
    doc.text(`•  ${item}`, { indent: 8, lineGap: 2, paragraphGap: 3 });
  }
  doc.moveDown(0.4);
}

function engineBadge(engine, what) {
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(14).text(`${engine} — ${what}`);
  doc.moveDown(0.15);
}

// ---------- COVER ----------
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(34).text("ATANDA");
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(34).text("Command Centre");
doc.moveDown(0.5);
doc.fillColor(GREY).font("Helvetica").fontSize(16).text("Scenario Walkthroughs — F1 to F7, by Plan");
doc.moveDown(0.5);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(11)
  .text("Four real-shaped stories. One per subscriber tier. No jargon.");
doc.moveDown(2);
hr(ACCENT);

h3("Why this exists");
p("The pricing page tells you what each plan costs. The plain-English guide tells you what each plan is. This document does the third thing: it shows you what it actually looks like to USE each plan, step by step, by following one realistic person from their messy first idea all the way through to whatever finished artefact their tier supports.");

h3("How to read it");
p("Each persona walks through the engines they have access to, in order. For each engine you'll see four things: what they do (the action they take in the app), the input (what they hand the engine), what the engine does (in plain English), and the output (what they get back). At the end of each story there's a short \"what they did with it\" closing.");

h3("Plan-to-engine quick reference");
bullets([
  "EXPLORER (free): F1 + F2.",
  "PRACTITIONER ($49/mo): F1 through F6, plus ATLAS 360 PLAN/SCAN views and Exemplar uploads (SPC, MA, MPDD, PDD).",
  "ARCHITECT ($199/mo): F1 through F7, plus DE-SPC (evolve an existing SPC). SPC Player execution and delivery are open access.",
  "INSTITUTION (custom): F1 through F7 at any scale, on-prem if needed."
]);

h3("Key Ecosystem Additions");
bullets([
  "Exemplar Library: You can upload your own files (SPC, MA, MPDD, PDD) to the open backend marketplace or fork canonical references directly to your session.",
  "ATLAS 360 Views: Project a PDD into a 12-part technical execution PLAN or an 8-stage assurance SCAN, exportable as one ZIP (Markdown + JSON).",
  "SPC Player: An open-access cockpit for registering and executing capability briefs, downloading final JSON packages, and explicitly authorizing per-run public HTTPS webhook delivery. It has no tier, entitlement, credit, billing, or LLM gate; environment sketches are not live integrations."
]);

h3("Engine glossary");
for (const [k, v] of Object.entries(ENGINE_BLURB)) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(`${k}.  `, { continued: true });
  doc.fillColor(GREY).font("Helvetica").fontSize(11).text(v, { lineGap: 2 });
}
doc.moveDown(0.4);

// ---------- PERSONA PAGES ----------
for (const persona of PERSONAS) {
  doc.addPage();
  h1(persona.tier);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(persona.persona);
  doc.moveDown(0.2);
  doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(11).text(persona.plan);
  doc.moveDown(0.8);

  h3("The story so far");
  p(persona.backstory);

  h3("What success looks like");
  p(persona.goal);

  hr();

  for (const run of persona.runs) {
    engineBadge(run.engine, run.what);

    h3("Input");
    if (run.input.startsWith("\"") || run.input.startsWith("(")) {
      quote(run.input);
    } else {
      p(run.input);
    }

    h3("What the engine does");
    p(run.engineDoes);

    h3("Output");
    p(run.output);

    if (run.moaning) {
      h3("What happens next");
      p(run.moaning);
    }

    hr();
  }

  h3("Where this leaves them");
  p(persona.closing);
}

// ---------- CLOSING ----------
doc.addPage();
h2("Cross-tier reflections");

h3("The same idea grows up with you");
p("Notice that Maya, Daniel, Priya, and Asha all start the same way — they paste a messy human description of what they want into F1. The difference between the tiers is not the start, it's the finish: how far down the F-chain you can take that same idea before you run out of road.");

h3("You don't always need to reach F7");
p("Maya stops at F2 because her artefact is a personal prompt template. Daniel stops at F6 because his client wants a private deliverable. Only Priya and Asha need F7, because their artefact is a public, verifiable claim about how an AI behaves. Pick the tier that matches your finish line — not the most expensive one.");

h3("DE-SPC is the quiet superpower");
p("Both Priya and Asha use DE-SPC (Digitally Evolved SPC) — once you've built one good SPC, you almost never start from scratch again. That's why ARCHITECT and INSTITUTION users compound output over time and PRACTITIONER users sometimes consider upgrading after a few months.");

h3("The verify URL is the receipt");
p("Every F7 certificate produces a public URL. That URL is the difference between \"I built an AI thing\" and \"here is a verifiable description of what my AI thing will and will not do, signed and dated\". For investors, regulators, FOI officers, and procurement teams, that distinction is the whole point.");

doc.moveDown(1);
hr(ACCENT);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(9).text(
  `Generated ${new Date().toISOString().slice(0, 10)} · ATANDA Command Centre · Companion to the Plain-English Plan Guide.`,
  { align: "center" }
);

doc.end();
console.log(`Wrote ${OUT_PATH}`);
