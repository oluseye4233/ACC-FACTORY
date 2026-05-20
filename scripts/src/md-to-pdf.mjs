import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import PDFDocument from "pdfkit";
import { marked } from "marked";
import { createWriteStream } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node md-to-pdf.mjs <input.md> <output.pdf>");
  process.exit(1);
}

const md = readFileSync(resolve(inPath), "utf8");
const tokens = marked.lexer(md);

mkdirSync(dirname(resolve(outPath)), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: { Title: "ATANDA Command Centre — PDD v1.0", Author: "ATANDA" },
});
doc.pipe(createWriteStream(resolve(outPath)));

const FONTS = {
  body: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  mono: "Courier",
  monoBold: "Courier-Bold",
};
const COLORS = {
  text: "#111111",
  muted: "#555555",
  accent: "#0b5fff",
  rule: "#dddddd",
  codeBg: "#f4f4f6",
  tableHeaderBg: "#eef1f6",
  tableBorder: "#cccccc",
};
const SIZES = { h1: 22, h2: 17, h3: 14, h4: 12, body: 10.5, code: 9.5, small: 9 };

function renderInline(text) {
  const segments = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let i = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) segments.push({ text: text.slice(i, m.index) });
    if (m[2]) segments.push({ text: m[2], font: FONTS.bold });
    else if (m[3]) segments.push({ text: m[3], font: FONTS.italic });
    else if (m[4]) segments.push({ text: m[4], font: FONTS.mono, color: COLORS.accent });
    else if (m[5]) segments.push({ text: m[5], font: FONTS.body, color: COLORS.accent, link: m[6] });
    i = m.index + m[0].length;
  }
  if (i < text.length) segments.push({ text: text.slice(i) });
  return segments;
}

function writeSegments(segments, opts = {}) {
  const { indent = 0, size = SIZES.body } = opts;
  doc.fontSize(size);
  segments.forEach((seg, idx) => {
    const isLast = idx === segments.length - 1;
    doc
      .font(seg.font ?? FONTS.body)
      .fillColor(seg.color ?? COLORS.text);
    doc.text(seg.text, {
      continued: !isLast,
      indent: idx === 0 ? indent : 0,
      link: seg.link,
      underline: !!seg.link,
    });
  });
  doc.fillColor(COLORS.text);
}

function hr() {
  doc.moveDown(0.4);
  const y = doc.y;
  doc
    .strokeColor(COLORS.rule)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
  doc.moveDown(0.6);
}

function heading(token) {
  doc.moveDown(token.depth === 1 ? 0.6 : 0.8);
  const sizeMap = { 1: SIZES.h1, 2: SIZES.h2, 3: SIZES.h3, 4: SIZES.h4 };
  const size = sizeMap[token.depth] ?? SIZES.h4;
  doc.font(FONTS.bold).fontSize(size).fillColor(token.depth === 1 ? COLORS.accent : COLORS.text);
  doc.text(token.text);
  if (token.depth <= 2) hr();
  else doc.moveDown(0.25);
}

function paragraph(token) {
  writeSegments(renderInline(token.text));
  doc.moveDown(0.5);
}

function list(token) {
  const items = token.items;
  items.forEach((item, idx) => {
    const bullet = token.ordered ? `${(token.start ?? 1) + idx}.` : "•";
    doc
      .font(FONTS.body)
      .fontSize(SIZES.body)
      .fillColor(COLORS.text);
    const x0 = doc.page.margins.left;
    const bulletWidth = 16;
    const startY = doc.y;
    doc.text(bullet, x0, startY, { width: bulletWidth, continued: false });
    doc.y = startY;
    doc.x = x0 + bulletWidth;
    const text = item.tokens
      .map((t) => (t.type === "text" ? t.text : t.raw ?? ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    writeSegments(renderInline(text), { size: SIZES.body });
    doc.x = x0;
    doc.moveDown(0.15);
  });
  doc.moveDown(0.35);
}

function code(token) {
  const lines = token.text.split("\n");
  const pad = 8;
  const lineHeight = SIZES.code * 1.35;
  const height = lines.length * lineHeight + pad * 2;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc
    .save()
    .rect(x, doc.y, width, height)
    .fill(COLORS.codeBg)
    .restore();
  doc
    .font(FONTS.mono)
    .fontSize(SIZES.code)
    .fillColor(COLORS.text);
  let y = doc.y + pad;
  lines.forEach((ln) => {
    doc.text(ln, x + pad, y, { width: width - pad * 2, lineBreak: false });
    y += lineHeight;
  });
  doc.y = doc.y + height + 4;
  doc.x = x;
  doc.moveDown(0.3);
}

function table(token) {
  const header = token.header.map((h) => h.text);
  const rows = token.rows.map((row) => row.map((c) => c.text));
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = width / header.length;
  const pad = 6;

  const drawRow = (cells, opts = {}) => {
    const { bold = false, bg } = opts;
    doc.font(bold ? FONTS.bold : FONTS.body).fontSize(SIZES.small).fillColor(COLORS.text);
    const heights = cells.map((c) =>
      doc.heightOfString(c, { width: colW - pad * 2 }),
    );
    const rowH = Math.max(...heights) + pad * 2;
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y0 = doc.y;
    if (bg) doc.save().rect(x, y0, width, rowH).fill(bg).restore();
    cells.forEach((c, i) => {
      doc
        .font(bold ? FONTS.bold : FONTS.body)
        .fontSize(SIZES.small)
        .fillColor(COLORS.text)
        .text(c, x + colW * i + pad, y0 + pad, { width: colW - pad * 2 });
    });
    doc
      .strokeColor(COLORS.tableBorder)
      .lineWidth(0.4)
      .rect(x, y0, width, rowH)
      .stroke();
    for (let i = 1; i < cells.length; i++) {
      doc
        .moveTo(x + colW * i, y0)
        .lineTo(x + colW * i, y0 + rowH)
        .stroke();
    }
    doc.y = y0 + rowH;
    doc.x = x;
  };

  drawRow(header, { bold: true, bg: COLORS.tableHeaderBg });
  rows.forEach((r) => drawRow(r));
  doc.moveDown(0.4);
}

function hrToken() {
  hr();
}

function blockquote(token) {
  const x = doc.page.margins.left;
  const startY = doc.y;
  doc.font(FONTS.italic).fontSize(SIZES.body).fillColor(COLORS.muted);
  doc.text(token.text, x + 12, startY, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 12,
  });
  doc
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .moveTo(x + 2, startY)
    .lineTo(x + 2, doc.y)
    .stroke();
  doc.fillColor(COLORS.text);
  doc.moveDown(0.4);
}

for (const token of tokens) {
  switch (token.type) {
    case "heading": heading(token); break;
    case "paragraph": paragraph(token); break;
    case "list": list(token); break;
    case "code": code(token); break;
    case "table": table(token); break;
    case "hr": hrToken(); break;
    case "blockquote": blockquote(token); break;
    case "space": doc.moveDown(0.3); break;
    default: if (token.text) paragraph(token); break;
  }
}

doc.end();
await new Promise((r) => doc.on("end", r));
console.log(`wrote ${outPath}`);
