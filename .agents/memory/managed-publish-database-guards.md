---
name: Managed Publish database guards
description: Verify that security semantics survive the development-to-production schema plan, not just table and policy names.
---

Inspect the managed Publish schema plan before recommending a release that
depends on PostgreSQL roles, RLS predicates, FORCE RLS or trigger functions.
Do not assume applying a development SQL migration carries all its effects
into the production Publish diff.

**Why:** A read-only pre-release plan showed new policy names without their
USING/WITH CHECK clauses, and omitted the restricted role and custom trigger
guards installed in development. The tables alone were not sufficient for
safe operation. This is an observation about that proposed plan, not a claim
that Replit cannot support those PostgreSQL features.

**How to apply:** Inspect the actual diff and perform post-publish guard
checks. Missing guards must leave private artifact operations unavailable,
not downgrade them to a superuser connection. Do not add production DDL,
deploy-time migrations or startup self-healing to bypass managed Publish.

FORCE RLS does not constrain a PostgreSQL superuser/BYPASSRLS connection.
Feature-scoped operations use a restricted non-login, non-bypass role inside
actor transactions; test cross-owner reads under that actual role.

**Why:** The development application connection was observed to bypass RLS;
policy definitions and FORCE RLS alone did not prove tenant enforcement.
This does not resolve the separate project-wide RLS work.
