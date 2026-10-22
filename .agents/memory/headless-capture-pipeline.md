---
name: Headless capture pipeline
description: How to capture authenticated app screenshots/GIFs in this workspace, and the background-process kill trap.
---

**Rule:** Use managed background shell tasks or resumable foreground chunks for long work. Raw `nohup ... &` children can be killed when a shell invocation ends; do not confuse those with the supported, tracked background-task tool.

**Why:** A capture run backgrounded with nohup died between polls with no log file; only the resumable-skip design allowed finishing in a second foreground run.

**How to apply:** For any script expected to exceed the ~2-min bash timeout: make each output idempotent/skippable, then run `timeout 110 ...` foreground passes until done. For authenticated UI captures: system `chromium` (nix) + `puppeteer-core` works; log in by `page.evaluate(fetch('/api/auth/login', ...))` with the secret read from `process.env` (never interpolated into logs or files), then navigate via `localhost:80`.

**Atomic media writes:** resume-by-existence logic means outputs must be written atomically — encode to a temp file in the SAME directory as the final path (a /tmp temp risks EXDEV on rename), and force the muxer explicitly (`-f gif`) because a `.tmp` suffix hides the extension ffmpeg uses to pick it.

**Browser test authentication:** Programmatic Clerk claims alone do not satisfy
this project's separate staff-access session. The browser tester cannot be
assumed to read server environment variables simply because a secret's name
was included in its instructions. Use an approved secure app-session setup or
report the protected UI unverified; never weaken the wall to complete a test.
Use example.com-style identities for the managed Clerk test helper: it rejected
reserved `.test` addresses even though those are useful for direct DB fixtures.

**Why:** Both authentication paths were attempted; a valid Clerk test login
still stopped at staff access, without a supported way to supply the code in
that browser environment.

**How to apply:** Establish a legitimate app session before spending a browser
run on protected journeys, and explicitly clean up test-owned application
rows when their email does not match the normal fixture janitor's filter.
