---
name: OpenAPI non-JSON request bodies
description: Client generation caveats for raw text and binary request bodies in this workspace.
---

For raw `text/csv` endpoints, keep the OpenAPI request body as a string and send it through a route-specific `fetch` helper rather than the generated client method. The generated client serializes string bodies with `JSON.stringify`, even when the media type is `text/csv`. Declaring the body as binary instead generates `File`/`Blob` references in shared Zod/types packages that are compiled without DOM globals.

**Why:** Code generation succeeded but produced a request body that would arrive JSON-quoted; the binary alternative failed shared-library typechecking.

**How to apply:** Use generated types/schemas for the response and route parameters, but use a small custom request helper for raw non-JSON bodies. Keep the parser and request-size limit scoped to the endpoint.