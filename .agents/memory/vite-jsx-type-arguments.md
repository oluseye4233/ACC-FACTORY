---
name: Vite JSX type arguments
description: Dev-only metadata instrumentation can reject explicit generic JSX tags.
---

Avoid explicit TypeScript type arguments on JSX component tags in the web app;
let typed props/callbacks infer them or use a typed wrapper.

**Why:** Replit's dev metadata transform can inject attributes between a
component name and its type arguments, producing invalid TSX. TypeScript and
Vitest may both pass because they do not use that dev instrumentation path.

**How to apply:** For new generic React components, verify the actual Vite
module transformation or browser view as well as typechecking. Do not remove
the metadata tooling to work around this.

If removing JSX type arguments widens an enum union to `string`, bind the
generic outside JSX (`const Bound = Component<EnumType>`) and render the bound
component. This preserves type safety without creating an instrumented generic
JSX tag. Include this constraint when delegating frontend implementation.
