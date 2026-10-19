---
name: Recovery provenance
description: Why private preparation cleanup requires durable provenance and reviewed activation.
---

Do not equate "absent from this database" with "safe to delete from storage."
Recover private preparation bytes only when durable intent from the matching
database proves ownership, and preserve older untracked archives for review.
Keep real storage deletion report-only by default until an administrator opts in.

**Why:** storage can be shared between environments, and a SQL rollback or lost
commit response cannot tell us whether external bytes are orphaned. A broad
bucket sweep could delete another environment's valid archive. This recovery
rollout deliberately did not authorize production changes or real deletions.

**How to apply:** preserve provenance before new storage writes and finalize it
atomically with artifact metadata. Keep reference, active-writer, age and object
generation checks when extending cleanup. Do not "backfill" proof from mere
absence or automatically delete legacy objects to make a scan look complete.
