# Dependency advisory review

## Current result

The dependency audit now reports **one high and one moderate advisory**, down
from one high and two moderate. This is not a clean security scan or a claim of
certification. No audit suppressions, security checks or release-age protections
were disabled.

### Fixed: typography selector parser

`@tailwindcss/typography@0.5.20` pins `postcss-selector-parser@6.0.10`,
affected by GHSA-rj75-hqrm-r3gf. The latest typography release still has this
pin, so a parent-scoped pnpm override selects the patched parser `^7.1.6`.
It does not replace every v6 dependency indiscriminately.

Regression tests resolve the parser through typography itself and exercise the
AST operations typography uses for common trailing pseudo-elements. The full web
production build also succeeds with the replacement.

### Open: braces — high

- Advisory: GHSA-vfj7-8cjw-p6xm.
- Installed version: 3.0.3, through
  `http-proxy-middleware -> micromatch -> braces`.
- The registry's latest `braces` and proxy releases have no patched upgrade.
- Current application proxy configuration supplies no glob `pathFilter`.
  The dependency defaults to literal `/` prefix matching. The attacker-controlled
  request pathname is not used as a brace pattern on that path.
- A regression test exercises the installed dependency's default filter with
  deeply nested braces in the request pathname.
- The mockup sandbox also uses braces through `fast-glob`; this development
  tooling path is not the public API proxy, but the package remains vulnerable.

This is a bounded reachability observation, **not a vulnerability fix**.
Do not introduce user-controlled glob patterns. Re-evaluate on proxy/filter or
tooling changes; upgrade when an upstream fix exists. Replacing the authentication
proxy solely to eliminate an unreachable optional matcher would require separate
compatibility review.

### Open: sprintf-js — moderate

- Advisory: GHSA-hp3w-g68c-fv3c.
- Installed version: 1.0.3, through `mammoth -> argparse -> sprintf-js`.
- The registry's latest `sprintf-js` and Mammoth releases have no patched upgrade.
- The application uses Mammoth's library `extractRawText({ buffer })` API.
  Mammoth's command-line entrypoint loads argparse; its library entrypoint does
  not. An isolated-process regression test extracts a real in-memory DOCX while
  rejecting any attempt to load argparse or sprintf-js.

This verifies the exercised library path, **not every possible dependency path**.
Do not switch document ingestion to Mammoth's CLI or accept untrusted format
strings. Keep the advisory open until a compatible fix or reviewed replacement
is available.

## Recheck

### Registry and boundary recheck — 2026-10-20

- A fresh `pnpm audit --json` still reports one high (`braces`) and one
  moderate (`sprintf-js`) advisory, with no patched version listed for either.
- Registry latest versions remain braces 3.0.3, sprintf-js 1.1.3,
  micromatch 4.0.8, http-proxy-middleware 4.2.0 and Mammoth 1.13.0.
  Upgrading sprintf-js alone would still select an affected version.
- Both checks in `node --test scripts/src/dependency-boundaries.test.mjs`
  passed: literal proxy filtering and DOCX library extraction without CLI
  dependency loading. These remain scoped reachability checks, not fixes.
- No dependencies, lockfile, audit exclusions, runtime configuration or
  production services were changed. Typechecks/builds were not rerun for this
  read-only dependency review.

Run `pnpm audit`, workspace typechecks/tests and the web production build.
The two open advisories must remain visible; a registry audit will continue to
exit nonzero while they remain. The boundary tests are included in the existing
scripts test command and do not alter deployment startup/security gates.

No production database, role, credential, migration or published service was
changed by this dependency update.
