# ACC FACTORY — ATANDA Command Centre

An **internal staff back-end ops platform** in front of the FORGE.BONSAI HARNESS — a PDD-blueprint application whose engines are ordered atomic prompts (F1–F9 plus the F0 advisory layer, ATLAS J, and the PFP drift detector) driving a deterministic prompt → SPC → PDD → certified MVP-PDD pipeline for each session.

## What it does

Per session, the HARNESS runs a creator's idea through an ordered engine chain:

| Engine | Output |
| --- | --- |
| F1 | Diagnoses a raw prompt |
| F2 | Builds an Atomic Prompt |
| F3 | Grows a CELL Micro Agent Birth Package |
| F4 | Converts to a Micro PDD |
| F5 | Builds a full SPC |
| F6 (+ VDJ) | Drafts a 4-Part ATLAS PDD with a VIBE DJ recommendation |
| F7 | Compresses to a SPARTAN-certified MVP PDD with a public verification URL |
| F8 CODE DJ | Scaffolds a runnable codebase from the certified spec (ZIP, IDE bundles, GitHub push) |
| F0 | Advisory services layer (retainers, monitoring sweeps, alerting) |

Supporting systems: DE-SPC synthesiser, ATLAS J side-step, PFP drift detector, ingestion of existing design docs (IPDD → PWDD), Cartridge, Sphinx Marketplace seams, Ascension Protocol onboarding, notifications, and an activity log.

## Access model

Internal staff tool: one shared `STAFF_ACCESS_CODE` plus typed name/initials for attribution. All staff get full access to every engine. A single company-wide monthly LLM cost cap (`STAFF_MONTHLY_COST_CAP_USD`) guards spend.

Subscriptions (Clerk auth, Stripe tiers, per-seat orgs, per-project credits) are fully coded and tested but dormant behind `SUBSCRIPTIONS_ENABLED=false` — flip to `true` to re-activate the public pricing + Stripe-billed SaaS with no code changes.

## Stack

- **Monorepo:** pnpm workspaces, Node.js 24, TypeScript 5.9
- **API:** Express 5 + Clerk + Stripe + pino (`artifacts/api-server`)
- **Web:** React + Vite command centre (`artifacts/command-centre`)
- **DB:** PostgreSQL + Drizzle ORM (migrations under `lib/db/migrations`)
- **Contract-first:** OpenAPI (`lib/api-spec/openapi.yaml`) → Orval-generated Zod schemas + React Query hooks
- **LLM:** Claude Sonnet 4 via a provider-switching integration layer

## Repository layout

```
artifacts/
  api-server/        Express API + HARNESS engines (src/engines/*)
  command-centre/    React/Vite staff portal
lib/
  api-spec/          OpenAPI contract (single source of truth)
  api-zod/           Generated Zod schemas
  api-client-react/  Generated React Query hooks
  db/                Drizzle schema (src/schema/*) + migrations
scripts/             Ops scripts (cron-tick, migration-status, PDF exports)
docs/architecture/   Deep notes: features, decisions, gotchas, cost guardrail
```

## Run & develop

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # API server
pnpm run typecheck                            # full typecheck
pnpm run test                                 # workspace tests (cached LLM fixtures, ~15s)
pnpm --filter @workspace/api-spec run codegen # regenerate API hooks + Zod schemas
pnpm --filter @workspace/db run generate && pnpm --filter @workspace/db run migrate  # DB schema sync
```

Required env: `DATABASE_URL`, `SESSION_SECRET`, `STAFF_ACCESS_CODE`, `ANTHROPIC_API_KEY`. See `replit.md` for the full env reference, scheduled-job (cron) setup, and operational gotchas.

### ARK-X Hive Gold Architect eligibility

When public subscriptions are enabled (`SUBSCRIPTIONS_ENABLED=true`), an
authenticated account can submit `arkXEligibilityAssertion` to
`POST /api/billing/checkout` for an `ARCHITECT` plan. ACC-FACTORY remains the
subscription authority: it verifies the short-lived, asymmetric ARK-X JWT and
then creates the Stripe checkout with its own 50%-off coupon. Configure
`ARK_X_PUBLIC_KEY` (PEM; escaped `\n` is accepted), `ARK_X_PUBLIC_KEY_KID`, and
optionally `ARK_X_ALLOWED_ALGORITHMS` (comma-separated; defaults to `RS256`).
The assertion must have `iss=ark-x`, `aud=acc-factory`,
`eligibility=hive_gold`, `discountPercent=50`, `version=1`, and valid `sub`,
`jti`, `iat`, and `exp`; its lifetime may not exceed 10 minutes. Completed
redemptions are one-time by `jti` and store the resulting Stripe checkout
session. The ARK subject is permanently linked one-to-one to the currently
authenticated ACC account — no email matching is performed — while a later
fresh assertion from that same linked subject may be used for resubscription.
Checkout creation uses the assertion JTI as its Stripe idempotency key, so a
same-account retry recovers the original checkout rather than consuming it.

**Current deployment safeguard:** the active auth path is a shared internal
staff access code that deliberately synthesizes an ADMIN/INSTITUTION account.
It is not customer authentication and is never accepted by billing routes.
The retained Clerk middleware is not mounted or verified in the current app,
so `/billing/*` fails closed with `503 CUSTOMER_AUTH_NOT_CONFIGURED` even when
subscriptions are enabled. Configure and mount a separately reviewed,
verified customer-auth middleware that resolves a real customer user and
subscriber before enabling ARK-X/customer checkout.

## Key docs

- `replit.md` — operating manual, env reference, top gotchas
- `docs/architecture/features.md` — per-engine and feature notes
- `docs/architecture/decisions.md` — architectural decisions
- `docs/architecture/gotchas.md` — non-obvious traps
- `docs/architecture/llm-cost-guardrail.md` — LLM spend constraints
