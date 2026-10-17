import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createTheme, NAVY, ACCENT, SOFT } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = require("pdfkit");
const source = path.join(root, "docs/FORGE_FIELD_ENGINEER_ATLAS_PDD.md");
const dir = path.join(root, "generated-artifacts/cohort-pdd");
fs.mkdirSync(dir, { recursive: true });
const output = path.join(dir, "FORGE_FIELD_ENGINEER_ATLAS_PDD.pdf");
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 52, bottom: 56, left: 52, right: 52 },
  info: {
    Title: "FORGE FIELD ENGINEER — ATLAS PDD",
    Author: "ATANDA Command Centre",
    Subject: "Free invite-only Intelligent Systems Architect and Engineer cohort training design",
  },
});
const stream = fs.createWriteStream(output);
doc.pipe(stream);
const t = createTheme(doc);

// Preserve plain text in the PDF, including code identifiers, without relying
// on an HTML renderer or allowing embedded Markdown to create active content.
const plain = (s) => s.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
doc.save().fillColor(NAVY).rect(0, 0, doc.page.width, 208).fill().restore();
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
  .text("ATANDA / ARK HARNESS", 52, 53, { characterSpacing: 1.8 });
doc.fontSize(30).text("FORGE FIELD\nENGINEER", 52, 94, { width: 480, lineGap: 1 });
doc.y = 254;
t.h1("ATLAS PromptWare Design Document");
t.lead("A free, invite-only cohort subscription for Intelligent Systems Architect and Engineer trainees.");
t.p("Guide + Ascension Protocol + Quest evidence");
t.kv([
  ["Version", "1.1 / 17 October 2026 / Existing Quest Rules"],
  ["Offer", "Free pilot — no checkout or automatic paid conversion"],
  ["Scope", "Worked gate examples, personal practice, instructor review and credential evidence"],
  ["Status", "Implementation specification — not a live service or independent certification"],
]);
t.p("Four parts: Cheat Sheet / Executive Summary / 45 Atomic Work Units / Implementation Plan");
doc.addPage();

const lines = fs.readFileSync(source, "utf8").split("\n");
let paragraph = [];
const flush = () => {
  if (paragraph.length) { t.p(plain(paragraph.join(" "))); paragraph = []; }
};
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) { flush(); continue; }
  if (line === "---") { flush(); t.hr(); continue; }
  if (line.startsWith("# ")) {
    flush();
    const text = plain(line.slice(2));
    if (text.startsWith("PART ") || text.startsWith("ADDENDUM")) {
      if (doc.y > 90) doc.addPage();
    }
    t.h1(text);
    continue;
  }
  if (line.startsWith("## ")) { flush(); t.h2(plain(line.slice(3))); continue; }
  if (line.startsWith("### ")) { flush(); t.h3(plain(line.slice(4))); continue; }
  if (line.startsWith("|")) {
    flush();
    const cells = line.slice(1, -1).split("|").map((v) => plain(v.trim()));
    if (cells.every((v) => /^:?-+:?$/.test(v))) continue;
    // Long curriculum and worksheet rows remain legible as labelled records,
    // rather than squeezing dense prose into tiny PDF table columns.
    const isHeader = lines[i + 1]?.trim().startsWith("|---");
    if (isHeader) { t.h3(cells.join(" / ")); continue; }
    t.pageGuard(112);
    t.h3(cells[0]);
    t.p(cells.slice(1).join("  |  "));
    continue;
  }
  if (/^- /.test(line)) {
    flush(); t.bullets([plain(line.slice(2))]); continue;
  }
  if (/^\d+\. /.test(line)) {
    flush(); t.p(plain(line)); continue;
  }
  paragraph.push(line);
}
flush();
const { start, count } = doc.bufferedPageRange();
for (let i = start; i < start + count; i++) {
  doc.switchToPage(i);
  const y = doc.page.height - 34;
  doc.save();
  doc.strokeColor("#d1d5db").lineWidth(0.5)
    .moveTo(52, y - 8).lineTo(doc.page.width - 52, y - 8).stroke();
  // Temporarily enlarge the content area for positioned footer text so it
  // cannot trigger automatic overflow pagination while iterating buffered pages.
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fillColor(SOFT).font("Helvetica").fontSize(8)
    .text("FORGE FIELD ENGINEER / ATLAS PDD / DESIGN BASELINE", 52, y, { lineBreak: false });
  doc.fillColor(ACCENT).text(`${i + 1} / ${count}`, doc.page.width - 112, y,
    { width: 60, align: "right", lineBreak: false });
  doc.page.margins.bottom = bottom;
  doc.restore();
}
doc.end();
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log(`Created ${path.relative(root, output)} (${count} pages)`);
