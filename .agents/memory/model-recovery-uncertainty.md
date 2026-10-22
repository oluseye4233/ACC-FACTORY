---
name: Model recovery uncertainty
description: Avoid duplicate paid calls when a worker loses an external model outcome.
---

Save dispatch intent before a paid model request, replay completed outputs, and
serialize duplicate requests across API instances. An unknown provider outcome
must stop automatic redispatch; elapsed time alone is not permission to retry.

**Why:** The user requested interruption recovery without duplicate charges.
Provider completion and database persistence cannot be one atomic transaction.
Calling an ambiguous failure "retryable" can bill the same repair/review twice.

**How to apply:** Allow explicit resume after a proven pre-dispatch denial,
reuse retained artifacts/results, and require ledger review for uncertain calls.
Do not promise provider-level exactly-once billing. Recovery bookkeeping must
not mutate immutable evidence, automatically accept Boomerang work or weaken
publication/certification gates.
