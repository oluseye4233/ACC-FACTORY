---
name: Managed LLM routing
description: User's billing-route choice for extended models and the managed proxy transport caveat.
---

DeepSeek, Kimi, Qwen and Mistral use Replit AI Integrations through OpenRouter, rather than separate direct-provider accounts. The user selected Replit-credit billing for the extended providers.

**Why:** The user wanted these providers activated without managing three additional vendor credentials.

**How to apply:** Preserve this billing route unless the user chooses otherwise. Do not request direct-vendor keys or silently fall back to a different account or model.

JEV is an optional shadow adviser, not a generation provider or a new production gate.

**Why:** The user approved introducing Mistral for generation and JEV for advisory
routing/remediation, while retaining the existing F floor and avoiding extra gates.

**How to apply:** Only explicit credit-labelled actions may request paid JEV advice.
Keep model selection, JCSE/Mathmon, Boomerang acceptance and release authority
separate from its predictions. Do not equate model confidence with measured accuracy
or claim these managed cloud routes support disconnected enterprise operation.

The user requires cost/complexity auto-selection to remain a suggested option, never compulsory or silently applied.

**Why:** The subscriber retains the decision over which model to use.

**How to apply:** Showing or refreshing a recommendation must not change a session preference, engine override, or start generation. Require an explicit apply action, preserve manual choices, and keep engine execution separate.

The provisioned Replit AI proxy can use internal HTTP. An HTTPS-only check on its managed base URL rejects requests locally before any provider call.

**Why:** This occurred during activation checks despite successful integration provisioning; the provisioned SDK configuration was valid.

**How to apply:** Use the server-side managed SDK base URL as provisioned. Do not extend this exception to request-supplied or untrusted public endpoints.
