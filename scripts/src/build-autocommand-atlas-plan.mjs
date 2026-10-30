import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { marked } from "marked";
import { createTheme, NAVY, ACCENT, GREY } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "docs/ATLAS_360_PLAN_AutoCommand_2026-10-30.md");
const directory = path.join(root, "generated-artifacts/autocommand-plan");
fs.mkdirSync(directory, { recursive: true });
const output = path.join(directory, "AutoCommand_ATLAS_360_PLAN_2026-10-30.pdf");
const markdown = fs.readFileSync(source, "utf8");
const hash = createHash("sha256").update(markdown).digest("hex");
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 58, left: 48, right: 48 },
  info: {
    Title: "AutoCommand — ATLAS 360 PLAN",
    Author: "Prepared by Replit Agent for ATANDA review",
    Subject: "Dedicated specification-package storefront PDD, atomic worksheet and go-live plan",
    Keywords: "ATANDA, AutoCommand, ATLAS 360 PLAN, IMPRIMA.PORTAL, Fast Consulting",
  },
});
const stream = fs.createWriteStream(output);
doc.pipe(stream);
const theme = createTheme(doc);
const width = doc.page.width - 96;
const plain = text => String(text).replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
const reset = () => { doc.x = 48; };
function room(height) { if (doc.y + height > doc.page.height - 65) doc.addPage(); reset(); }

doc.rect(0, 0, doc.page.width, 230).fill(NAVY);
doc.font("Helvetica-Bold").fontSize(12).fillColor("white")
  .text("ATANDA  /  FAST CONSULTING", 48, 52, { width });
doc.fontSize(39).text("AutoCommand", 48, 98, { width });
doc.fillColor(ACCENT).fontSize(23).text("ATLAS 360 PLAN", 48, 158, { width });
doc.y = 270;
theme.lead("A dedicated living PromptWare Design Document for the customer-facing specification-package service.");
reset();
theme.p("Baseline 1.0  |  30 October 2026");
theme.h2("One customer intake. Defined specification packages.");
theme.p("Basic AI Agent $10  |  Advanced AI Agent $25  |  AI-native Web Application $50");
theme.p("First package free once per verified customer email. Firmware, RobotWare and ChipWare remain inactive.");
theme.h2("Four-part ATLAS structure");
theme.bullets(["Cheat Sheet", "Executive Summary", "45 Atomic Build Prompts across five phases", "Implementation and Go-Live Plan"]);
theme.h2("Publication boundary");
theme.p("Reuse IMPRIMA.PORTAL's existing email-based publication system. This plan does not create a parallel email service or waive publication safeguards.");
theme.p("STATUS: Development intake verified. Paid service is NOT READY. This is a methodology-based planning document, not independent certification or release approval.");
doc.file(Buffer.from(markdown), {
  name: path.basename(source),
  description: "Editable Markdown source of the full dedicated AutoCommand PLAN.",
});
doc.addPage();

for (const token of marked.lexer(markdown)) {
  reset();
  if (token.type === "heading") {
    if (token.depth === 1) continue;
    room(token.text.startsWith("AC-") ? 145 : 80);
    if (token.depth === 2) {
      doc.outline.addItem(plain(token.text));
      theme.h2(plain(token.text));
    } else theme.h3(plain(token.text));
  } else if (token.type === "paragraph") {
    const lines = token.text.split(/\n(?=(?:Instruction|Input|Output|Acceptance|Dependencies):)/);
    for (const line of lines) { reset(); theme.p(plain(line)); }
  } else if (token.type === "list") {
    theme.bullets(token.items.map((item, index) => `${token.ordered ? `${index + 1}. ` : ""}${plain(item.text)}`));
  } else if (token.type === "table") {
    const headers = token.header.map(cell => plain(cell.text));
    const rows = token.rows.map(row => row.map(cell => plain(cell.text)));
    const ratios = headers.length === 2 ? [0.31, 0.69]
      : headers.length === 3 ? [0.25, 0.30, 0.45]
      : Array(headers.length).fill(1 / headers.length);
    theme.table(headers, rows, ratios);
  } else if (token.type === "hr") {
    if (doc.y > 70) doc.addPage();
  } else if (token.type === "code" && token.lang === "workflow") {
    const steps = token.text.split("\n").filter(Boolean);
    room(steps.length * 35 + 15);
    for (let i = 0; i < steps.length; i++) {
      const y = doc.y;
      doc.save().fillColor(i === steps.length - 1 ? "#E7F2ED" : "#EEF2F7")
        .rect(48, y, width, 28).fill().restore();
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10)
        .text(`${i + 1}. ${steps[i]}`, 59, y + 8, { width: width - 22, lineBreak: false });
      doc.y = y + 35;
    }
  } else if (token.type === "code") {
    room(45);
    doc.font("Courier").fontSize(8).fillColor(NAVY).text(token.text, { width });
    doc.moveDown();
  }
}

const pages = doc.bufferedPageRange();
for (let i = pages.start; i < pages.start + pages.count; i++) {
  doc.switchToPage(i);
  const previous = doc.page.margins.bottom;
  doc.page.margins.bottom = 10;
  doc.font("Helvetica").fontSize(7).fillColor(GREY)
    .text("ATANDA  |  AutoCommand PLAN  |  Planning baseline — not release approval",
      48, doc.page.height - 31, { width: width - 55, lineBreak: false });
  doc.text(`${i + 1} / ${pages.count}`, 48, doc.page.height - 31,
    { width, align: "right", lineBreak: false });
  doc.page.margins.bottom = previous;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
fs.writeFileSync(path.join(directory, "source-manifest.json"), JSON.stringify({
  source: path.relative(root, source), sourceSha256: hash,
  pdf: path.relative(root, output), pages: pages.count,
  independentCertification: false, productionReaudit: false,
}, null, 2));
console.log(JSON.stringify({ output, pages: pages.count, bytes: fs.statSync(output).size, sourceSha256: hash }));
