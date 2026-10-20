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

Intervals do not wake an autoscaled sleeping API. Startup resumes recovery.
Successful database-backed/mocked-storage tests are not evidence that production
cleanup is enabled.

## External scheduled wake-up

The existing scheduled-job driver now accepts `recover-abandoned-resources`:

```sh
pnpm --filter @workspace/scripts run cron-tick -- recover-abandoned-resources
```

Configure an external scheduled job every five minutes (`*/5 * * * *`) using
this command, with the existing driver settings:

- `PUBLIC_BASE_URL`: the verified published API origin, not a development URL.
- `CRON_SECRET`: the same value configured on the published API. Configure this
  through the secrets interface; never put it in a URL or command argument.
- `CRON_TIMEOUT_MS`: optional per-request timeout; the default remains 60 seconds.

The driver POSTs `/api/cron/recover-abandoned-resources`. Missing, incorrect, or
unconfigured cron authentication is rejected before any recovery work.
Request parameters cannot enable deletion.

Both lanes retain their original bounds and database concurrency protections.
Credits run only when subscriptions are enabled. Storage is explicitly skipped
when its private directory is unconfigured; otherwise it is report-only unless
the existing reviewed operator opt-in is already enabled. A failed lane does
not prevent the other lane from being attempted.

An exception or any returned per-object storage errors yields HTTP 503, and the
driver exits nonzero. No successful heartbeat is recorded for that pass. The
JSON summary contains lane status/counts, not private keys or provider errors.
Disabled/unconfigured lanes are reported explicitly; a successful scheduled
invocation is not proof those features are enabled.

### Monitoring and activation boundaries

The target is registered with the existing durable cron monitoring system:
expected every five minutes, stale after twenty minutes without a successful
pass. Existing administrator notifications, episode deduplication and recovery
handling apply; recipient and email-provider configuration are still required.
The background monitor checks every fifteen minutes, so twenty minutes is the
staleness threshold, not a guaranteed email delivery deadline.
The status view can show a never-ticked target if no scheduler has been activated.

This detects missing or repeatedly failing **scheduled** passes. The per-record
failure ledger described below adds a separate operational view of repeated
record failures. Neither replaces an independent outage monitor: an unavailable
database/email provider can prevent this API from recording or delivering alerts.

Adding the endpoint/driver does not create a Scheduled Deployment or change
production configuration. Publish the code and configure/confirm the external
schedule before declaring wake-up recovery active. Keep the API externally
reachable by the scheduler; a private deployment sign-in wall will reject it
before cron authentication. Real private-file deletion remains report-only until
separately reviewed and explicitly enabled by an administrator.

## Repeated per-record failures and administrator alerts

Additive public-schema migration `0056_ordinary_iron_monger.sql` creates an
operational failure ledger and per-recipient notification delivery state. It
does not modify the protected ARK schemas or install/change any security role.
It has been applied in development only; production must receive the schema
through the supported Publish process before this code is activated.

- Each credit episode is bound to its exact reservation token. Each preparation
  episode is bound to its immutable upload intent. Messages show the resource ID,
  lane, count and observation dates—not private file paths, claim tokens,
  credentials, raw provider errors or user content.
- An immediate credit release records a failure only after its three local
  retries fail. Losing reservation ownership is not an operational failure.
- Normal bounded batch recovery remains the fast path. If that batch fails,
  recovery diagnoses/retries at most 100 eligible reservations individually
  using the same token, age and skip-locked checks. One failing record does not
  roll back other successful recoveries.
- Preparation inspection failures are recorded even in report-only mode.
  A successful inspection/recovery resolves the corresponding failure episode.
  Busy records are neither failed nor incorrectly declared healed.
- Failures count at most once per absolute five-minute period across overlapping
  processes. Three observed failed periods qualify for notification. These
  need not be adjacent periods: an apply-mode upload intent may retry daily.
  A later failure after a resolved episode starts a new episode.
- Dispatch rechecks the current credit token/state or preparation state and
  respects subscription/storage configuration. Superseded claims and committed
  preparation intents cannot qualify for an old alert.

### Email delivery and retry semantics

Both interval recovery and scheduled recovery attempt bounded alert delivery.
Configure `ADMIN_EMAILS` and the existing email provider through the normal
secrets/configuration flow. Empty recipients defer dispatch without consuming
notifications. Up to twenty distinct administrator addresses are supported by
this bounded dispatcher; an excessive list fails explicitly rather than silently
dropping recipients.

Each pass selects at most twenty failure episodes and attempts at most forty
messages. Previously unattempted episodes are prioritized, and accepted
recipients are not retried merely because another recipient failed. Delivery
leases and ownership tokens prevent competing replicas from independently
claiming the same notification; expired leases can be retried after a restart.

Only a successful, non-dry-run provider response stamps acceptance. A provider
failure, a simulated/dry-run response or a missing database acknowledgment leaves
the notification retryable. Provider idempotency keys remain stable for each
episode/recipient; their protection is subject to the provider's retention window,
not an unlimited exactly-once inbox-delivery guarantee.

Scheduled passes with alert-dispatch failures return HTTP 503 and do not refresh
the successful heartbeat. An empty administrator list is explicitly reported as
deferred, not as proof of delivered mail. In-process workers log delivery failures
and retain retry state. A database-wide outage is reported as infrastructure
failure; it cannot reliably write a per-record diagnosis into that same database.

Messages are operational snapshots and authorize no refund, deletion,
certification, approval or release. The counters and queued delivery state have
been tested using isolated resource IDs and mocked email/storage, not real
production email delivery. Cleanup application mode remains a separate reviewed
administrator opt-in.
