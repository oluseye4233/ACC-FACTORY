// Generates the ATANDA Command Centre Quest Badge guide as a PDF.
// Run with:  node scripts/src/build-badge-guide.mjs
// Output:    docs/ATANDA_Quest_Badges_Guide.pdf

import { createRequire } from "node:module";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

const OUT_PATH = resolve(repoRoot, "docs/ATANDA_Quest_Badges_Guide.pdf");
mkdirSync(dirname(OUT_PATH), { recursive: true });

const NAVY = "#0b1d3a";
const ACCENT = "#1f7a8c";
const GREY = "#4b5563";
const LIGHT = "#e5e7eb";
const GOLD = "#b8860b";

const BADGES = [
  {
    id: "ASPE",
    fullName: "ADAPTIVE SPC PRACTITIONER",
    tagline: "You can build system prompts and grow them into agents — repeatedly.",
    earnedBy:
      "Producing at least 3 SPCs (Super Prompt Cards) AND at least 4 Micro Agent (MA) Birth Packages on your account.",
    requirements: [
      "3 × SPC — created via F5 (Build SPC).",
      "4 × MA Birth Package — created via F3 (Build Micro Agent)."
    ],
    progression:
      "This badge sits at the middle of the HARNESS. By the time you've completed it, you've done F1 → F2 → F3 repeatedly and F5 a few times, which means you can confidently turn ideas into formal system prompts. It's the natural badge for someone on the PRACTITIONER tier.",
    unlock:
      "Unlocks DE-SPC (Digitally Evolved SPC) — the ability to evolve an existing SPC instead of starting from scratch. This is the single biggest workflow accelerator the HARNESS offers; once you have ASPE, you stop reinventing the wheel.",
    howToFarm: [
      "Run F5 on three different real projects — not three variations of the same one. Diversity matters; you're proving range.",
      "Whenever you complete an F2, push it through F3 to harvest an MA Birth Package. Four of those will accumulate naturally if you stop skipping F3."
    ]
  },
  {
    id: "AISA",
    fullName: "AI SOLUTION ARCHITECT",
    tagline: "You can take a project the whole way — design, document, ship.",
    earnedBy:
      "Completing one full ATLAS lifecycle: at least 1 ATLAS PDD, 1 Micro PDD, and 1 MVP PDD on your account.",
    requirements: [
      "1 × Micro PDD — created via F4 (Micro PDD).",
      "1 × ATLAS PDD — created via F6 (Draft ATLAS PDD).",
      "1 × MVP PDD — created via F7 (Convert to MVP)."
    ],
    progression:
      "This is the 'I shipped a real deliverable' badge. It proves you've gone past prompt engineering and into product documentation — you didn't just build the engine, you wrote the manual. It's typical for ARCHITECT-tier users.",
    unlock:
      "AISA is a credential rather than a feature unlock. It signals to peers (and to anyone you share your verify URLs with) that you can take a project end-to-end through the ATLAS framework.",
    howToFarm: [
      "Pick one real project you actually care about — not a throwaway demo.",
      "Run it through F1 → F2 → F3 → F4 → F5 → F6 → F7 in order. Don't skip steps; each one feeds the next.",
      "When F7 produces the MVP PDD, you'll have all three artifact types in one session — the badge unlocks immediately."
    ]
  },
  {
    id: "AISE",
    fullName: "AI SOLUTION ENGINEER",
    tagline: "You shipped a real, working AI agent into the world — and it's verifiable.",
    earnedBy:
      "Submitting a public URL to a working AI artifact you've built, which the Command Centre then automatically verifies as reachable and on the AISE allowlist.",
    requirements: [
      "1 × verified URL — at least one of the following:",
      "    • a Custom GPT on chatgpt.com/g/…",
      "    • a Microsoft Copilot agent on copilot.microsoft.com/… or github.com/copilot/…",
      "    • a native app listed on the App Store, Google Play, or Chrome Web Store",
      "    • a custom SPC-DNA agent hosted at your own HTTPS domain"
    ],
    progression:
      "AISE is the only badge that requires evidence from outside the Command Centre. It's the capstone — proof that you didn't just produce blueprints, you actually shipped something a stranger can use. Both PRACTITIONER and ARCHITECT users can earn it, but it's most meaningful for ARCHITECT-tier users who've already earned AISA.",
    unlock:
      "AISE is the strongest social credential in the system. It's the badge to put on a portfolio, in a pitch deck, or on LinkedIn (see the sharing section below).",
    howToFarm: [
      "Ship the agent first — there's no shortcut here.",
      "On the Quests page, open the 'Claim AISE' card and paste the URL into the matching field (GPT, Copilot, native app, or SPC-DNA agent).",
      "The Command Centre runs an automated HTTPS check, verifies the host is public, and records the URL as evidence. The badge moves to CLAIMED status the moment one URL passes."
    ]
  }
];

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "ATANDA Quest Badges — How to Earn Them & How to Share Them",
    Author: "ATANDA Command Centre",
    Subject: "End-user guide to the ASPE, AISA, and AISE quest badges."
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

// ---------- COVER ----------
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(34).text("ATANDA", { align: "left" });
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(34).text("Quest Badges");
doc.moveDown(0.5);
doc.fillColor(GREY).font("Helvetica").fontSize(16).text("How to Earn Them & How to Share Them");
doc.moveDown(0.5);
doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(11).text("ASPE  ·  AISA  ·  AISE", { characterSpacing: 2 });
doc.moveDown(2);
hr(ACCENT);

h3("What this document is");
p("This is the plain-English guide to the three Quest Badges in the ATANDA Command Centre. For each badge you'll see exactly what you need to do to earn it, how it maps to your progression through the HARNESS, what it unlocks for you inside the app, and — at the end — what you can and can't do with it on LinkedIn and other social platforms.");

h3("Why badges exist");
p("Badges aren't decoration. Each one corresponds to a real capability milestone in the HARNESS, and earning one either unlocks a new tool in the app or gives you portable evidence of a skill that you can show to clients, employers, or peers. They're computed live from your activity — the system re-counts your SPCs, MAs, and PDDs every time you open the Quests page, so progress is always current.");

h3("The three badges at a glance");
bullets([
  "ASPE — Adaptive SPC Practitioner. Earned by building 3 SPCs and 4 MA Birth Packages. Unlocks DE-SPC.",
  "AISA — AI Solution Architect. Earned by completing one full ATLAS lifecycle (Micro PDD + ATLAS PDD + MVP PDD).",
  "AISE — AI Solution Engineer. Earned by submitting a verified URL to a real, working AI artifact you've shipped."
]);

h3("How badge status works");
p("Each badge moves through three states: LOCKED (you haven't met the requirements yet), UNLOCKED (you've met them — the badge is yours to claim), and CLAIMED (recorded against your account with evidence). ASPE and AISA unlock automatically the moment your artifact counts cross the thresholds. AISE is the only one that requires an explicit claim action, because it depends on evidence that lives outside the Command Centre.");

// ---------- ONE PAGE PER BADGE ----------
for (const badge of BADGES) {
  doc.addPage();
  h1(badge.id);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(badge.fullName, { characterSpacing: 1 });
  doc.moveDown(0.3);
  doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(12).text(badge.tagline);
  doc.moveDown(0.8);

  h3("How you earn it");
  p(badge.earnedBy);

  h3("Exact requirements");
  bullets(badge.requirements);

  h3("Where it sits in your progression");
  p(badge.progression);

  h3("What it unlocks");
  p(badge.unlock);

  h3("Fastest path to earning it");
  bullets(badge.howToFarm);
}

// ---------- PROGRESSION MAP ----------
doc.addPage();
h2("The progression map");
p("The badges aren't independent achievements — they form a ladder. Here's how they line up with the HARNESS steps and the subscription tiers.");

h3("Step 1 — Sign up (any tier)");
p("EXPLORER (free) gives you F1 and F2 so you can taste the methodology. No badges available at this stage — you simply don't have the engines to produce the required artifacts yet.");

h3("Step 2 — Earn ASPE (PRACTITIONER or above)");
p("Once you upgrade to PRACTITIONER, F3 and F5 open up. Run a few real projects through F1 → F2 → F3 and you'll quickly accumulate four MA Birth Packages. Push three of them all the way to F5 and you have your three SPCs. ASPE unlocks — and with it, the DE-SPC engine, which lets you evolve any existing SPC instead of rewriting from scratch. Most PRACTITIONER users earn ASPE in their first month of active use.");

h3("Step 3 — Earn AISA (PRACTITIONER for Micro + ATLAS, ARCHITECT for MVP)");
p("AISA requires one Micro PDD (F4, available on PRACTITIONER), one ATLAS PDD (F6, also PRACTITIONER), and one MVP PDD (F7, which requires ARCHITECT). So AISA is effectively a signal that you've moved up to ARCHITECT and used the full pipeline at least once. It's the badge that says 'I can deliver, not just design'.");

h3("Step 4 — Earn AISE (any paid tier)");
p("AISE doesn't depend on artifact counts — it depends on shipped work. You can earn it on PRACTITIONER if you've shipped a Custom GPT, a Copilot, or a published native/web app. But it pairs naturally with AISA: someone who has both has produced the documentation and the working artifact.");

h3("Cheat sheet");
bullets([
  "Want to unlock DE-SPC fast? → Aim for ASPE first. It's the highest-leverage badge inside the app.",
  "Want to prove you can deliver? → AISA. It demonstrates end-to-end ATLAS competence.",
  "Want a credential the outside world will recognise? → AISE. It points at a live, verifiable artifact."
]);

// ---------- SHARING ON LINKEDIN ----------
doc.addPage();
h2("Sharing badges on LinkedIn & social media");

h3("The short answer");
p("Yes — but how you share depends on which badge it is, and the strongest social credential is AISE because it points to something the world can actually click and use.");

h3("What you CAN do today");
bullets([
  "Take a screenshot of the badge crest from your Quests page and post it on LinkedIn, X, Bluesky, Threads, or anywhere else. The visual design is yours to share.",
  "Add the badge name and its full title (e.g. 'AISA — AI Solution Architect, ATANDA Command Centre') to the Licenses & Certifications section of your LinkedIn profile. Use 'ATANDA Command Centre' as the issuing organisation.",
  "For AISE specifically: share the verified URL you submitted. That URL is the most powerful proof you have — it's a working agent anyone can try, and it's recorded against your account in the Command Centre.",
  "For MVP PDDs produced via F7: share the public verify URL of your certified PDD. Each MVP PDD gets its own public page that anyone can open — perfect for a LinkedIn post showing off a project."
]);

h3("What's NOT YET available");
bullets([
  "There is no one-click 'Add to LinkedIn' button (the official LinkedIn 'Add to profile' integration requires our badges to be issued through their certifications API — that's on our roadmap, not in the current build).",
  "Badges are not yet issued as Open Badges 2.0 / Credly-compatible credentials. So they don't show up in third-party badge wallets.",
  "There is no signed, downloadable badge image with embedded metadata. The badge crest in the app is a visual, not a cryptographic credential."
]);

h3("Recommended post template (LinkedIn)");
p("Use the verifiable artifact as the hero. Something like:");
bullets([
  "Headline: 'Just earned the AISE — AI Solution Engineer — badge from the ATANDA Command Centre.'",
  "Body: One paragraph on what you built, why it matters, and what you learned.",
  "Proof: Paste the verified URL of your agent (for AISE) or the public verify URL of your MVP PDD (for AISA). This is what makes the post credible — a stranger can click and inspect the work.",
  "Image: Screenshot of the badge crest from your Quests page."
]);

h3("Recommended LinkedIn 'Licenses & Certifications' entry");
bullets([
  "Name: '<Badge ID> — <Full Name>'  e.g.  'AISE — AI Solution Engineer'",
  "Issuing organisation: ATANDA Command Centre",
  "Issue date: the date the badge moved to CLAIMED status on your Quests page",
  "Credential URL (AISE only): the verified URL you submitted",
  "Credential URL (AISA): the public verify URL of your MVP PDD"
]);

h3("Honesty notes");
p("These badges are issued by the ATANDA Command Centre and verified by the Command Centre alone. They are credible to anyone who knows what the HARNESS is, and they're backed by real activity in your account that we can re-verify on request — but they are not (yet) accredited by a standards body, an OEM platform, or LinkedIn directly. Treat them like an internal certification from a methodology, similar to 'Certified Scrum Practitioner' early in its life: meaningful in the community that knows the work, growing in recognition outside it.");

h3("Coming soon");
bullets([
  "Open Badges 2.0 / Credly issuance, so the badge sits in your portable wallet.",
  "Signed, downloadable badge PNG/SVG with embedded metadata.",
  "Official LinkedIn 'Add to profile' button on the Quests page.",
  "Public profile pages at /u/<your-handle> listing all your earned badges and verified URLs in one place."
]);

doc.moveDown(1);
hr(ACCENT);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(9).text(
  `Generated ${new Date().toISOString().slice(0, 10)} · ATANDA Command Centre · Quest Badges Guide`,
  { align: "center" }
);

doc.end();
console.log(`Wrote ${OUT_PATH}`);
