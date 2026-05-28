#!/usr/bin/env python3
"""Convert a Markdown file to PDF using reportlab. Tight, no external deps beyond reportlab + markdown."""
import re
import sys
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem, HRFlowable, KeepTogether,
)


def make_styles():
    base = getSampleStyleSheet()
    s = {}
    s["h1"] = ParagraphStyle("h1", parent=base["Heading1"], fontSize=20, leading=24,
                              spaceBefore=18, spaceAfter=10, textColor=colors.HexColor("#0b3d2e"))
    s["h2"] = ParagraphStyle("h2", parent=base["Heading2"], fontSize=15, leading=19,
                              spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#114c3a"))
    s["h3"] = ParagraphStyle("h3", parent=base["Heading3"], fontSize=12, leading=16,
                              spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#1c5a47"))
    s["p"]  = ParagraphStyle("p",  parent=base["BodyText"], fontSize=10, leading=14,
                              spaceBefore=2, spaceAfter=6, alignment=TA_LEFT)
    s["li"] = ParagraphStyle("li", parent=base["BodyText"], fontSize=10, leading=14,
                              spaceBefore=0, spaceAfter=2)
    s["code"] = ParagraphStyle("code", parent=base["BodyText"], fontSize=9, leading=12,
                                fontName="Courier", textColor=colors.HexColor("#333333"))
    s["em"] = ParagraphStyle("em", parent=base["BodyText"], fontSize=10, leading=14,
                              textColor=colors.HexColor("#555555"))
    return s


INLINE_CODE = re.compile(r"`([^`]+)`")
BOLD = re.compile(r"\*\*([^*]+)\*\*")
ITALIC = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")


def inline(text: str) -> str:
    # escape & < >
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Restore markdown inline AFTER escaping
    text = INLINE_CODE.sub(r'<font name="Courier" color="#444444">\1</font>', text)
    text = BOLD.sub(r"<b>\1</b>", text)
    text = ITALIC.sub(r"<i>\1</i>", text)
    return text


def parse_table(lines, start, styles):
    """Parse a markdown pipe-table starting at `lines[start]`. Returns (Table, end_index)."""
    rows = []
    i = start
    while i < len(lines) and lines[i].lstrip().startswith("|"):
        row = lines[i].strip()
        if re.match(r"^\|[\s\-:|]+\|$", row):
            i += 1
            continue
        cells = [c.strip() for c in row.strip().strip("|").split("|")]
        rows.append([Paragraph(inline(c), styles["li"]) for c in cells])
        i += 1
    if not rows:
        return None, start
    n_cols = max(len(r) for r in rows)
    for r in rows:
        while len(r) < n_cols:
            r.append(Paragraph("", styles["li"]))
    page_w = LETTER[0] - 1.5 * inch
    col_w = page_w / n_cols
    t = Table(rows, colWidths=[col_w] * n_cols, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8efe9")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t, i


def parse_list(lines, start, styles, ordered=False):
    """Parse a contiguous list block."""
    items = []
    i = start
    bullet_re = re.compile(r"^\s*[-*]\s+(.*)$")
    ord_re = re.compile(r"^\s*\d+\.\s+(.*)$")
    pat = ord_re if ordered else bullet_re
    while i < len(lines):
        m = pat.match(lines[i])
        if not m:
            break
        items.append(ListItem(Paragraph(inline(m.group(1)), styles["li"]),
                              leftIndent=14))
        i += 1
    if not items:
        return None, start
    lf = ListFlowable(items, bulletType="1" if ordered else "bullet",
                      start="1" if ordered else None, leftIndent=18,
                      bulletFontName="Helvetica", bulletFontSize=10)
    return lf, i


def md_to_flowables(md_text: str):
    styles = make_styles()
    lines = md_text.splitlines()
    out = []
    i = 0
    para_buf = []

    def flush_para():
        if para_buf:
            txt = " ".join(l.strip() for l in para_buf).strip()
            if txt:
                out.append(Paragraph(inline(txt), styles["p"]))
            para_buf.clear()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            flush_para()
            i += 1
            continue

        if stripped == "---":
            flush_para()
            out.append(Spacer(1, 4))
            out.append(HRFlowable(width="100%", thickness=0.6,
                                   color=colors.HexColor("#cccccc")))
            out.append(Spacer(1, 4))
            i += 1
            continue

        if stripped.startswith("# "):
            flush_para()
            out.append(Paragraph(inline(stripped[2:]), styles["h1"]))
            i += 1
            continue
        if stripped.startswith("## "):
            flush_para()
            out.append(Paragraph(inline(stripped[3:]), styles["h2"]))
            i += 1
            continue
        if stripped.startswith("### "):
            flush_para()
            out.append(Paragraph(inline(stripped[4:]), styles["h3"]))
            i += 1
            continue

        if stripped.startswith("|"):
            flush_para()
            t, j = parse_table(lines, i, styles)
            if t is not None:
                out.append(Spacer(1, 4))
                out.append(t)
                out.append(Spacer(1, 8))
                i = j
                continue

        if re.match(r"^\s*[-*]\s+", line):
            flush_para()
            lf, j = parse_list(lines, i, styles, ordered=False)
            if lf is not None:
                out.append(lf)
                out.append(Spacer(1, 4))
                i = j
                continue
        if re.match(r"^\s*\d+\.\s+", line):
            flush_para()
            lf, j = parse_list(lines, i, styles, ordered=True)
            if lf is not None:
                out.append(lf)
                out.append(Spacer(1, 4))
                i = j
                continue

        if stripped.startswith("> "):
            flush_para()
            out.append(Paragraph("<i>" + inline(stripped[2:]) + "</i>", styles["em"]))
            i += 1
            continue

        para_buf.append(line)
        i += 1

    flush_para()
    return out


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#888888"))
    canvas.drawString(0.75 * inch, 0.4 * inch,
                       "ATANDA Command Centre · SAFe Transformation Guide")
    canvas.drawRightString(LETTER[0] - 0.75 * inch, 0.4 * inch,
                            f"Page {doc.page}")
    canvas.restoreState()


def main(md_path, pdf_path):
    with open(md_path) as f:
        md = f.read()
    flowables = md_to_flowables(md)
    doc = SimpleDocTemplate(
        pdf_path, pagesize=LETTER,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.8 * inch, bottomMargin=0.7 * inch,
        title="AI Transformation with the ATANDA Command Centre",
        author="ATANDA Command Centre",
    )
    doc.build(flowables, onFirstPage=footer, onLaterPages=footer)
    print(f"wrote {pdf_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
