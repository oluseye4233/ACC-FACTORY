---
name: ARK startup concurrency
description: Why the existing startup runner serializes its full critical section and where that protection ends.
---

The authorized ARK startup runner must serialize ledger bootstrap and reads,
checksum decisions, migrations, grants and the existing role-password update
on the same PostgreSQL session, not just serialize the final password statement.
Keep failure fatal and retain the separate security verifier.

**Why:** Read-only production investigation found a role-password update failing
with `tuple concurrently updated` during autoscale startup, followed by startup
exit and crash-loop reports. The earlier readiness failure had no logged
database exception and cannot be attributed to that collision.

**How to apply:** Preserve a common database-scoped advisory-lock protocol across
cooperating runners. It does not coordinate old unlocked builds, manual admins
or other databases in the cluster, while PostgreSQL role passwords are
cluster-wide. Consistent production credentials and controlled rollout remain
operator requirements. Mock-client tests are not evidence of real PostgreSQL
contention safety or production recovery.
