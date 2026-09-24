---
name: Shared-DB global-SUM gates in tests
description: How to keep live aggregate gates (cost cap) deterministic across concurrent test files, and why pino warnings get misattributed in vitest output.
---

Two durable lessons from de-flaking the company-wide cost cap in tests:

**Rule 1: any live aggregate gate (SUM over a shared dev DB) must be neutralised in test setup.**
Vitest files run concurrently against ONE dev DB, and killed runs leave rows behind, so a "global spend vs cap" check can flip mid-run from *other* suites' data. Fix: force the cap env to an unreachable value in the vitest `setupFiles` (runs in every worker). Over-threshold tests stay deterministic by setting an explicit tiny cap around their OWN seeded row, or by mocking the probe functions — never by relying on ambient DB state.

**Rule 2: a test that intentionally triggers a `logger.warn` through the pino singleton must mock the logger module.**
Pino writes to the worker's shared stdout, and vitest interleaves it into whichever test file's output is streaming — so an intentional warning from suite A looks like a real production problem in unrelated suite B (this literally spawned a bug report attributing a mocked "cost cap reached" warning to the wrong suite). Mock the logger with a warn spy: silent output AND an assertable warning.

**How to apply:** whenever adding a new global/aggregate guard (caps, quotas, counters) or a new intentional-warning test path, wire the test-setup neutraliser and logger mock at the same time.

**Rule 3: a database-backed test should own the lifetime of rows used for its foreign-key assertions.** Vitest files share the dev DB and run in parallel; keep a test's user/org/session fixtures scoped to that test and clean them in `finally` when suite-wide cleanup or the stale-fixture janitor could overlap.

**Why:** file-level fixtures are convenient, but their lifetime is broader than an individual test and can diverge from preference-row writes when shared-database cleanup overlaps.

**How to apply:** for a test that inserts FK-dependent rows, seed the referenced records inside the test and remove only those IDs in a `finally` block.
