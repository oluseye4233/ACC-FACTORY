import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { marked } from "marked";
import { createTheme, NAVY, GREY } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceName = "docs/ATANDA_Command_Centre_ATLAS_360_SCAN_2026-10-30.md";
const source = fs.readFileSync(path.join(root, sourceName), "utf8");
const directory = path.join(root, "generated-artifacts/atlas-360-scan-2026-10-30");
fs.mkdirSync(directory, { recursive: true });
const output = path.join(directory, "ATANDA_Command_Centre_ATLAS_360_SCAN_2026-10-30.pdf");
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 58, left: 48, right: 48 },
  info: {
    Title: "ATANDA Command Centre — ATLAS 360 SCAN",
    Author: "Replit Agent for ATANDA review",
    Subject: "Current-state living PDD including AutoCommand, IMPRIMA and release boundaries",
  },
});
const stream = fs.createWriteStream(output);
doc.pipe(stream);
const theme = createTheme(doc);
const width = doc.page.width - 96;
const plain = text => String(text).replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
doc.rect(0, 0, doc.page.width, 235).fill(NAVY);
doc.fillColor("white").font("Helvetica-Bold").fontSize(12)
  .text("ATANDA  /  ARK HARNESS", 48, 52, { width });
doc.fontSize(31).text("Command Centre", 48, 98, { width });
doc.fillColor("#C6EDF1").fontSize(26).text("ATLAS 360 SCAN", 48, 158, { width });
doc.x = 48; doc.y = 275;
theme.lead("Updated current-state assessment, evidence boundaries and go-live blockers.");
theme.p("30 October 2026  |  Living PDD snapshot");
theme.h2("Includes AutoCommand");
theme.p("Working development storefront and private intake, with unfinished automatic generation, payment and governed email fulfillment clearly identified.");
theme.h2("Reuses IMPRIMA.PORTAL");
theme.p("The existing email-based publication system is the integration foundation, not a capability to rebuild.");
theme.h2("Four parts");
theme.bullets(["Cheat Sheet", "Executive Summary and eight-stage SCAN", "45 atomic verification prompts", "Implementation disposition and current sitemap"]);
theme.p("Evidence-qualified report. No fresh production audit, independent certification, paid model invocation or publication was performed.");
doc.file(Buffer.from(source), { name: path.basename(sourceName), description: "Exact editable SCAN report source" });
doc.addPage();
for (const token of marked.lexer(source)) {
  doc.x = 48;
  if (token.type === "heading") {
    if (token.depth === 1) continue;
    if (doc.y > doc.page.height - 145) doc.addPage();
    doc.x = 48;
    if (token.depth === 2) {
      doc.outline.addItem(plain(token.text));
      theme.h2(plain(token.text));
    } else theme.h3(plain(token.text));
  } else if (token.type === "paragraph") theme.p(plain(token.text));
  else if (token.type === "list") theme.bullets(token.items.map((item, index) =>
    `${token.ordered ? `${index + 1}. ` : ""}${plain(item.text)}`));
  else if (token.type === "table") {
    const header = token.header.map(cell => plain(cell.text));
    const rows = token.rows.map(row => row.map(cell => plain(cell.text)));
    const first = header[0];
    const ratios = header.length === 2 ? (first === "Item" ? [0.12, 0.88] : [0.29, 0.71])
      : first === "Priority" ? [0.12, 0.40, 0.48] : [0.25, 0.30, 0.45];
    theme.table(header, rows, ratios);
  } else if (token.type === "hr" && doc.y > 70) doc.addPage();
}
const pages = doc.bufferedPageRange();
for (let i = pages.start; i < pages.start + pages.count; i++) {
  doc.switchToPage(i);
  const margin = doc.page.margins.bottom;
  doc.page.margins.bottom = 10;
  doc.fillColor(GREY).font("Helvetica").fontSize(7)
    .text("ATANDA  |  ATLAS 360 SCAN  |  30 October 2026  |  Not release approval",
      48, doc.page.height - 31, { width: width - 50, lineBreak: false });
  doc.text(`${i + 1} / ${pages.count}`, 48, doc.page.height - 31,
    { width, align: "right", lineBreak: false });
  doc.page.margins.bottom = margin;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
const references = [sourceName,
  "docs/autocommand-delivery-contract.md",
  "docs/ACC_P0_02_Administrator_Handoff_2026-10-30.md",
  "artifacts/api-server/src/lib/autocommand/catalog.ts",
  "artifacts/api-server/src/lib/launch-readiness.ts",
  "artifacts/api-server/src/lib/imprima-portal.ts",
  "artifacts/command-centre/src/App.tsx"];
fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify({
  report: path.relative(root, output), pages: pages.count,
  productionReaudit: false, independentCertification: false,
  sources: references.map(file => ({ file, sha256: createHash("sha256")
    .update(fs.readFileSync(path.join(root, file))).digest("hex") })),
}, null, 2));
console.log(JSON.stringify({ output, pages: pages.count, bytes: fs.statSync(output).size }));
