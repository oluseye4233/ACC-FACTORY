---
name: Provider pricing source monitoring
description: Constraints for detecting upstream rate-card drift while keeping production price changes human-reviewed.
---

Monitor official provider rate-card text as a review signal; a page fingerprint change is not proof that the model's price changed. Keep source acceptance separate from production pricing edits so those edits remain visible in normal code review.

**Why:** Provider documentation differs in format and may change for unrelated editorial reasons. The Kimi API pricing HTML page did not include its rate table in fetched text, while its official Markdown page did. A broad source-change signal is safer than silently missing an update, but it needs human triage.

**How to apply:** When adding or changing a monitored provider, verify that the fetched representation contains the model name and rate details, include an official source and review date with its price entry, and require an explicit reviewed change before accepting a new fingerprint. Add model-name aliases where public docs do not show the API ID verbatim.