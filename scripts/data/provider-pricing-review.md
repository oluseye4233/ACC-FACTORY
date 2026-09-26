# Provider pricing source review

The weekly `Provider pricing review` workflow fingerprints the visible text of
the official provider pricing pages listed in
`provider-pricing-snapshots.json` and extracts the documented model rates from
provider-specific page structures. A changed page, newly listed or retired
model, or changed input, cached-input, output, cache, or tier value fails the
workflow with a focused comparison.

The extracted `rates` in the manifest are review snapshots only. The check
never edits `artifacts/api-server/src/lib/pricing.ts`; production prices remain
unchanged until a separate reviewed code change. Review each changed official
page and its reported differences. Saved provider-page examples and extraction
tests live under `scripts/test/fixtures/provider-pricing/`. Once the source has
been reviewed, run
`pnpm --filter @workspace/scripts run check-provider-pricing -- --accept-current`
to record the new fingerprints and observational rate snapshots. Commit that
manifest change for normal review.

Page-level fingerprints can still change for unrelated documentation edits.
When the extracted model and rate data are unchanged, the check identifies the
mismatch as a page-only change. Treat every mismatch as a review signal, not as
proof that a production price should change.