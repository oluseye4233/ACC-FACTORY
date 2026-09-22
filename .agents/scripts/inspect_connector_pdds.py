from pathlib import Path
import fitz

out = Path('.agents/outputs')
out.mkdir(parents=True, exist_ok=True)
for pdf in sorted(Path('attached_assets').glob('F*_CONNECTOR_ATLAS_PDD_*.pdf')):
    doc = fitz.open(pdf)
    stem = pdf.stem
    text_path = out / f'{stem}.txt'
    with text_path.open('w', encoding='utf-8') as f:
        for i, page in enumerate(doc):
            f.write(f'\n\n===== PAGE {i+1} =====\n')
            f.write(page.get_text('text'))
    # Render cover, contents-like pages, and every 10th page for visual inspection.
    for page_no in sorted(set([0, 1, 2, 3, 9, 19, 29, 39, 49, 59, 69, 79, doc.page_count - 1])):
        if page_no >= doc.page_count:
            continue
        pix = doc[page_no].get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
        pix.save(out / f'{stem}-page-{page_no+1:03d}.png')
    print(pdf.name, 'pages', doc.page_count, 'text', text_path)
