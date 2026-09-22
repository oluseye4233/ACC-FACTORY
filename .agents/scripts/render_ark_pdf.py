import fitz
from pathlib import Path

source = Path("attached_assets/0_ARK-HARNESS-ATLAS-PDD-v8.3_1789341192236.pdf")
output = Path(".agents/outputs/ark-harness-v83")
output.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
for page_number in (0, 2, 4, 7, 10, 12):
    page = document.load_page(page_number)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pixmap.save(output / f"page-{page_number + 1}.png")

print(f"Rendered {len((0, 2, 4, 7, 10, 12))} of {document.page_count} pages to {output}")