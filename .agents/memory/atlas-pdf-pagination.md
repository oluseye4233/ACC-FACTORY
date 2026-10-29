---
name: ATLAS PDF pagination
description: Safe footer and pagination pattern for reports built with the shared ATLAS PDFKit theme.
---

When generating ATLAS reports with automatic pagination, construct the document with `bufferPages: true`, let the shared theme create pages normally, and add page footers in a final `bufferedPageRange()` / `switchToPage()` pass.

**Why:** Mutating the document cursor from a `pageAdded` footer listener can interact with PDFKit's page guards and trigger recursive page creation or stack overflows.

**How to apply:** Keep footer drawing explicitly positioned and separate from content flow; use the final buffered-page pass for page numbers and repeated footer text.

Keep the footer text inside PDFKit's usable bottom boundary, or temporarily
reduce the bottom margin while drawing it and restore it afterward.

**Why:** Positioned text below the usable boundary can still create new pages,
even with `lineBreak: false`, leaving the intended page without a footer and
appending footer-only pages.

**How to apply:** Verify the final saved PDF page count, not only the buffered
page count measured before footers were drawn.

For mixed positioned tables and flowing text, explicitly restore the left
margin cursor before continuing the narrative.

**Why:** PDFKit cell text changes the horizontal cursor. A following heading
can collapse into the final column even when text extraction and content
counts pass.

**How to apply:** Restore the flow cursor after positioned tables and visually
inspect at least one dense worksheet/table page in addition to the cover.