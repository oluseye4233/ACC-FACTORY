import { createRequire } from "node:module";
import { readFileSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createTheme, NAVY, ACCENT, SOFT } from "./lib/atlas-pdf-theme.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "scripts/package.json"));
const PDFDocument = require("pdfkit");
const { marked } = await import(require.resolve("marked"));
const output = resolve(root, "generated-artifacts/ATANDA_Completion_and_Production_Audit_2026-10-26.pdf");
mkdirSync(dirname(output), { recursive: true });
const stream = createWriteStream(output);
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { left: 48, right: 48, top: 52, bottom: 54 },
  info: { Title: "ATANDA — Platform Completion and Production Audit", Author: "ATANDA", Subject: "Combined reports — 26 October 2026" },
});
doc.pipe(stream);
const theme = createTheme(doc);
const clean = (s) => s.replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/`([^`]+)`/g, "$1").replace(/\*([^*]+)\*/g, "$1")
  .replace(/<((?:https?:\/\/)[^>]+)>/g, "$1")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
  .replace(/→/g, " -> ").replace(/↔/g, " <-> ");
const startPages = [];

function render(tokens, depth = 0) {
  for (const token of tokens) {
    doc.x = doc.page.margins.left;
    if (token.type === "heading") {
      if (token.depth === 1) theme.h1(clean(token.text));
      else if (token.depth === 2) theme.h2(clean(token.text));
      else theme.h3(clean(token.text));
    } else if (token.type === "paragraph" || token.type === "text") {
      theme.p(clean(token.text));
    } else if (token.type === "list") {
      token.items.forEach((item, i) => {
        const prefix = token.ordered ? `${Number(token.start || 1) + i}. ` : "- ";
        const text = item.tokens.filter(t => t.type !== "list").map(t => t.text || "").join(" ");
        theme.pageGuard(85);
        const check = item.task ? (item.checked ? "[x] " : "[ ] ") : "";
        doc.font("Helvetica").fontSize(10.5).fillColor("#374151")
          .text(prefix + check + clean(text), doc.page.margins.left + depth * 12, doc.y, {
            width: doc.page.width - 96 - depth * 12, lineGap: 2.5,
          });
        doc.moveDown(0.35);
        for (const nested of item.tokens.filter(t => t.type === "list")) render([nested], depth + 1);
      });
    } else if (token.type === "table") {
      const headers = token.header.map(c => clean(c.text));
      const rows = token.rows.map(r => r.map(c => clean(c.text)));
      const widths = headers.length === 2 ? [0.25, 0.75]
        : headers[0] === "Table" ? [0.49, 0.17, 0.17, 0.17]
        : headers.length === 4 ? [0.20, 0.25, 0.36, 0.19] : undefined;
      theme.table(headers, rows, widths);
      doc.x = doc.page.margins.left;
    } else if (token.type === "hr") theme.hr();
    else if (token.type === "blockquote") render(token.tokens, depth);
    else if (token.type === "code") theme.code(token.text);
    else if (token.type !== "space") throw new Error(`Unhandled Markdown token: ${token.type}`);
  }
}

doc.y = 100;
theme.h3("ATANDA COMMAND CENTRE / ARK HARNESS");
doc.moveDown(2);
theme.h1("Platform Completion\n& Production Audit");
theme.lead("Combined reports | 26 October 2026");
theme.hr();
theme.p("This document contains both complete reports, in their original order. Their findings, caveats and checklists are preserved; this is a combined edition, not a new audit.");
theme.h2("How to read this document");
theme.p("Part I provides the original completion advice and closed-gate assessment. Part II provides the subsequent read-only production audit and prioritized remaining-fixes checklist.");
theme.p("Where the reports differ, the later dated observations in Part II supersede the earlier observations in Part I. In particular, Part II updates the production guard findings and confirms the published Boomerang frontend component, while retaining the backend-revision verification limit.");
theme.h2("Contents");
theme.p("Part I — Platform Completion, Closed Gates and Pending Fixes");
theme.p("Part II — Production Read-Only Audit and Remaining-Fixes Checklist");
theme.lead("No production configuration, data or security controls were changed in preparing these reports.");

for (const [label, file] of [
  ["PART I — COMPLETION ADVICE", "Platform_Completion_Gates_and_Pending_Fixes_2026-10-26.md"],
  ["PART II — CURRENT AUDIT", "Production_Read_Only_Audit_and_Remaining_Fixes_2026-10-26.md"],
]) {
  doc.addPage();
  startPages.push({ label, page: doc.bufferedPageRange().count });
  theme.h3(label);
  render(marked.lexer(readFileSync(resolve(root, "docs", file), "utf8")));
}
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(8).fillColor(SOFT);
  doc.text("ATANDA | Combined completion & audit reports | 26 October 2026", 48, 23, { width: 500, lineBreak: false });
  doc.text(`${i + 1} / ${range.count}`, 48, doc.page.height - 34, { width: doc.page.width - 96, align: "right", lineBreak: false });
  doc.page.margins.bottom = bottom;
}
doc.end();
await new Promise((accept, reject) => { stream.on("finish", accept); stream.on("error", reject); });
console.log(JSON.stringify({ output, pages: range.count, parts: startPages }, null, 2));
