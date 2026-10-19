# Separate fresh-install baseline

Existing databases keep their historical migration files and ledger records.
The immutable source for this baseline is pinned by SHA-256 in `baseline.json`.
The recipe corrects five introspected index operator classes for UUID columns;
it does not remove indexes, uniqueness, foreign keys or security checks.

The CI-only runner builds the fresh baseline from that frozen source and the
five exact reviewed substitutions. A source or substitution mismatch fails
closed. The ledger stores the checksum of the baseline actually executed, not a
claim that the original commented file ran. A separate provenance row records
the source, manifest and executed checksums.

After that baseline commits, Drizzle applies the unchanged incremental migration
history starting with 0001. Subsequent generation still uses the existing
`lib/db/migrations` journal. No migration or checksum in an established database
is rewritten.

This is currently exercised only by `scripts/db/ci-migrations.mjs`, restricted
to an empty loopback database named `workspace_test`. It is not a production
installer, startup hook, security installation or authorization to reset data.
