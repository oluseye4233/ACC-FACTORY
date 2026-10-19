# Credit and private preparation recovery

## Scope and current activation

These changes recover abandoned Cartridge reservations and uncommitted private
IMPRIMA/SHORT SPRINTS preparation uploads. They do not approve, certify, release,
publish, or delete workflow records. They do not install the separate production
security role.

Two additive public-schema migrations are included:

- `0054_sudden_hiroim.sql`: nullable Cartridge claim token.
- `0055_bumpy_master_mold.sql`: durable preparation upload intents and due index.

Only the verified development database and isolated test cluster were migrated
by the Agent. Production remains unchanged. Use the supported Publish process
for managed production schema changes; do not add a production installer or
modify the existing security-gated startup chain.

## Cartridge credits

Each claim receives a new random fencing token. Linking and releasing a credit
must match that token, the consumed status, and an empty package link.
The package and credit link commit in the same database transaction.

Immediate release retries transient errors up to three times. The background
reconciler runs on startup and every five minutes while the API is running, only
when the existing subscription switch is enabled. It returns at most 100 expired
unlinked reservations per pass after a 15-minute lease, skipping locked rows.
Recovery clears the old token, preventing a slow request from spending or
releasing a newer claim. A late link fails and rolls back package persistence.

Linked purchases are never refunded by reconciliation. Legacy consumed credits
without tokens are retained for administrator review: age alone is not proof
that their unfenced legacy writer cannot still complete. This change does not
enable subscriptions, checkout, or billing.

## Private preparation files

Before writing any bytes, the server records the exact intended private keys in
the current database. It marks that intent COMMITTED in the same transaction as
the preparation artifact. Failed uploads/transactions retain their intent.

The recovery worker:

1. Examines at most 20 due intents per pass.
2. Requires both an intent age and an object age of at least 24 hours.
3. Acquires the same cross-process account lock as the preparation writer.
4. Rechecks intent state and exact account/preparation/file-key structure.
5. Retains the entire intent if its preparation or another artifact references
   any intended file.
6. Inspects metadata only, never downloads document bytes.
7. Deletes only the inspected object generation, if explicitly enabled.
8. Preserves the intent after partial failures and periodically revisits
   recovered intents in case a delayed upload arrives.

Unknown states, unknown object ages/versions, changed generations, active
writers, and untracked legacy objects are never treated as deletable proof.
No bucket-wide orphan scan is performed. An object absent from one database
may still belong to another environment sharing storage.

### Default: report-only

The worker starts with the API and scans every five minutes while the process
is awake. Default reports do not delete files or persist intent changes.
The log event is **Private preparation storage recovery**, with counts for
scanned, candidates, deleted, missing, retained, busy and errors; no file
contents or private download URLs are logged.

An administrator may separately review and enable
`PREPARATION_ORPHAN_RECOVERY_APPLY=true` in the intended environment.
**Consequence:** eligible, unreferenced, aged file generations will be permanently
deleted from private App Storage. Verify that the database and private-storage
configuration belong to the same environment before enabling it.
The Agent has not enabled this setting or deleted real storage objects.

Existing private preparations remain downloadable and their bytes are unchanged.
Untracked archives from before upload-intent recording remain retained; they
need separate provenance review rather than automatic deletion.

## Operational limitations

Intervals do not wake an autoscaled sleeping API. Startup resumes recovery, but
an external authenticated scheduled wake-up and stalled-worker alerting are
separate operational improvements. Successful database-backed/mocked-storage
tests are not evidence that production cleanup is enabled.
