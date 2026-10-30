"""Read-only PDF verification and preview rendering; no database operations."""
from pathlib import Path
import fitz

root = Path(__file__).resolve().parents[2]
out = root / "generated-artifacts"
pdf = fitz.open(out / "ACC_P0_02_Administrator_Handoff_2026-10-30.pdf")
text = "\n".join(page.get_text() for page in pdf)
for phrase in [
    "Query A", "Query B", "Query C", "22 required",
    "request-path acceptance", "WITH required(table_name, privilege)",
    "Query B: nine PASS", "Security reviewer and release decision",
]:
    assert phrase.lower() in text.lower(), f"Missing content: {phrase}"
source = root / "docs/ACC_P0_02_Administrator_Handoff_2026-10-30.md"
assert pdf.embfile_count() == 1
assert pdf.embfile_get(0) == source.read_bytes(), "Embedded source differs"
assert all(page.get_text().strip() for page in pdf), "Blank page"
for page in pdf:
    assert page.get_text().strip().endswith(f"{page.number + 1} / {len(pdf)}")
sql_page = next(page.number for page in pdf if "parameters(app_login)" in page.get_text())
for index, label in [(0, "cover"), (1, "findings"), (sql_page, "sql")]:
    pdf[index].get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(out / f"p0-handoff-{label}.png")
print(f"Verified {len(pdf)} pages, all query sections, footer numbering and exact embedded Markdown.")
