---
name: Exactly-once alert stamps
description: Pattern for one-time threshold notification emails that survive restarts and concurrent requests, plus a Date.toISOString month-key trap.
---

**Rule:** For "notify once per period per threshold" emails, INSERT a stamp row into a table with a UNIQUE (period, threshold) index using ON CONFLICT DO NOTHING *before* sending, and only send when the insert landed. Do NOT write the stamp when the recipient list (e.g. `ADMIN_EMAILS`) is empty — otherwise configuring recipients later silences the alert for the rest of the period.

**Why:** In-memory "already sent" flags reset on restart and race across concurrent requests; stamping with no recipients permanently swallows the period's alert.

**How to apply:** Any future threshold/cross-once notification (seat limits, quota warnings). Also gate the hot-path dispatcher off under vitest when suites deliberately shrink the threshold against the shared dev DB — a test crossing would stamp the REAL current month and suppress the production alert; test the core dispatcher directly with injected `now`.

**Date trap:** `Date.toISOString()` switches to a `+YYYYYY-MM-…` expanded format for years > 9999, so `.slice(0, 7)` no longer yields `YYYY-MM`. Randomised far-future test dates must stay within 4-digit years.

**Episode variant (dead-man's-switch):** for "went stale" alerts the period key is the *episode anchor* — the last-tick timestamp (or first-seen for never-ticked) at the moment staleness began. A recovery followed by a new outage produces a new anchor, so it legitimately alerts again while the same continuing outage stays exactly-once.
