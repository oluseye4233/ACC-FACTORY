"""Read-only PDF structural/layout checks and representative page rendering."""
import json
import re
from pathlib import Path
import pymupdf as fitz

root = Path(__file__).resolve().parents[1]
folder = root / "generated-artifacts" / "atlas-360-plan"
pdf = folder / "ATLAS_360_PLAN_Living_PDD_2026-10-25.pdf"
source_pdf = root / "attached_assets" / "ATLAS_360_PLAN_v3_0_0_ALBERT_Integration_1788458927280.pdf"
source = fitz.open(source_pdf)
source[0].get_pixmap(matrix=fitz.Matrix(1, 1)).save(folder / "methodology-cover.png")
doc = fitz.open(pdf)
text = "\n".join(page.get_text() for page in doc)
missing_parts = [n for n in range(10) if f"Part {n}" not in text]
missing_prompts = [n for n in range(1, 46) if f"ATL-{n:03}" not in text]
assert not missing_parts, missing_parts
assert not missing_prompts, missing_prompts
assert len(re.findall(r"ATL-\d{3} / P\d", text)) == 45
assert "NOT SEARCHED" in text and "not yet certified" in text
assert "FORGE FIELD ENGINEER Certification" in text
assert "https://atanda.ai/marketplace" in text
assert "publicOpen=false" in text
assert "Edition: 1.1" in text
overflow = []
blank = []
for index, page in enumerate(doc):
    blocks = page.get_text("blocks")
    body = [b for b in blocks if b[1] < page.rect.height - 65]
    if not body:
        blank.append(index + 1)
    for block in body:
        if block[0] < 35 or block[2] > page.rect.width - 30 or block[3] > page.rect.height - 56:
            overflow.append({"page": index + 1, "bbox": [round(v, 1) for v in block[:4]]})
assert not blank, f"Blank body pages: {blank}"
assert not overflow, f"Layout overflow: {overflow}"
selected = sorted(set([0, 1, 2] + [i for i, p in enumerate(doc) if "Phase 3 — Acceptance" in p.get_text() or "Addendum A — Current" in p.get_text()] + [len(doc) - 1]))
for index in selected:
    doc[index].get_pixmap(matrix=fitz.Matrix(1.25, 1.25)).save(folder / f"preview-{index + 1:02}.png")
result = {"pages": len(doc), "parts": 10, "atomic_prompts": 45, "body_overflow": overflow, "blank_pages": blank, "rendered_pages": [i + 1 for i in selected]}
(folder / "validation.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
