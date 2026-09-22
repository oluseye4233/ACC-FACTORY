---
name: Exactly-once alert stamps
description: Pattern for one-time threshold notification emails that survive restarts and concurrent requests, plus a Date.toISOString month-key trap.
---

**Rule:** For "notify once per period per threshold" emails, INSERT a stamp row into a table with a UNIQUE (period, threshold) index using ON CONFLICT DO NOTHING *before* sending, and only send when the insert landed. Do NOT write the stamp when the recipient list (e.g. `ADMIN_EMAILS`) is empty — otherwise configuring recipients later silences the alert for the rest of the period.

**Why:** In-memory "already sent" flags reset on restart and race across concurrent requests; stamping with no recipients permanently swallows the period's alert.

**How to apply:** Any future threshold/cross-once notification (seat limits, quota warnings). Also gate the hot-path dispatcher off under vitest when suites deliberately shrink the threshold against the shared dev DB — a test crossing would stamp the REAL current month and suppress the production alert; test the core dispatcher directly with injected `now`.

**Date trap:** `Date.toISOString()` switches to a `+YYYYYY-MM-…` expanded format for years > 9999, so `.slice(0, 7)` no longer yields `YYYY-MM`. Randomised far-future test dates must stay within 4-digit years.

**Episode variant (dead-man's-switch):** for "went stale" alerts the period key is the *episode anchor* — the last-tick timestamp (or first-seen for never-ticked) at the moment staleness began. A recovery followed by a new outage produces a new anchor, so it legitimately alerts again while the same continuing outage stays exactly-once.

**Recovery ("all clear") variant:** to notify once when the condition clears, don't insert a new stamp — atomically *claim* the existing stale stamp via `UPDATE … SET recovered_at = now WHERE recovered_at IS NULL … RETURNING` and only email when a row came back. No stamp row = alert never sent = no recovery email (correct by construction). Same empty-recipients rule: skip the claim when recipients are empty so configuring them later still all-clears. Gate any hot-path auto-dispatch (e.g. inside the tick recorder) off under vitest — tests hitting real target names on the shared dev DB would claim and silence genuine open stamps; test the dispatcher directly with synthetic targets.
## Episode keys must be durable, not in-process
An episode-scoped UNIQUE stamp only dedupes if the episode KEY is stable across restarts and instances. Deriving the key in-memory (e.g. "first check this process saw") re-emails after every restart. Fix: a per-target state row (UNIQUE target, INSERT ... ON CONFLICT DO UPDATE counter, RETURNING the key) so the first observer fixes the key and everyone else converges on it; recovery deletes the row.
Also: "N consecutive checks" counters must dedupe by ABSOLUTE monitor-interval bucket (floor(epoch_ms/interval_ms)), not relative spacing — phase-shifted replicas otherwise double-count one interval and alert early.
