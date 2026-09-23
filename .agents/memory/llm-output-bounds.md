---
name: LLM output bounds
description: How to handle provider-generated metadata that exceeds a deliberately bounded response field.
---

Non-critical, provider-generated metadata should be normalized at the schema boundary when it exceeds its cap; do not reject an otherwise valid artifact solely because a descriptive field is too verbose.

**Why:** Provider models can ignore even explicit length instructions. Treating an overlong note as a fatal schema error converted a valid F8 scaffold into an HTTP 502.

**How to apply:** Keep hard limits for structural fields such as file count, paths, and required manifest values. For bounded descriptive fields, truncate or otherwise normalize before persistence and retain the cap in the parsed output.