"""Verify and render the SCAN report without application or production access."""
from pathlib import Path
import re
import pymupdf as fitz

root = Path(__file__).resolve().parents[2]
directory = root / "generated-artifacts/atlas-360-scan-2026-10-30"
source = root / "docs/ATANDA_Command_Centre_ATLAS_360_SCAN_2026-10-30.md"
pdf = fitz.open(directory / "ATANDA_Command_Centre_ATLAS_360_SCAN_2026-10-30.pdf")
text = "\n".join(page.get_text() for page in pdf)
for phrase in ["PART 1", "PART 2", "PART 3", "PART 4", "ADDENDUM A", "ADDENDUM C",
               "IMPRIMA.PORTAL already has an email-based", "paid automatic fulfillment HOLD"]:
    assert phrase in text, f"Missing section or boundary: {phrase}"
for i in range(1, 9):
    assert f"SCAN {i}" in text
assert len(re.findall(r"^\| S\d{2} \|", source.read_text(), re.M)) == 45
for i in range(1, 46):
    assert f"S{i:02}" in text, f"Missing verification prompt S{i:02}"
assert pdf.embfile_count() == 1 and pdf.embfile_get(0) == source.read_bytes()
for page in pdf:
    assert page.get_text().strip().endswith(f"{page.number + 1} / {len(pdf)}")
    assert len(page.get_text().strip()) > 130, f"Blank or footer-only page {page.number + 1}"
    for block in page.get_text("blocks"):
        assert block[0] >= 35 and block[2] <= page.rect.width - 32, f"Horizontal overflow {page.number + 1}"
        assert block[3] <= page.rect.height - 15, f"Bottom overflow {page.number + 1}"
for index, label in [
    (0, "cover"),
    (next(p.number for p in pdf if "F-STAGE STATUS MATRIX" in p.get_text()), "stages"),
    (next(p.number for p in pdf if "PRODUCTION-SECURITY FINDINGS" in p.get_text()), "security"),
]:
    pdf[index].get_pixmap(matrix=fitz.Matrix(1.35, 1.35)).save(directory / f"preview-{label}.png")
print(f"Verified {len(pdf)} pages, eight SCAN stages, 45 worksheet items, four parts, exact source and page bounds.")
