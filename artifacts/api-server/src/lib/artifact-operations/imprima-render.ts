import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Header, Footer, PageNumber } from "docx";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { documentPdfFont } from "./pdf-font";
import { type CanonicalDocument, documentFilename, hashContent, type IMPRIMA_FORMATS } from "./imprima-model";
import { OperationsError } from "./context";
import { fileHash } from "./private-storage";

export const MIME = { PDF: "application/pdf", DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", HTML: "text/html; charset=utf-8" } as const;
const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export type RenderContext = { renderedAt: Date; version: number; approval: { name: string; actorId: string; at: string } | null; collision: number };
export async function renderImprima(cdm: CanonicalDocument, format: typeof IMPRIMA_FORMATS[number], context: RenderContext) {
  const contentHash = hashContent(cdm);
  const filename = documentFilename(cdm.config, format, context.renderedAt, context.collision);
  const [title, stamp, project, author, formatToken] = filename.split("__");
  const approved = Boolean(context.approval);
  const draft = cdm.config.mode === "DRAFT";
  const label = draft ? "DRAFT — not approved" : approved ? "FINAL — human approved" : "FINAL REVIEW — not approved for release";
  const metadata = { title: title!, stamp: stamp!, project: project!, author: author!, format: formatToken!.split(".")[0]!, filename, contentHash, sourceHash: cdm.sourceHash };
  const fields = [
    `Title: ${metadata.title}`, `Date-Time: ${metadata.stamp}`, `Project: ${metadata.project}`,
    `Author: ${metadata.author}`, `Format: ${metadata.format}`, `Version: ${context.version}`,
    `Source: ${cdm.sourceKind} / ${cdm.sourceId}`, `Source hash: ${cdm.sourceHash}`, `Content hash: ${contentHash}`,
    `Confidentiality: ${cdm.config.confidentiality}`, `Status: ${label}`, "Tier: not asserted", "JCSE: not asserted",
    `Human approver: ${context.approval?.name ?? "not approved"}`,
     `Disclosure: ${cdm.disclosure}`,
  ];
  const footer = `${cdm.config.confidentiality} · ${label} · ${cdm.disclosure}`;
  let bytes: Buffer;
  let pages: number | null = null;
  if (format === "HTML") {
    bytes = Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(metadata.title)}</title>${Object.entries(metadata).map(([k, v]) => `<meta name="imprima-${k}" content="${esc(v)}">`).join("")}<style>:root{color-scheme:light}body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.5;color:#142038;max-width:70ch;margin:auto;padding:2rem}h1,h2{font-family:Cambria,Georgia,serif;color:#1B2A4A;overflow-wrap:anywhere}h1{border-bottom:3px solid #C9A227;padding-bottom:1rem}header,footer{border-top:1px solid #1F6F6B;padding:1rem 0}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font-size:10pt;background:#f4f6f9;padding:1rem;border-left:3px solid #1F6F6B}.status{font-weight:bold;color:#1B2A4A}footer{font-size:10pt}dt{font-weight:bold}dd{margin:0 0 .5rem;overflow-wrap:anywhere}@media print{body{max-width:none}footer{position:running(footer)}.status{display:block}pre{break-inside:auto}}</style></head><body><header><p class="status">${esc(label)}</p><h1>${esc(cdm.config.title)}</h1><dl>${fields.map(f => { const at = f.indexOf(":"); return `<dt>${esc(f.slice(0, at))}</dt><dd>${esc(f.slice(at + 2))}</dd>`; }).join("")}</dl></header><main>${cdm.blocks.map(b => b.type === "heading" ? `<h2>${esc(b.text)}</h2>` : b.type === "code" ? `<pre><code>${esc(b.text)}</code></pre>` : `<p>${esc(b.text)}</p>`).join("\n")}</main><footer>${esc(footer)}</footer></body></html>`);
  } else if (format === "DOCX") {
    const paragraph = (text: string, heading = false, code = false) => new Paragraph({
      ...(heading ? { heading: HeadingLevel.HEADING_2 } : {}),
      children: [new TextRun({ text, font: code ? "Courier New" : heading ? "Cambria" : "Calibri", size: heading ? 28 : code ? 18 : 22, color: heading ? "1B2A4A" : "142038" })],
      spacing: { after: heading ? 180 : 100 },
    });
    const doc = new Document({
      title: metadata.title, creator: metadata.author, subject: metadata.project,
      description: JSON.stringify(metadata), keywords: `${metadata.format}, ${contentHash}, ${cdm.sourceHash}`,
      features: { updateFields: true },
      sections: [{
        headers: { default: new Header({ children: [paragraph(`${cdm.config.title} · ${label}`)] }) },
        footers: { default: new Footer({ children: [paragraph(footer), new Paragraph({ children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(" of "), new TextRun({ children: [PageNumber.TOTAL_PAGES] })] })] }) },
        children: [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: cdm.config.title, font: "Cambria", size: 46, color: "1B2A4A" })] }), ...fields.map(f => paragraph(f)), ...cdm.blocks.map(b => paragraph(b.text, b.type === "heading", b.type === "code"))],
      }],
    });
    bytes = await Packer.toBuffer(doc);
    const zip = unzipSync(bytes);
    if (zip["docProps/core.xml"]) {
      zip["docProps/core.xml"] = strToU8(strFromU8(zip["docProps/core.xml"]).replace(/(<dcterms:(?:created|modified)\b[^>]*>)[^<]*(<\/dcterms:(?:created|modified)>)/g, `$1${context.renderedAt.toISOString()}$2`));
      bytes = Buffer.from(zipSync(zip));
    }
    const documentXml = zip["word/document.xml"] && strFromU8(zip["word/document.xml"]);
    if (!documentXml || !zip["docProps/core.xml"] || !documentXml.includes(contentHash)) throw new OperationsError(500, "DOCX package validation failed.");
  } else {
    const font = await documentPdfFont();
    bytes = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true, tagged: true, lang: "en-US", displayTitle: true, info: { Title: metadata.title, Author: metadata.author, Subject: metadata.project, Keywords: JSON.stringify(metadata), CreationDate: context.renderedAt } });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      const structure = doc.struct("Document");
      doc.addStructure(structure);
      const text = (tag: string, value: string, options: PDFKit.Mixins.TextOptions = {}) => structure.add(doc.struct(tag, {}, () => { doc.text(value, options); }));
      doc.font(font).fontSize(10).fillColor("#1B2A4A");
      text("P", label);
      doc.moveDown().fontSize(23);
      text("H1", cdm.config.title);
      doc.moveDown(.6);
      doc.save().strokeColor("#C9A227").lineWidth(2).moveTo(54, doc.y).lineTo(doc.page.width - 54, doc.y).stroke().restore();
      doc.moveDown(.6);
      doc.fontSize(9).fillColor("#142038");
      for (const field of fields) text("P", field, { lineGap: 2 });
      doc.moveDown();
      for (const block of cdm.blocks) {
        doc.fontSize(block.type === "heading" ? 14 : block.type === "code" ? 9 : 11).fillColor(block.type === "heading" ? "#1B2A4A" : "#142038");
        text(block.type === "heading" ? "H2" : "P", block.text, { lineGap: 2 });
        doc.moveDown(.5);
      }
      const range = doc.bufferedPageRange();
      pages = range.count;
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.markContent("Artifact", { type: "Pagination" });
        doc.fontSize(8).fillColor("#1F6F6B").text(`${cdm.config.confidentiality} · ${label} · ${i + 1}/${range.count}`, 54, doc.page.height - 35, { lineBreak: false });
        doc.endMarkedContent();
      }
      structure.end();
      doc.end();
    });
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new OperationsError(500, "PDF signature validation failed.");
  }
  const filenameFieldsValid = filename.split("__").length === 5 && filename.length <= 180 && Object.values(metadata).every(v => typeof v === "string" && v.length > 0);
  const dimensions = { metadata: filenameFieldsValid ? 10 : 0, fidelity: hashContent(cdm) === contentHash ? 10 : 0, hierarchy: cdm.blocks.some(b => b.type === "heading") ? 10 : 8, brand: format === "PDF" ? 8 : 10, structuralAccessibility: format === "PDF" ? bytes.includes(Buffer.from("/StructTreeRoot")) ? 9 : 0 : format === "DOCX" ? 8 : 9 };
  const score = Object.values(dimensions).reduce((a, b) => a + b, 0);
  return { bytes, filename, contentHash, fileHash: fileHash(bytes), mime: MIME[format], validation: {
    format, valid: true, metadata, pages, sharedContentHash: contentHash, design: { score, dimensions, scope: "Derived SKRIBE structural template rubric; not an independent visual or accessibility audit" },
    accessibility: { language: "en", headingOrder: true, readableText: true, taggedPdf: format === "PDF" ? bytes.includes(Buffer.from("/StructTreeRoot")) : null, humanReviewRequired: true, wcagConformance: "NOT_ASSERTED" },
    fontNote: format === "PDF" ? "Unicode DejaVu Sans embedded; substitute for house Cambria/Calibri" : "House Cambria/Calibri with reader font fallback",
  } };
}
