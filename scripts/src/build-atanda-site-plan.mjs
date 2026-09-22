// Generates the ATANDA site and stage plan as a polished PDF.
// Run with: node scripts/src/build-atanda-site-plan.mjs
// Output: docs/ATANDA_Site_Plan.pdf

import { createRequire } from "node:module";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTheme,
  NAVY,
  ACCENT,
  GREY,
  SOFT,
  LIGHT,
  GOLD,
} from "./lib/atlas-pdf-theme.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");
const outPath = resolve(repoRoot, "docs/ATANDA_Site_Plan.pdf");

mkdirSync(dirname(outPath), { recursive: true });

const stages = [
  ["F0", "ADVISORY / SOLVA", "advisory", "Upstream business intelligence and the return point for OSIRIS deviations.", "Raw ideas, market thesis, or returning OSIRIS deviations.", "SOCRATES discovery opens the engagement; a 9-SPC ensemble authors reports with a SOLVA bear case.", "Advisory report, financial ranges, and viability thesis.", "Non-suppressible Honesty Gate.", "F1 for execution or F0 Retainer for monitoring."],
  ["F1", "JCSE DIAGNOSIS / PROMPT DIAGNOSTIC", "rail", "Diagnose raw ideas against the 7-pillar JCSE rubric.", "Raw intent or prompt.", "Scores SYSTEM, ROLE, INSTRUCTION, EXAMPLE, CONSTRAINT, FORMAT, and DATA.", "Diagnosed baseline with explicit tightening recommendations.", "Fatal ambiguities are identified before engineering begins.", "F2 Atomic Prompt."],
  ["F2", "ATOMIC PROMPT", "rail", "Create an executable Atomic Prompt.", "Diagnosed intent from F1.", "Rewrites the intent into one bounded instruction with explicit role, intent, and constraints.", "Atomic Prompt.", "Must remain a singular, bounded instruction.", "F3 Micro Agent Creator."],
  ["F3", "CELL MICRO AGENT / MOLECULAR AGENT CREATOR", "rail", "Build a CELL Micro Agent birth package.", "Atomic Prompt.", "Expands the instruction into persona, capabilities, guardrails, and context requirements.", "CELL Micro Agent Birth Package.", "Validates whether the scope remains a micro-agent or must escalate.", "F4 Micro PDD."],
  ["F4", "MICRO PDD / MPDD", "rail", "Create compact audit and specification documentation.", "CELL Micro Agent Birth Package.", "Converts the birth package into a deploy-shaped Product Design Document.", "Micro PDD / MPDD.", "Architect-ready micro-specification verification.", "F5 SPC."],
  ["F5", "SPC", "rail", "Build a Super Prompt Card system contract.", "Micro PDD.", "Assembles the interactive specification with embedded ethical frameworks and compliance.", "Super Prompt Card (SPC).", "Practitioner tier required.", "F6 ATLAS PDD."],
  ["F6", "ATLAS PDD", "rail", "Draft a comprehensive audit and implementation document.", "SPC.", "Drafts the 4-Part ATLAS PDD: Cheat Sheet, Executive Summary, Worksheet, and Implementation.", "ATLAS PDD.", "Ready for technical recommendation overlays.", "F7 SPARTAN."],
  ["F7", "SPARTAN", "rail", "Compress and certify the MVP PDD.", "ATLAS PDD.", "Runs a math-audited rubric pass and locks scope and risk.", "Certified MVP PDD, or PWDD for ingested sessions.", "JCSE >= 45 and MATHMON >= 70; public verification URL stamped.", "F8 for build or F9 for the Machine Floor."],
  ["F8", "CODE ORACLE / CODE DJ", "build", "Generate an implementation and codebase/IDE handoff.", "SPARTAN-certified MVP PDD or PWDD.", "Scaffolds a complete codebase against the selected platform.", "CODEBASE_BUNDLE with up to 12 files and a manifest.", "Architect tier; uncertified input is refused.", "F9 MECHA ULTRA SI."],
  ["F9", "MECHA ULTRA SI MACHINE FLOOR", "machine", "Emit a bounded, versioned, signed Machine Artifact or refusal.", "Certified F7 MVP PDD plus approved F8 lineage.", "Executes the seven ordered MECHA phases to compile verified assets.", "Immutable signed Machine Artifact or cited refusal.", "Locked until F7 certification and F8 lineage are present.", "F9.5 OSIRIS custody."],
  ["F9.5", "OSIRIS", "custody", "Maintain custody and continuous monitoring.", "Signed F9 Machine Artifact.", "Envelops the artifact in custody and performs attestation checks; it does not build, mutate, repair, or certify.", "Active attestation state or deviation alert.", "Active attestation enables F10; deviations return through SOLVA.", "F10 release, or F0 for deviations."],
  ["F10", "CONNECTOR & RELEASE GATEWAY", "release", "Authorize controlled release and handoff across external boundaries.", "OSIRIS-attested F9 artifact or owned multi-artifact package.", "Applies policy and integrity checks, then routes through the selected release lane.", "Receipt, deterministic ZIP/GitHub handoff, provider ACK, and observed execution state where available.", "Provider acceptance proves receipt only; execution is tracked separately as accepted, running, completed, or failed.", "External environments, GitHub repositories, or provider deployment targets."],
];

const sideSteps = [
  ["F6-VDJ - VIBE ORACLE", "Recommends the IDE, toolchain, and coding approach for an ATLAS PDD."],
  ["ATLAS 360 - PLAN / SCAN", "Read-only, origin-aware planning and assurance views generated from the PDD."],
  ["F8-HDJ - HOST ORACLE", "Ranks deployment hosts for a certified MVP PDD."],
  ["MATHMON / PFP", "Profiles mathematical applicability and detects drift between PDD and codebase."],
  ["SPC PLAYER", "Plan-first cockpit for capability briefs with explicit-consent HTTPS webhook delivery."],
];

const doc = new PDFDocument({
  size: "LETTER",
  bufferPages: true,
  margins: { top: 58, bottom: 58, left: 58, right: 58 },
  info: {
    Title: "ATANDA Site Plan",
    Author: "ATANDA Command Centre",
    Subject: "Authoritative system map for the ATANDA cognitive production system.",
    Keywords: "ATANDA, HARNESS, F0-F10, OSIRIS, MECHA, site plan",
  },
});
doc.pipe(createWriteStream(outPath));
const t = createTheme(doc);

function footer() {}

function flowBox(x, y, w, h, label, title, color = ACCENT) {
  doc.save().roundedRect(x, y, w, h, 7).fillColor("#f8fafc").fill().strokeColor(color).lineWidth(1.2).stroke().restore();
  doc.fillColor(color).font("Helvetica-Bold").fontSize(9).text(label, x + 9, y + 8, { width: w - 18 });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(title, x + 9, y + 23, { width: w - 18 });
}

function arrow(x1, y1, x2, y2, dashed = false) {
  doc.save().strokeColor(dashed ? SOFT : ACCENT).lineWidth(1.2);
  if (dashed) doc.dash(4, { space: 3 });
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.undash().fillColor(dashed ? SOFT : ACCENT)
    .polygon([x2, y2], [x2 - 5, y2 - 3], [x2 - 5, y2 + 3]).fill().restore();
}

function stageBlock(stage) {
  const [id, title, type, purpose, input, process, output, gate, handoff] = stage;
  t.pageGuard(255);
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.save().roundedRect(x, y, w, 30, 5).fillColor(type === "rail" ? NAVY : ACCENT).fill().restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13).text(`${id}  ${title}`, x + 11, y + 8, { width: w - 22 });
  doc.y = y + 40;
  t.kv([
    ["Purpose", purpose],
    ["Input", input],
    ["Process", process],
    ["Output", output],
    ["Gate / policy", gate],
    ["Next handoff", handoff],
  ]);
  t.hr();
}

// Cover
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(38).text("ATANDA");
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(32).text("SITE PLAN");
doc.moveDown(0.4);
doc.fillColor(GREY).font("Helvetica").fontSize(17).text("Authoritative System & Stage Map");
doc.moveDown(1);
t.hr(ACCENT);
t.lead("How an idea becomes a certified specification, codebase, signed machine artifact, custodied asset, and controlled release.");
doc.moveDown(1);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text("MODEL AT A GLANCE");
doc.moveDown(0.5);
t.bullets([
  "F0 is Advisory/SOLVA: upstream intelligence and the return point for OSIRIS deviations.",
  "F1 to F7 is the only solid linear cockpit rail.",
  "F8 is a post-certification build branch.",
  "F9 consumes certified F7 plus approved F8 lineage.",
  "F9.5 OSIRIS maintains custody; it does not build, repair, mutate, or certify.",
  "F10 separates signed release, deterministic handoff/export, and native provider deployment.",
]);
doc.moveDown(1.5);
doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(11).text("OPERATING PRINCIPLE");
doc.moveDown(0.3);
t.p("A delivery receipt or provider ACK proves destination acceptance only. It does not prove execution, start, or completion. Provider execution status is observed and reported separately when the provider exposes it.");
footer();

// Topology map
doc.addPage();
t.h1("System Topology");
t.lead("Solid relationships are production or release paths. Dashed relationships are advisory side-steps or deviation returns.");
const left = 70;
const boxW = 205;
const gap = 38;
flowBox(left, 150, boxW, 52, "F0", "ADVISORY / SOLVA", GOLD);
flowBox(left + boxW + gap, 150, boxW, 52, "F1 TO F7", "SOLID PRODUCTION RAIL", NAVY);
arrow(left + boxW, 176, left + boxW + gap, 176);
flowBox(left + boxW + gap, 245, boxW, 52, "F8", "POST-CERTIFICATION BUILD", ACCENT);
arrow(414, 202, 414, 245);
flowBox(left + boxW + gap, 340, boxW, 52, "F9", "MECHA MACHINE FLOOR", ACCENT);
arrow(414, 297, 414, 340);
flowBox(left + boxW + gap, 435, boxW, 52, "F9.5", "OSIRIS CUSTODY", ACCENT);
arrow(414, 392, 414, 435);
flowBox(left + boxW + gap, 530, boxW, 52, "F10", "CONNECTOR & RELEASE GATEWAY", ACCENT);
arrow(414, 487, 414, 530);
arrow(309, 461, 173, 202, true);
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(8).text("Deviation to SOLVA", 184, 322, { width: 115, align: "center" });
flowBox(left, 340, boxW, 92, "ADVISORY SIDE-STEPS", "VIBE ORACLE / ATLAS 360\nHOST ORACLE / MATHMON/PFP\nSPC PLAYER", SOFT);
arrow(275, 386, 309, 386, true);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("F10 RELEASE LANES", 70, 590);
t.table(
  ["Lane", "Destination", "Evidence"],
  [
    ["Signed F9 release", "Safe HTTPS adapter", "Signed receipt; delivery only"],
    ["Multi-artifact handoff", "ZIP or user-authorized GitHub repository", "Deterministic manifest and push result"],
    ["Native provider deployment", "AWS, Azure, OpenAI Agents, Gemini Agents", "ACK plus separate execution state"],
  ],
  [0.27, 0.42, 0.31],
);
footer();

// Stage details
for (let i = 0; i < stages.length; i += 2) {
  doc.addPage();
  t.h1(i < 8 ? "The F1-F7 Production Rail" : "Post-Certification System");
  if (i === 0) t.lead("F0 is adjacent to the rail: it can originate work and receive deviations, but it is not part of the numbered production sequence.");
  stageBlock(stages[i]);
  if (stages[i + 1]) stageBlock(stages[i + 1]);
  footer();
}

// F10 and side-steps
doc.addPage();
t.h1("F10 Release & Handoff Lanes");
t.h2("1. Signed F9 Release");
t.p("An immutable F9 artifact under active OSIRIS custody passes policy and integrity checks, then travels through a safe HTTPS adapter. The resulting signed receipt proves delivery, not execution.");
t.h2("2. Deterministic Multi-Artifact Handoff");
t.p("Owned SPC, MA, MPDD, PDD, and CODE DJ artifacts are packaged into a deterministic manifest and bundle. Users can download the ZIP or push the bundle directly to a user-authorized GitHub repository. Repeated identical pushes are handled idempotently.");
t.h2("3. Native Provider Deployment");
t.p("A user-owned provider authorization can dispatch a bundle to AWS, Azure, OpenAI Agents, or Gemini Agents. The gateway tracks delivery separately from provider execution. Where supported, execution progresses through ACCEPTED, RUNNING, COMPLETED, or FAILED. Export remains the fallback when deployment is unavailable or authorization is inactive.");
t.h3("Receipt semantics");
t.bullets([
  "Delivery receipt: the destination accepted the payload.",
  "Provider ACK: the provider accepted the deployment request.",
  "RUNNING: the provider reports that execution has started.",
  "COMPLETED: the provider reports successful completion.",
  "FAILED: the provider reports terminal failure.",
]);
t.h1("Advisory Side-Steps");
for (const [title, description] of sideSteps) {
  t.h3(title);
  t.p(description);
}
footer();

const pageRange = doc.bufferedPageRange();
for (let i = pageRange.start; i < pageRange.start + pageRange.count; i += 1) {
  doc.switchToPage(i);
  doc.fillColor(SOFT).font("Helvetica").fontSize(8)
    .text(`ATANDA SITE PLAN  /  SEPTEMBER 2026  /  ${i + 1} / ${pageRange.count}`, 58, 720, {
      width: 496,
      align: "center",
      lineBreak: false,
    });
}

doc.end();
console.log(outPath);