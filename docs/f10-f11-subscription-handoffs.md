# F10 and F11: subscription-based third-party handoff

## Available path

Subscribers may export their own eligible artifacts, open a third-party account
they already own, or sign up with that provider. No shared workspace connection,
third-party password, payment details or subscription purchase is collected by
ATANDA. Provider plans, app-install approval and usage charges remain external.
LangChain is a framework, not a required subscription; LangSmith is its hosted
evaluation/observability service.

### F10

1. Open F10 → Hand-off.
2. Select the exact project artifact, output kind, family and target.
3. Inspect the manifest and download the source-bound ZIP.
4. Continue in your own provider account using the included contract/instructions.
5. For connected delivery, authorize the matching provider under Native providers.
   This requires a configured broker implementing that target, not merely an
   existing subscription. Connection revocation prevents new deliveries.

New targets:

| Provider | Target | Meaning of completed delivery |
|---|---|---|
| Slack | `SLACK_NOTIFICATIONS` | Source-bound release update posted to an authorized channel |
| Slack | `SLACK_AGENT` | Hosted-agent entry point registered; not proof an agent ran |
| LangChain | `LANGCHAIN_APP` | Reviewed artifact imported into the user's existing runtime |
| LangSmith | `LANGSMITH_DATASET` | Source-preserving dataset example published; no invented expected answer or evaluation verdict |

Export alone performs none of those external operations. Importing an SPC does
not create an execution engine or change SPC Player's advisory-only boundary.
The legacy `LANGCHAIN` file-export target remains supported.

### F11

1. Open a session → F11 Host Connector → Manual handoff.
2. Complete F8 verification if the selected bundle has no verified child.
3. Download the verified source/runtime package or Replit Agent handoff ZIP.
4. Open an existing provider console or its official signup page.
5. Import the package, review its runtime/build/environment settings, configure
   secrets in the provider's own secret manager, and deploy there yourself.
6. Supply independent staging/health/rollback evidence through the protected
   workflow if certification, promotion or F12 rollout is required.

The generic package is a TypeScript/Node handoff, not a promise of compatibility
with every host. The selected plan's source is pinned: F8's original bundle may
resolve only to its verified child, never to another project's bundle.

Downloading a package or opening a console does not mark H4, H7 or H8 complete,
create a HostReceipt, or activate an unqualified F11 adapter. F10-to-F11 automated
promotion remains separately gated.

## Broker adapter obligations

Existing `/v1/authorize`, `/v1/authorize/exchange` and `/v1/bundle-deployments` contracts apply.
Support must be added and qualified in the separately operated broker for each new
provider/target. The ATANDA backend never calls user-supplied runtime URLs directly.

- Bind the authorization reference to the current tenant, provider and permitted
  workspace/project; never accept target workspace IDs as authorization.
- Slack uses OAuth v2 app installation with least-privilege scopes (for example
  `chat:write` for notifications). An agent entry point also needs an existing
  hosted runtime, an approved Slack app and verified inbound request signatures,
  timestamp/replay checks and retry deduplication. A Web API connector alone does
  not supply Slack Events or an agent runtime.
- Resolve runtime hostnames, reject private/link-local/metadata addresses and
  unsafe ports, pin DNS for the request and every redirect, bound time and size,
  and never forward provider credentials to an arbitrary runtime URL. Static URL
  validation in the platform is not a substitute for those network controls.
- Hold credentials server-side in the broker. App configuration contains only
  identifiers, public endpoints and names. Never embed tokens in exported files.
- Apply idempotency before external writes. Verify the exact ZIP/manifest/source
  hashes, reject a changed bundle, and return a durable operation identifier.
- Preserve source metadata in LangChain imports and LangSmith dataset examples;
  require explicit consent for artifact content leaving ATANDA.
- Poll real operation state. `POSTED`, `REGISTERED`, `IMPORTED` and `PUBLISHED`
  describe the corresponding operation only. Never turn acceptance into a
  provider execution, evaluation PASS or certification result.

## Deployment

The additive public-schema migration adds `SLACK`, `LANGCHAIN` and `LANGSMITH` to
the existing F10 provider enum. It changes no roles, RLS policies or grants.
The migration was applied to development; production uses the existing reviewed
migration/security-verification deployment path. No production change is made by
the handoff UI itself. Publishing is still a separate administrator action.
