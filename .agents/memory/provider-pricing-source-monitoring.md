---
name: Provider pricing source monitoring
description: Constraints for detecting upstream rate-card drift while keeping production price changes human-reviewed.
---

Monitor official provider rate-card text as a review signal; a page fingerprint change is not proof that the model's price changed. Keep extracted-rate snapshots and model catalogs separate from production pricing edits so those edits remain visible in normal code review. Do not accept a new fingerprint while a configured model mention is missing; first confirm the provider's model status and update the reviewed model list.

**Why:** Provider documentation differs in format and may change for unrelated editorial reasons. A single page can also mix standard, batch, cache, region, or partner-platform rates; combining those tables can create false changes even when the standard API rate is unchanged. The Kimi API pricing HTML page did not include its rate table in fetched text, while its official Markdown page did.

**How to apply:** When adding or changing a monitored provider, verify that the fetched representation contains the model name and rate details, select the exact documented billing mode/region used by production, and preserve tier boundaries and currency. Fail closed when no model rows can be extracted. Accept source observations only as monitoring data; production rates still need a separate reviewed code change. Add model-name aliases where public docs do not show the API ID verbatim. If a configured model mention disappears, keep the alert open until its retirement or renamed identity is reviewed and the manifest is updated.

## Workflow freshness monitoring

A scheduled workflow cannot detect its own future absence; freshness checks must run independently. Preserve the last successful run's timestamp and link in the deduplicated alert so the context remains available after GitHub expires old run records.

**Why:** If the only check is inside the weekly workflow, a disabled or skipped schedule produces no execution capable of raising an alert. Old successful workflow runs are eventually removed under GitHub's retention policy.

**How to apply:** Schedule the watchdog separately and derive its threshold from the pricing workflow's cron. The current parser supports weekly schedules with wildcard day-of-month/month and adds a three-day grace buffer; unsupported schedule forms must fail explicitly rather than reuse an old threshold. Close the alert only after a successful check, and keep the last-known success in durable alert content when refreshing it.
