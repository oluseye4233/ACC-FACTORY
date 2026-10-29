// Export the installed default narration verbatim; no provider requests or renders.
// Run: pnpm --filter @workspace/scripts exec tsx src/build-synthesia-scripts-pdf.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { STAGE_GUIDE_CATALOG, defaultStageScript } from "../../artifacts/api-server/src/lib/stage-guide-catalog.ts";
import { createTheme, NAVY, ACCENT, SOFT } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireExport = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = requireExport("pdfkit");
const out = path.join(root, "generated-artifacts/synthesia-stage-scripts");
fs.mkdirSync(out, { recursive: true });
const basename = "ATANDA_ARK_Synthesia_F_Process_Scripts_2026-10-29";
const pdf = path.join(out, `${basename}.pdf`);
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 52, bottom: 58, left: 52, right: 52 },
  info: {
    Title: "ATANDA ARK - Synthesia F-Process Narration Scripts",
    Author: "ATANDA",
    Subject: "28 default scripts: explainers and synthetic worked examples for F0-F12 including F9.5",
  },
});
const stream = fs.createWriteStream(pdf);
doc.pipe(stream);
const t = createTheme(doc);
const scripts = [];
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text("ATANDA / ARK HARNESS");
doc.moveDown(1);
t.h1("Synthesia F-Process Scripts");
t.lead("Shared stage guides: explainer and demonstration narration");
t.h2("Prepared 29 October 2026");
t.p("This collection exports the installed default narration scripts directly from the platform's stage-guide catalog. It contains 28 scripts covering 14 stages: F0 through F12, including F9.5.");
t.p("Each stage has one explainer and one narrated synthetic worked example. The Reading Room project is a fictional teaching example. These scripts are not recordings of customer sessions and do not claim a passing assessment, certification, successful release or deployed service.");
t.h2("Document scope");
t.bullets([
  "Narration is reproduced verbatim from defaultStageScript().",
  "These are the installed defaults, not an export of subscriber data or administrator-edited database revisions.",
  "Video production notes are separate from the spoken script.",
  "Exporting this document does not request a video render, spend Synthesia credits or change stage eligibility.",
]);
t.h2("Production status");
t.p("The key is configured, but the most recent read-only connection check returned HTTP 403. Video API access is not yet confirmed. This PDF is usable for script review regardless of provider connectivity.");
t.p("Source: artifacts/api-server/src/lib/stage-guide-catalog.ts");

doc.addPage();
t.h1("Production instructions");
t.h2("Using the scripts");
t.bullets([
  "Select the F stage and choose its explainer or worked-example narration.",
  "Review the script against the current platform behaviour and actual capabilities.",
  "Use the block marked NARRATION as the spoken text. Do not include headings or production notes.",
  "Save a reviewed script version in Stage guides. Run a private test only when provider access is working.",
  "Review the resulting narration and visuals in Synthesia Studio. Test videos are watermarked and cannot be published.",
  "Authorize paid generation explicitly for a real render. Review the completed video before accepting public sharing and publishing.",
]);
t.h2("Visual direction - production notes, not narration");
t.p("Use consistent ATANDA branding, readable captions and a clear stage title. Illustrate each worked example with synthetic content only. Do not show private documents, credentials or customer information. Never label a diagram or narrated example as live execution evidence.");
t.h2("Stage index");
for (const [index, row] of STAGE_GUIDE_CATALOG.entries()) {
  doc.fillColor(NAVY).font("Helvetica").fontSize(10.5)
    .text(`${row[0]} - ${row[1]}`, 52, doc.y, { width: 425, continued: true });
  doc.fillColor(SOFT).text(`Page ${index + 3}`, { align: "right" });
  doc.moveDown(0.3);
}
doc.x = 52;
t.p("Word counts describe narration only. Actual running time depends on the chosen voice, pacing and pauses; no generated duration is asserted.");

for (const row of STAGE_GUIDE_CATALOG) {
  doc.addPage();
  doc.x = 52;
  t.h1(`${row[0]} - ${row[1]}`);
  t.lead(row[2]);
  for (const kind of ["EXPLAINER", "DEMONSTRATION"]) {
    const narration = defaultStageScript(row[0], kind);
    const words = narration.trim().split(/\s+/).length;
    scripts.push({ stage: row[0], name: row[1], kind, words, narration });
    t.h2(kind === "EXPLAINER" ? "Explainer" : "Worked-example demonstration");
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9)
      .text(`NARRATION | ${words} words`);
    doc.moveDown(0.6);
    t.p(narration);
    doc.moveDown(0.5);
  }
  t.h3("Production note - not spoken");
  t.p("Show the current stage and its saved outcome. Keep unresolved findings visible. If illustrating supporting tools, show the return to the original stage without implying automatic approval or release.");
}

const range = doc.bufferedPageRange();
if (range.count !== 16) throw new Error(`Expected 16 pages, got ${range.count}`);
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  doc.fillColor(SOFT).font("Helvetica").fontSize(8)
    .text(`ATANDA | ARK Synthesia Scripts | 29 October 2026 | ${i + 1} / ${range.count}`,
      52, 770, { width: 490, lineBreak: false });
}
doc.end();
await new Promise((resolve, reject) => {
  stream.once("finish", resolve);
  stream.once("error", reject);
});
fs.writeFileSync(path.join(out, `${basename}.json`), JSON.stringify(scripts, null, 2));
console.log(JSON.stringify({ pdf, pages: range.count, stages: STAGE_GUIDE_CATALOG.length, scripts: scripts.length }));
