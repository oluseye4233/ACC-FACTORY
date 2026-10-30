---
name: Managed Publish database guards
description: Verify that security semantics survive the development-to-production schema plan, not just table and policy names.
---

Treat unfamiliar guard definitions as requiring review, even when a substring
check would recognize the expected actor setting or trigger name.

**Why:** A name can survive while its predicate becomes broader or its function
becomes a no-op. Conversely, PostgreSQL catalog formatting may change without
changing semantics; automatically accepting unfamiliar forms hides that review
decision.

**How to apply:** Check required positive privileges as well as prohibited ones,
and distinguish catalog membership from the effective role inside the actual
request transaction. PostgreSQL JSON represents OIDs as strings while a driver
may parse native OID arrays as numbers; handle explicit equivalent
representations, not arbitrary truthy/coerced role identifiers.

Check each required privilege separately; never treat a comma-separated
`has_table_privilege` argument as an all-required-privileges assertion.

**Why:** PostgreSQL returns true when any listed privilege is held. A combined
SELECT/INSERT/UPDATE test can therefore accept an incomplete workflow grant.

**How to apply:** Evaluate one table/privilege pair per check and require every
pair to pass, alongside schema usage and the separate forbidden-privilege checks.

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
deploy-time migrations or startup self-healing merely to bypass managed Publish.

A no-change Publish schema diff is not evidence of security parity.

**Why:** Read-only catalogue comparison found production policy names without
their predicates, missing FORCE RLS, the missing restricted operations role
and missing immutability triggers, while the Publish diff reported no changes.
The separate ARK schemas and login were present, so their verification did not
establish protection for the existing public-schema feature workflows.

**How to apply:** Compare real roles, policy expressions, forced-RLS flags and
triggers in both environments. Do not recommend repeated publishing as a repair
when the diff cannot represent the missing objects. Identify a reviewed,
platform-approved administration path before proposing production security
changes; do not replay historical table-creation migrations against live data.

The user explicitly authorized the ARK migration → security-verification →
API startup chain using the workspace-compatible artifact deployment settings.
This is a narrow exception for the supplied ledgered ARK SQL migrations, not
permission to silently repair protections or mutate production during agent work.

**Why:** the requested release policy must refuse API startup when migration or
verification fails, rather than expose an unverified application.

**How to apply:** retain the pnpm/artifact startup gate, keep failures fatal, and
do not execute it against production as an agent-side validation step. A passing
check on a separate restricted connection does not prove the application's
actual queries use that connection or activate the protected workflows.

FORCE RLS does not constrain a PostgreSQL superuser/BYPASSRLS connection.
Feature-scoped operations use a restricted non-login, non-bypass role inside
actor transactions; test cross-owner reads under that actual role.

**Why:** The development application connection was observed to bypass RLS;
policy definitions and FORCE RLS alone did not prove tenant enforcement.
This does not resolve the separate project-wide RLS work.

Keep development and production restricted database connection strings separate.
The development database host `helium` is workspace-local; it is not the
production PostgreSQL host. Secret-name presence and a passing workspace
verification do not validate the production secret's value.

**Why:** Publishing reached the security gate but failed DNS resolution when
its restricted connection used a placeholder or the workspace-local host.
A later workspace connection also failed because its target hostname had
leading whitespace.

**How to apply:** Check the latest build's own runtime logs, distinguish the
environment actually tested, and have the user correct the appropriate secret
using that environment's database connection details. Never read or print full
credential values, copy development URLs into production, normalize credentials
silently, or weaken the fail-closed security gate.
