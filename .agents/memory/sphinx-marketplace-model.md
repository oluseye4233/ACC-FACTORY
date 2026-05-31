---
name: Sphinx Marketplace model
description: How SPC marketplace features (download/buy/suggest/lineage) must be architected given Sphinx is the external single point of sale.
---

# Sphinx Marketplace = external single point of sale

The user decided every market-related SPC routes through the **external** Sphinx
Marketplace as the single point of sale — NOT an in-app marketplace. Institution
subs grant access to enterprise-created SPCs; SPC value is expressed in "points".

**The live Sphinx API is not available yet** ("when it is live, API will be
provided"). So marketplace-dependent surfaces (search, buy, download + receipt,
sales funnel, suggest) must be built as a routing **seam**, not a working flow:

**Why:** building a working buy/download/search against a non-existent API is
throwaway. The seam lights up automatically when `SPHINX_BASE_URL` + the live API
are wired.

**How to apply:**
- Mirror the existing publish route pattern in `routes/integrations.ts`: per-user
  `integration_credentials` (provider `sphinx`) → `404 SPHINX_NOT_CONNECTED`;
  `SPHINX_BASE_URL` unset → `503 SPHINX_NOT_CONFIGURED`; decrypt key at call time;
  fetch `${sphinxBase}/api/marketplace/...`; network fail → `502 SPHINX_UNREACHABLE`.
- Frontend maps `SPHINX_NOT_CONNECTED` → "connect in Account → Connected Services"
  and `SPHINX_NOT_CONFIGURED`/`SPHINX_UNREACHABLE` → "marketplace not yet live".
- SPC **Lineage** is internal/buildable now (no external dep): the provenance
  chain is the session's F1–F5 artifacts. Anchor the chain to the chosen SPC's
  `createdAt` (prior stages must precede it) so multi-run sessions stay correct —
  session-global "latest per stage" is wrong when a session has reruns/branches.
- Sphinx integration endpoints are hand-written (NOT in the OpenAPI contract) and
  called from the frontend via `api.post` (`@/lib/api`, `ApiError`). Add new
  Sphinx routes the same way to avoid OpenAPI codegen churn.
- Still deferred until the live API: buy/download + timestamped receipt audit
  trail, sales funnel, and folding a purchased candidate back into a session.
