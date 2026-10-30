import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { marked } from "marked";
import { createTheme, NAVY, ACCENT, GREY } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "docs/ACC_P0_02_Administrator_Handoff_2026-10-30.md");
const output = path.join(root, "generated-artifacts/ACC_P0_02_Administrator_Handoff_2026-10-30.pdf");
fs.mkdirSync(path.dirname(output), { recursive: true });
const markdown = fs.readFileSync(source, "utf8");
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 52, left: 48, right: 48 },
  info: {
    Title: "ATANDA Command Centre — P0-02 Administrator Security Handoff",
    Author: "ATANDA Command Centre",
    Subject: "Security findings and read-only administrator acceptance queries",
  },
});
const stream = fs.createWriteStream(output);
doc.pipe(stream);
const theme = createTheme(doc);
const width = doc.page.width - 96;
const plain = value => String(value).replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
const reset = () => { doc.x = 48; };

doc.rect(0, 0, doc.page.width, 190).fill(NAVY);
doc.fillColor("white").font("Helvetica-Bold").fontSize(12).text("ATANDA  /  COMMAND CENTRE", 48, 57);
doc.fontSize(28).text("Administrator\nSecurity Handoff", 48, 91, { lineGap: 4 });
doc.fillColor(ACCENT).fontSize(13).text("P0-02  |  30 October 2026", 48, 225);
doc.y = 265;
theme.lead("Production findings, required controls and read-only acceptance queries.");
reset();
theme.p("STATUS: BLOCKED — installation and request-path acceptance have not been completed.");
theme.p("No installer, production repair commands, credentials or connection strings are included. This report does not authorize installation or release.");
theme.h2("Using the SQL appendix");
theme.p("All three SQL blocks are reproduced in this PDF. Long lines may wrap visually. For exact copying, use the original Markdown embedded as a PDF attachment or the accompanying Markdown download. Do not retype wrapped policy literals.");
doc.file(Buffer.from(markdown), {
  name: path.basename(source),
  description: "Exact source report and SELECT-only SQL, preserved without PDF line wrapping.",
});
doc.addPage();

for (const token of marked.lexer(markdown)) {
  reset();
  if (token.type === "heading") {
    if (token.depth === 1) continue;
    (token.depth === 2 ? theme.h2 : theme.h3)(plain(token.text));
  } else if (token.type === "paragraph") {
    theme.p(plain(token.text));
  } else if (token.type === "list") {
    theme.bullets(token.items.map((item, i) => `${token.ordered ? `${i + 1}. ` : ""}${plain(item.text)}`));
  } else if (token.type === "table") {
    const headers = token.header.map(cell => plain(cell.text));
    const rows = token.rows.map(row => row.map(cell => plain(cell.text) || "________________"));
    const ratios = headers.length === 2 ? [0.36, 0.64]
      : headers.length === 3 ? [0.24, 0.34, 0.42]
      : [0.58, 0.14, 0.14, 0.14];
    theme.table(headers, rows, ratios);
    reset();
  } else if (token.type === "code") {
    for (const line of token.text.split("\n")) {
      doc.font("Courier").fontSize(6.8);
      const h = doc.heightOfString(line || " ", { width: width - 12, lineGap: 1.4 });
      if (doc.y + h + 5 > doc.page.height - 56) doc.addPage();
      reset();
      const y = doc.y;
      doc.save().fillColor("#F1F4F8").rect(48, y, width, h + 4).fill().restore();
      doc.fillColor("#192C42").font("Courier").fontSize(6.8)
        .text(line || " ", 54, y + 2, { width: width - 12, lineGap: 1.4 });
      doc.y = y + h + 4;
    }
    doc.moveDown(0.7);
  }
}

const range = doc.bufferedPageRange();
for (let index = range.start; index < range.start + range.count; index++) {
  doc.switchToPage(index);
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 12;
  doc.fillColor(GREY).font("Helvetica").fontSize(8)
    .text("ATANDA  |  Administrator review — not installation or release approval",
      48, doc.page.height - 33, { width, lineBreak: false });
  doc.text(`${index + 1} / ${range.count}`, 48, doc.page.height - 33,
    { width, align: "right", lineBreak: false });
  doc.page.margins.bottom = bottom;
}
doc.end();
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log(JSON.stringify({ output, pages: range.count, bytes: fs.statSync(output).size }));
