"""Check report integrity and render representative pages without network or database access."""
from pathlib import Path
import re
import pymupdf as fitz

root = Path(__file__).resolve().parents[2]
directory = root / "generated-artifacts/autocommand-plan"
source = root / "docs/ATLAS_360_PLAN_AutoCommand_2026-10-30.md"
pdf = fitz.open(directory / "AutoCommand_ATLAS_360_PLAN_2026-10-30.pdf")
text = "\n".join(page.get_text() for page in pdf)
assert len(re.findall(r"^#### AC-\d{3}", source.read_text(), re.M)) == 45
for number in range(1, 46):
    assert f"AC-{number:03}" in text, f"Missing atomic prompt {number}"
for phrase in [
    "PART 1", "PART 2", "PART 3", "PART 4", "ADDENDUM A", "ADDENDUM D",
    "IMPRIMA.PORTAL already has an email-based system", "once per verified",
    "HOLD FOR PAID GO-LIVE", "NOT MEASURED",
]:
    assert phrase in text, f"Missing report section or boundary: {phrase}"
assert pdf.embfile_count() == 1
assert pdf.embfile_get(0) == source.read_bytes()
for page in pdf:
    assert page.get_text().strip().endswith(f"{page.number + 1} / {len(pdf)}"), f"Footer missing on {page.number + 1}"
    # A footer alone must never create a nominally non-empty report page.
    assert len(page.get_text().strip()) > 130, f"Blank/footer-only page {page.number + 1}"
    for block in page.get_text("blocks"):
        assert block[0] >= 35 and block[2] <= page.rect.width - 32, f"Horizontal overflow on page {page.number + 1}"
        assert block[3] <= page.rect.height - 15, f"Bottom overflow on page {page.number + 1}"
pages = [
    (0, "cover"),
    (next(p.number for p in pdf if "Mandatory reuse:" in p.get_text()), "imprima"),
    (next(p.number for p in pdf if "AC-021 |" in p.get_text()), "worksheet"),
    (next(p.number for p in pdf if "4.5 DEPENDENCY-ORDERED" in p.get_text()), "delivery"),
]
for index, name in pages:
    pdf[index].get_pixmap(matrix=fitz.Matrix(1.35, 1.35)).save(directory / f"preview-{name}.png")
print(f"Verified {len(pdf)} pages, 45 prompts, four parts, addenda, exact embedded source and page bounds.")
