---
name: Managed LLM routing
description: User's billing-route choice for extended models and the managed proxy transport caveat.
---

DeepSeek, Kimi and Qwen use Replit AI Integrations through OpenRouter, rather than separate direct-provider accounts. The user selected Replit-credit billing on 2026-10-29.

**Why:** The user wanted these providers activated without managing three additional vendor credentials.

**How to apply:** Preserve this billing route unless the user chooses otherwise. Do not request direct-vendor keys or silently fall back to a different account or model.

The provisioned Replit AI proxy can use internal HTTP. An HTTPS-only check on its managed base URL rejects requests locally before any provider call.

**Why:** This occurred during activation checks despite successful integration provisioning; the provisioned SDK configuration was valid.

**How to apply:** Use the server-side managed SDK base URL as provisioned. Do not extend this exception to request-supplied or untrusted public endpoints.
