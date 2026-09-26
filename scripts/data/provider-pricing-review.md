# Provider pricing source review

The weekly `Provider pricing review` workflow fingerprints the visible text of
the official provider pricing pages listed in
`provider-pricing-snapshots.json`. A changed page or a configured model ID that
disappears fails the workflow so a person can check for changed rates, retired
models, newly listed models, or billing-rule changes.

The check does not parse provider prices into production configuration and
never edits `artifacts/api-server/src/lib/pricing.ts`. Review each changed
official page and update the production rate table only in a reviewed code
change. Once the source has been reviewed, run
`pnpm --filter @workspace/scripts run check-provider-pricing -- --accept-current`
to record the new fingerprints. Commit that manifest change for normal review.

Page-level fingerprints can also change for unrelated documentation edits.
Treat every mismatch as a review signal, not as proof that a model price
changed.