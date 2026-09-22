---
name: ATLAS PDF pagination
description: Safe footer and pagination pattern for reports built with the shared ATLAS PDFKit theme.
---

When generating ATLAS reports with automatic pagination, construct the document with `bufferPages: true`, let the shared theme create pages normally, and add page footers in a final `bufferedPageRange()` / `switchToPage()` pass.

**Why:** Mutating the document cursor from a `pageAdded` footer listener can interact with PDFKit's page guards and trigger recursive page creation or stack overflows.

**How to apply:** Keep footer drawing explicitly positioned and separate from content flow; use the final buffered-page pass for page numbers and repeated footer text.