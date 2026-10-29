---
name: Managed LLM routing
description: User's billing-route choice for extended models and the managed proxy transport caveat.
---

DeepSeek, Kimi and Qwen use Replit AI Integrations through OpenRouter, rather than separate direct-provider accounts. The user selected Replit-credit billing on 2026-10-29.

**Why:** The user wanted these providers activated without managing three additional vendor credentials.

**How to apply:** Preserve this billing route unless the user chooses otherwise. Do not request direct-vendor keys or silently fall back to a different account or model.

The user requires cost/complexity auto-selection to remain a suggested option, never compulsory or silently applied.

**Why:** The subscriber retains the decision over which model to use.

**How to apply:** Showing or refreshing a recommendation must not change a session preference, engine override, or start generation. Require an explicit apply action, preserve manual choices, and keep engine execution separate.

The provisioned Replit AI proxy can use internal HTTP. An HTTPS-only check on its managed base URL rejects requests locally before any provider call.

**Why:** This occurred during activation checks despite successful integration provisioning; the provisioned SDK configuration was valid.

**How to apply:** Use the server-side managed SDK base URL as provisioned. Do not extend this exception to request-supplied or untrusted public endpoints.
