---
name: PDFKit runtime packaging
description: Keep PDFKit's runtime font assets available in the bundled API service.
---

Keep PDFKit external to the API's esbuild bundle so its sibling font/AFM data
loads from the installed package at runtime.

**Why:** Renderer unit tests passed, but the bundled server failed after model
review because PDFKit resolved its default Helvetica data relative to dist.
A minimal bundled constructor reproduced the missing-file error; an external
runtime import succeeded. This was a packaging error, not a model/budget issue.

**How to apply:** Preserve externalization when changing the server bundler.
Verify the built runtime for libraries that locate sibling assets; an
unbundled unit test alone does not exercise that failure mode.
