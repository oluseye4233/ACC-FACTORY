---
name: Generator and schema peer isolation
description: Why tooling updates can silently select the wrong schema/client major in this pnpm catalog workspace.
---

Treat generator target versions and schema peers as explicit compatibility
contracts rather than relying on hoisted-package discovery.

**Why:** Orval cannot reliably infer catalog-backed React Query/Zod versions
from this workspace's output projects. Separately, resolver v3 imports Zod but
does not declare a Zod peer; adding Zod v4-dependent tooling can make its types
resolve the hoisted v4 package even while the application directly uses v3.
Switching an individual form import does not repair that undeclared peer.

**How to apply:** Preserve explicit generator target majors. Keep undeclared
schema peers bound to their compatible application major through pnpm package
extensions; do not migrate application schemas just to satisfy accidental
hoisting. After a tooling upgrade, regenerate, typecheck the entire workspace
and run the full test suite, not only shared-library checks.

Keep the test runner on the application's compatible Vite major.

**Why:** Updating unrelated SDKs can re-resolve Vitest's optional Vite peer to a newer major even while the app's direct Vite stays unchanged. The existing React transform plugin then fails to compile JSX in tests, despite the app server still starting.

**How to apply:** Preserve the targeted test-tool Vite overrides when changing dependencies. Verify both app and test-runner resolution; do not upgrade the application framework just to repair an accidental test peer.
