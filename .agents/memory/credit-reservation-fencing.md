---
name: Credit reservation fencing
description: Concurrency rule for safely reclaiming abandoned paid-credit reservations.
---

Any credit reservation that can expire and be reclaimed must carry a unique token for that claim. Link and release operations must conditionally match both the credit and token; reconciliation must invalidate the old token.

**Why:** An LLM-backed request can outlive a time-based lease. Without a fencing token, the stale request can later link or release a credit that another request has already reclaimed, creating an uncharged success or corrupting linkage.

**How to apply:** Use a new token on every claim, clear it on successful link/release/reconciliation, and treat a zero-row conditional update as lost ownership. Add race coverage whenever another reservable credit type gains reconciliation.