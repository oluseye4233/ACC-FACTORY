# ATANDA Command Centre

A re-platform of the ATANDA Command Centre MVP onto this pnpm monorepo: an authenticated portal in front of the FORGE.BONSAI HARNESS — itself a **PDD blueprint application**, not an SPC. The HARNESS is the instruction layer: a sequence of atomic prompts (F1–F7 + F6-VDJ, plus the DE-SPC synthesiser, the ATLAS J side-step, and the PFP drift detector) that drives the LLM through a deterministic prompt → SPC → PDD → certified MVP-PDD pipeline for each user session. Public `/pricing` surface, Stripe-billed tiers, plus per-seat team subscriptions.

## Architecture & feature detail

Deep notes live under `docs/architecture/`:

- [`features.md`](docs/architecture/features.md) — HARNESS engines, ATLAS J, PFP, Orgs & team-seat subs, Notifications, Sphinx Marketplace, Activity log, Cartridge, Ingestion, Senior badges + Context Craft.
- [`decisions.md`](docs/architecture/decisions.md) — contract-first, auth model, webhook mounting, tier gating, drift exceptions.
- [`gotchas.md`](docs/architecture/gotchas.md) — non-obvious traps that aren't in the top-5 below.
- [`llm-cost-guardrail.md`](docs/architecture/llm-cost-guardrail.md) — operating constraints every new LLM-touching surface must respect (runaway-spend ceiling today, 10% Rule as the next target).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server.
- `pnpm run typecheck` — full typecheck across all packages.
- `pnpm run test` — workspace tests. The api-server provider-switching suite (30 tests, F1 + 9 other engines × 3 providers) replays cached LLM responses from `artifacts/api-server/test/__fixtures__/llm/<provider>/*.json` so it runs in ~15s with no network. Refresh with `pnpm --filter @workspace/api-server run test:live` (sets `RECORD=1`, ~10 min). Cache keys normalise UUIDs / ISO timestamps (`test/llm-cache.ts`). The nightly `nightly-cross-provider.yml` GitHub Action runs `test:live`, diffs fixtures, uploads refreshed ones, and opens a `fixture-drift` issue.
- `pnpm run build` — typecheck + build all packages.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas.
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only).

**Scheduled jobs (Replit Scheduled Deployments).** Two cron endpoints (`POST /api/cron/send-weekly-digest`, `POST /api/cron/reset-harness-limits`) are driven externally via `pnpm --filter @workspace/scripts run cron-tick -- <target>` (`weekly-digest` Mondays 09:00 UTC; `reset-harness-limits` daily 00:00 UTC). The script needs `PUBLIC_BASE_URL` + `CRON_SECRET` and exits non-zero on any failure so a missed tick surfaces in deployment logs. Without `reset-harness-limits` every tier holder locks at their daily cap after 24h.

### Env

- **Required:** `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (auto-provisioned).
- **Stripe pricing:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{PRACTITIONER,ARCHITECT}_{MONTHLY,YEARLY}`, `STRIPE_PRICE_TEAM_SEAT_{MONTHLY,YEARLY}` (per-seat → INSTITUTION, unlimited F8), `STRIPE_PRICE_TEAM_LITE_SEAT_{MONTHLY,YEARLY}` (per-seat → ARCHITECT, 2 F8/day), `STRIPE_PRICE_INGESTION_PROJECT`, `STRIPE_PRICE_CARTRIDGE_PROJECT` ($499.99 one-time).
- **Integrations & ops:** `ANTHROPIC_API_KEY`, `SPHINX_BASE_URL` (without it `/api/integrations/sphinx/publish` returns 503 `SPHINX_NOT_CONFIGURED`), `ADMIN_EMAILS`, `CRON_SECRET`, `RESEND_API_KEY` + `EMAIL_FROM` (falls back to `[email:dry-run]` console log when unset), `SENTRY_DSN` + `VITE_SENTRY_DSN` (no-op when unset), `PUBLIC_BASE_URL`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Clerk (Replit-managed) + Stripe + pino
- DB: PostgreSQL + Drizzle ORM (no RLS — app-layer authorization via `req.localUser.id`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval. Generated Zod schemas are named by operationId (e.g. `CreateSessionBody`).
- Build: esbuild (CJS bundle)
- LLM: Claude Sonnet 4 (`claude-sonnet-4-6`) via `@workspace/integrations-anthropic-ai` (Replit AI Integrations proxy)

## Where things live (index)

- API contract: `lib/api-spec/openapi.yaml` (single source of truth — keep `info.title: Api`)
- Generated Zod / React Query: `lib/api-zod`, `lib/api-client-react`
- DB schema: `lib/db/src/schema/*.ts` (one file per table, re-exported from `schema/index.ts`)
- Express app + middlewares: `artifacts/api-server/src/app.ts`, `src/middlewares/clerkProxyMiddleware.ts`
- Auth bridge (Clerk → local user + subscriber JIT): `artifacts/api-server/src/lib/auth.ts`
- Tier + rate-limit gates: `artifacts/api-server/src/lib/tier.ts`
- Routes: `artifacts/api-server/src/routes/*.ts`
- HARNESS engines: `artifacts/api-server/src/engines/{prompts,shared,f1,f2,f3,f4,f5,f6,f6vdj,f7,f8codedj,atlas-crystallise,pfp}.ts` — see `docs/architecture/features.md` for per-engine notes.
- Front-end command-centre artifact: portal shell + F1–F7 workspaces complete; exemplar library with "Fork to session" CTA shipped.

## Product

A subscription portal where a creator runs a single coherent FORGE.BONSAI session. **The HARNESS itself is a PDD-blueprint application** — its engines are ordered atomic prompts that act as an instruction layer for the model; they are not SPCs and must never be described as such. The artifacts the HARNESS *produces* on behalf of the user are the SPCs and PDDs. Per session: F1 diagnoses a raw prompt → F2 builds an Atomic Prompt → F3 grows a CELL Micro Agent Birth Package → F4 converts to a Micro PDD → F5 builds a full SPC → F6 drafts a 4-Part ATLAS PDD (+ VIBE DJ recommendation) → F7 compresses to a SPARTAN-certified MVP PDD with a public verification URL. F8 Code DJ (Architect+) then scaffolds a runnable codebase from the certified spec.

## Terminology — IPDD vs PWDD (must hold across UI + docs)

The bare term "PDD" was overloaded: it meant both the human-authored INPUT to the INGESTION ENGINE **and** appeared as a suffix on the HARNESS-produced OUTPUTS. The **INPUT** is now formally named **IPDD**; the qualified OUTPUT names are unchanged.

- **IPDD = INPUT.** "Ingestion Product Design Document" — what the user already has (PDD, SDD, concept note, spec sheet, brief). What the INGESTION ENGINE consumes; never what the HARNESS produces.
- **PWDD = OUTPUT.** "PromptWare Design Document" — the HARNESS-certified outcome of a session seeded by ingesting an IPDD. Sessions with `origin='ingested'` produce PWDDs; manual sessions (`origin='manual'`) produce regular MVP-PDDs.
- **Qualified output PDDs are untouched.** "Micro PDD" (F4), "ATLAS PDD" (F6), "MVP PDD" (F7) keep their names — they are always *qualified* by a prefix.
- **Internal enum is untouched.** The `sourceDocKind` Postgres / API enum value `product_design_document` is unchanged. Only the user-facing label moves to "Ingestion Product Design Document (IPDD)".

Ingestion flow, Cartridge details, and per-project billing rules: see [`docs/architecture/features.md`](docs/architecture/features.md).

## User preferences

- Adopted defaults from the kick-off: single `command-centre` artifact serving both `/` landing and `/pricing`, console-log email stub for MVP, admin via Clerk `publicMetadata.role === "admin"` plus `ADMIN_EMAILS` allowlist.
- Original Next.js + Supabase + Sanity + Vercel target was re-platformed onto Express + Drizzle + Postgres + Clerk + Stripe; HARNESS engines built from scratch (no pre-existing ATANDA codebase).

## Top-5 gotchas (always-on)

The complete list is in [`docs/architecture/gotchas.md`](docs/architecture/gotchas.md). These five are the ones that bite most often:

1. **Clerk proxy mounts before body parsers.** Order in `app.ts` matters: `CLERK_PROXY_PATH` → `/api/webhooks/stripe` (raw) → cors → json/urlencoded → `clerkMiddleware` → `/api` routes.
2. **Never call service ports directly.** Always go through `localhost:80` (e.g. `curl localhost:80/api/healthz`), never `localhost:5000`.
3. **Stripe webhook is idempotent.** Event ids land in `stripe_webhook_events` (PK on `event_id`); replays return `{ok:true, replay:true}`. If a handler throws, the idempotency row rolls back so Stripe can legitimately retry.
4. **OpenAPI / generated Zod is operationId-shaped.** Use `CreateSessionBody.safeParse(req.body)`, not `SessionInput`. Never name a component `<OperationIdPascal>Body` or use inline request bodies (TS2308).
5. **PFP `counts` and `verdict` are recomputed server-side** from `findings` before persisting — the model's self-reported numbers are ignored, otherwise contradictory output silently bypasses the F8 drift gate.
6. **Every engine route mounts `requireCostBudget` AFTER `rateLimit`.** Monthly LLM cost cap (live SUM over `harness_engine_runs.cost_usd` for the current UTC month) returns `402 COST_CAP_EXCEEDED` when hit. Tier defaults in `MONTHLY_COST_CAP_USD` (`lib/tier.ts`), per-subscriber override on `subscribers.monthly_cost_cap_usd_override` (admin sets via `PATCH /api/admin/subscribers/:userId/cost-cap`). Adding a new engine route without this middleware leaves a hole in the runaway-spend guard.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See `.local/skills/clerk-auth` for the Clerk integration pattern (must copy the canonical wiring verbatim).
