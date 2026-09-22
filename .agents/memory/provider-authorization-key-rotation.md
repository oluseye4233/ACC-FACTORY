---
name: Provider authorization key rotation
description: Durable rules for rotating encryption keys used by opaque F10 provider authorization references.
---

F10 provider authorization references must use a dedicated versioned encryption keyring with exactly one current key and at most one previous key. A reference opened with the previous or legacy rollout key must be re-encrypted under the current key without returning its plaintext to the client. If the stored key version is unavailable, disable the connection and persist an auditable reconnect reason instead of retrying or falling back to another secret.

**Why:** Session-signing secret rotation must not invalidate provider connections, while an unbounded key history would extend exposure indefinitely and silent fallback could decrypt with unintended material.

**How to apply:** Keep new writes on the current dedicated key, retain only the immediately previous key for the bounded rotation window, and remove it only after stored references have been rewrapped or affected accounts are ready to reconnect.