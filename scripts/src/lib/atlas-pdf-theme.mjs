// Shared pdfkit design system for the ATANDA investor-grade PDDs.
//
// Both the 4-Part ATLAS PDD (Investor Edition) and the SPARTAN-certified MVP PDD
// are rendered through this single theme so the two documents are visually
// uniform — same palette, same headings, same part dividers, same code blocks.
//
// Usage:
//   const doc = new PDFDocument({ ... });
//   const t = createTheme(doc);
//   t.h1("Title"); t.p("Body"); ...
// Palette constants are also exported directly for cover-page / inline use.

export const NAVY = "#0b1d3a";
export const ACCENT = "#1f7a8c";
export const GREY = "#374151";
export const SOFT = "#6b7280";
export const LIGHT = "#e5e7eb";
export const GOLD = "#b8860b";

// ATLAS phase colours — the canonical rainbow.
export const PHASE_COLOURS = {
  RED: "#c0392b",
  ORANGE: "#d35400",
  YELLOW: "#b58900",
  GREEN: "#1e8449",
  BLUE: "#1f618d",
  INDIGO: "#4a148c",
  VIOLET: "#7d3c98",
  WHITE: "#6b7280"
};

/**
 * Build the shared layout helpers bound to a single PDFDocument instance.
 * @param {import("pdfkit")} doc
 */
export function createTheme(doc) {
  function pageGuard(reserve = 140) {
    if (doc.y > doc.page.height - reserve) doc.addPage();
  }

  function hr(color = LIGHT) {
    const y = doc.y + 6;
    doc.save().strokeColor(color).lineWidth(1)
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .stroke().restore();
    doc.moveDown(0.8);
  }

  function partHeader(label, title, accent) {
    doc.addPage();
    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.save().fillColor(accent).rect(x, doc.y, w, 38).fill().restore();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
      .text(label, x + 12, doc.y - 30, { characterSpacing: 2 });
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18)
      .text(title, x + 12, doc.y - 12);
    doc.moveDown(2);
  }

  function h1(text) {
    pageGuard(180);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(24).text(text);
    doc.moveDown(0.3);
  }

  function h2(text) {
    pageGuard(160);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text(text);
    doc.moveDown(0.25);
  }

  function h3(text) {
    pageGuard(140);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(11)
      .text(text.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.15);
  }

  function p(text) {
    pageGuard(80);
    doc.fillColor(GREY).font("Helvetica").fontSize(10.5).text(text, { align: "left", lineGap: 2.5 });
    doc.moveDown(0.5);
  }

  function lead(text) {
    pageGuard(120);
    doc.fillColor(NAVY).font("Helvetica-Oblique").fontSize(12).text(text, { lineGap: 3 });
    doc.moveDown(0.6);
  }

  function bullets(items) {
    doc.fillColor(GREY).font("Helvetica").fontSize(10.5);
    for (const item of items) {
      pageGuard(60);
      doc.text(`•  ${item}`, { indent: 8, lineGap: 2.5, paragraphGap: 3 });
    }
    doc.moveDown(0.4);
  }

  function kv(rows) {
    doc.font("Helvetica").fontSize(10.5);
    for (const [k, v] of rows) {
      pageGuard(60);
      doc.fillColor(NAVY).font("Helvetica-Bold").text(`${k}:  `, { continued: true, lineGap: 2.5 });
      doc.fillColor(GREY).font("Helvetica").text(v, { lineGap: 2.5 });
    }
    doc.moveDown(0.5);
  }

  function code(block) {
    pageGuard(120);
    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const text = block.trim();
    const lines = text.split("\n").length;
    const lineHeight = 12;
    const padding = 10;
    const boxHeight = lines * lineHeight + padding * 2;
    if (doc.y + boxHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const startY = doc.y;
    doc.save().fillColor("#f3f4f6").rect(x, startY, w, boxHeight).fill().restore();
    doc.fillColor("#1f2937").font("Courier").fontSize(9)
      .text(text, x + padding, startY + padding, { width: w - padding * 2, lineGap: 2 });
    doc.y = startY + boxHeight + 8;
    doc.moveDown(0.4);
  }

  function phaseBlock({ colourName, header, duration, deliverables, exit, status }) {
    pageGuard(220);
    const colour = PHASE_COLOURS[colourName];
    const x = doc.page.margins.left;
    const startY = doc.y;
    // Left colour bar
    doc.save().fillColor(colour).rect(x, startY, 6, 26).fill().restore();
    doc.fillColor(colour).font("Helvetica-Bold").fontSize(13)
      .text(`${colourName} — ${header}`, x + 14, startY + 4);
    doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(10)
      .text(`Duration: ${duration}    ·    Status: ${status}`, x + 14, doc.y + 2);
    doc.moveDown(0.6);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text("Deliverables");
    doc.fillColor(GREY).font("Helvetica").fontSize(10.5);
    for (const d of deliverables) {
      pageGuard(40);
      doc.text(`•  ${d}`, { indent: 12, lineGap: 2, paragraphGap: 2 });
    }
    doc.moveDown(0.2);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text("Exit criterion");
    doc.fillColor(GREY).font("Helvetica").fontSize(10.5)
      .text(exit, { indent: 12, lineGap: 2 });
    doc.moveDown(0.8);
  }

  // A simple two-column table renderer (header row + body rows), styled to match
  // the rest of the theme. Columns are proportionally sized by `widths` (ratios).
  function table(headers, rows, widths) {
    const x = doc.page.margins.left;
    const totalW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const ratios = widths || headers.map(() => 1 / headers.length);
    const colW = ratios.map((r) => r * totalW);

    function renderRow(cells, { head = false } = {}) {
      pageGuard(60);
      const startY = doc.y;
      doc.font(head ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      // Measure tallest cell for this row.
      let rowH = 0;
      const heights = cells.map((c, i) => {
        const h = doc.heightOfString(String(c), { width: colW[i] - 10 });
        return h;
      });
      rowH = Math.max(...heights) + 8;
      if (startY + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      const y = doc.y;
      if (head) {
        doc.save().fillColor("#eef1f6").rect(x, y, totalW, rowH).fill().restore();
      }
      let cx = x;
      cells.forEach((c, i) => {
        doc.fillColor(head ? NAVY : GREY).font(head ? "Helvetica-Bold" : "Helvetica").fontSize(9)
          .text(String(c), cx + 5, y + 4, { width: colW[i] - 10 });
        cx += colW[i];
      });
      doc.y = y + rowH;
      // bottom rule
      doc.save().strokeColor(LIGHT).lineWidth(0.5)
        .moveTo(x, doc.y).lineTo(x + totalW, doc.y).stroke().restore();
    }

    renderRow(headers, { head: true });
    for (const r of rows) renderRow(r);
    doc.moveDown(0.6);
  }

  return {
    pageGuard, hr, partHeader, h1, h2, h3, p, lead, bullets, kv, code, phaseBlock, table,
    NAVY, ACCENT, GREY, SOFT, LIGHT, GOLD, PHASE_COLOURS
  };
}
