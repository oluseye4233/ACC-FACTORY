---
name: EmailResult ok contract
description: The email lib's send() never throws for provider errors — every caller must check .ok
---
The shared email lib converts provider (Resend) failures into a resolved `{ ok: false, error }` instead of rejecting.

**Why:** callers that only `.catch()` or bare-`await` a send silently treat failed sends as delivered; worse, any code that stamps a "sent" marker (digest lastDigestSentAt, retainer notifiedAt) after an unchecked send permanently swallows the alert on failure.

**How to apply:** any new email callsite must inspect `result.ok` (log on false; never stamp a sent-marker unless ok). Test mocks for `@workspace/email` must return `{ ok: true, id }` — a mock resolving `undefined` makes `.ok` access throw and quietly bypasses the stamping path. All template HTML must escape dynamic values via the lib's `esc()` helper (incl. hrefs), and email link base URLs must never trust request headers (Origin) without an http(s) allowlist — prefer PUBLIC_BASE_URL.
