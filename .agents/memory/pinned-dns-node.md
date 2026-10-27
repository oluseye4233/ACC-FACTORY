---
name: Pinned DNS and Node address-family selection
description: A validated single-address lookup must not accidentally use the array-returning lookup contract.
---

When pinning a checked DNS address in an HTTPS request, explicitly set its
address family or support both Node lookup callback shapes, including
`options.all`. Do not weaken destination validation to fix connection errors.

**Why:** In this environment, Node automatic address-family selection requested
the all-address callback contract. Returning a single address instead caused
`Invalid IP address: undefined` even though public destination validation passed.

**How to apply:** Include the checked family with a single pinned address, and
regression-test that option. Keep TLS hostname verification and redirect/private
address safeguards intact; verify one public retrieval, not just mocked success.
