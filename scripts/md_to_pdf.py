import sys
import markdown
from weasyprint import HTML

src, out = sys.argv[1], sys.argv[2]

with open(src, "r", encoding="utf-8") as f:
    text = f.read()

html_body = markdown.markdown(
    text,
    extensions=["fenced_code", "tables", "toc", "sane_lists", "codehilite"],
)

css = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5px; line-height: 1.5; color: #1a1a1a;
}
h1 { font-size: 22px; color: #0f172a; border-bottom: 3px solid #16a34a;
     padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 16px; color: #0f172a; border-bottom: 1px solid #d4d4d8;
     padding-bottom: 3px; margin-top: 22px; page-break-after: avoid; }
h3 { font-size: 13px; color: #15803d; margin-top: 16px; page-break-after: avoid; }
p, li { font-size: 10.5px; }
em { color: #52525b; }
strong { color: #0f172a; }
blockquote {
  background: #f0fdf4; border-left: 4px solid #16a34a;
  margin: 12px 0; padding: 8px 14px; color: #166534; font-size: 9.5px;
}
code {
  background: #f4f4f5; padding: 1px 4px; border-radius: 3px;
  font-family: "SFMono-Regular", Consolas, monospace; font-size: 9px; color: #be123c;
}
pre {
  background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 6px;
  overflow-x: auto; page-break-inside: avoid; font-size: 8.3px; line-height: 1.45;
}
pre code { background: none; color: inherit; padding: 0; font-size: 8.3px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5px; }
th, td { border: 1px solid #d4d4d8; padding: 5px 8px; text-align: left; }
th { background: #f4f4f5; }
hr { border: none; border-top: 1px solid #e4e4e7; margin: 18px 0; }
ul, ol { padding-left: 20px; }
"""

full = f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>{html_body}</body></html>"
HTML(string=full).write_pdf(out)
print(f"wrote {out}")
