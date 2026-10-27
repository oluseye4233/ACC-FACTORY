---
name: Streaming test lifecycle
description: Progress events do not establish that a provider call has started or finished.
---

Streaming regression tests must distinguish an open progress stream, actual
provider invocation, completed generation and durable artifact persistence.
Do not use the first SSE progress event as proof that provider work has started.

**Why:** F6 can emit progress while asynchronous budget reservation still waits
on the database. A test that assumes the provider has already started can fail,
delete its session during cleanup, and cause a subsequent accounting insert to
fail after the mocked generation finishes.

**How to apply:** Synchronize simulated provider completion explicitly with
browser disconnection; wait for provider invocation and then verify durable
output and source lineage before fixture cleanup. Keep model calls mocked.
The HTTP/SSE request schema must accept the same supported source mode as the
handler and frontend; never loosen ownership, stage or governance gates to
make the disconnect test pass.
