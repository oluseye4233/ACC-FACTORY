# ATANDA Command Centre

A re-platform of the ATANDA Command Centre MVP onto this pnpm monorepo: an **internal staff back-end ops platform** in front of the FORGE.BONSAI HARNESS — itself a **PDD blueprint application**, not an SPC. The HARNESS is the instruction layer: a sequence of atomic prompts (F1–F7 + F6-VDJ, plus the DE-SPC synthesiser, the ATLAS J side-step, and the PFP drift detector) that drives the LLM through a deterministic prompt → SPC → PDD → certified MVP-PDD pipeline for each user session.

**Access model — internal staff tool.** The front door is one shared `STAFF_ACCESS_CODE` + a typed name/initials (attribution only). Every code-authenticated staff member gets full access (all engines, all previously subscription-gated features). One company-wide monthly LLM cost cap (`STAFF_MONTHLY_COST_CAP_USD`) replaces per-tier caps.

**Subscriptions are a deferred B-level upgrade, not deleted.** Clerk auth, Stripe tiers, per-seat orgs, per-project credits, and F1000 remain fully coded and tested but dormant behind `SUBSCRIPTIONS_ENABLED` (default `false`). Flip it to `true` to re-activate the public `/pricing` + Stripe-billed subscription SaaS with no code changes. See [`decisions.md`](docs/architecture/decisions.md) → "Internal staff tool vs. subscription SaaS".

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
- `pnpm --filter @workspace/scripts run sync-github` — mirror new local commits to GitHub (`oluseye4233/ACC-FACTORY@main`). Runs **automatically**: after every task merge (`scripts/post-merge.sh`) and every 10 minutes via the always-on `GitHub Sync` workflow, so no manual invocation is normally needed. Incremental one-commit-per-sync via the GitHub Data API (never force-pushes; resumes from the `Replit-Commit:` trailer stamped on the remote head). `.github/workflows/*` is intentionally excluded — the connector OAuth token lacks the `workflow` scope and GitHub rejects pushes touching those files; update Actions files on GitHub directly if needed. If the trailer is ever missing (fresh repo / manual remote commits rewrote it away), run once with `-- --base=<local sha matching the remote tree>`.
- `pnpm --filter @workspace/scripts run cleanup-test-cost-data` — janitor for orphaned test-fixture rows in the shared dev DB (killed/crashed test runs leave `harness_engine_runs` cost rows behind that inflate the live dev app's company-wide spend SUM). Deletes only users with `@example.test` emails (reserved TLD — never a real person) created more than 60 minutes ago (`--min-age-minutes=N` to change), so a mid-flight suite is never raced; runs cascade-delete with the user. `--dry-run` reports without deleting. The query logic lives in `@workspace/db` (`lib/db/src/test-fixture-janitor.ts`) and is ALSO run automatically: at test bootstrap (vitest globalSetup), after merges (`scripts/post-merge.sh`), and every 15 minutes inside the dev API server process (`artifacts/api-server/src/lib/test-fixture-sweeper.ts`, no-op when `NODE_ENV=production`) — so stale fixture spend is reclaimed even when nobody runs tests.
- **DB schema sync (canonical): `pnpm --filter @workspace/db run generate && pnpm --filter @workspace/db run migrate`.** `generate` writes a SQL migration under `lib/db/migrations/` from the diff between `src/schema/*` and the last snapshot; `migrate` applies pending migrations non-interactively and never truncates. This is the single command that keeps the dev/test DB matching the committed schema. Commit the generated `migrations/*.sql` + `migrations/meta/*` alongside the schema change. Adopting migrations replaced `drizzle-kit push` because `push` prompts to TRUNCATE when adding a `.unique()`/NOT NULL to a populated table (fails in non-TTY, drifts the DB). `push`/`push-force` remain only for throwaway prototyping against an empty DB — do not use them to sync the shared dev/test DB. On a pre-existing DB that predates migrations, the baseline (`0000_*`) is marked already-applied in `drizzle.__drizzle_migrations` so `migrate` runs only the newer diffs; a fresh empty DB runs every migration from `0000`. **Post-merge sync (dev): `scripts/post-merge.sh` runs `pnpm --filter @workspace/db run migrate`** (never `push` — `push` would hit the truncate prompt on EOF since stdin is closed post-merge, which is what previously silently drifted dev). **Production sync: re-Publish.** Prod schema is applied ONLY by Replit's Publish flow, which diffs the (now-current) dev DB against prod and applies the additive SQL non-interactively — no truncate prompt because it is not `drizzle-kit push`. Never run DDL directly against prod, never add a deploy-build/startup DDL hook. So the unique-constraint-on-a-populated-table trap is fully avoided end to end: dev via `migrate`, prod via Publish.

**Scheduled jobs (Replit Scheduled Deployments).** Four cron endpoints (`POST /api/cron/send-weekly-digest`, `POST /api/cron/reset-harness-limits`, `POST /api/cron/run-f0-monitoring`, `POST /api/cron/sweep-cost-cap-alerts`) are driven externally via `pnpm --filter @workspace/scripts run cron-tick -- <target>` (`weekly-digest` Mondays 09:00 UTC; `reset-harness-limits` daily 00:00 UTC; `run-f0-monitoring` weekly, e.g. Mondays 08:00 UTC; `sweep-cost-cap-alerts` every 15 minutes, `*/15 * * * *`). The script needs `PUBLIC_BASE_URL` + `CRON_SECRET` and exits non-zero on any failure so a missed tick surfaces in deployment logs. **The autoscale deployment must be published with Public visibility** — a Private deployment's Replit auth wall 307-redirects external requests, making `/api/cron/*` unreachable; `cron-tick` detects the wall redirect and fails with an explicit error. Scheduled Deployments are created by the user in the Publishing tool (one per target, UTC cron expressions: digest `0 9 * * 1`, reset `0 0 * * *`, f0 `0 8 * * 1`, cost-cap sweep `*/15 * * * *`) — see `docs/ATANDA_Command_Centre_MVP_Publish_Ready_v4.md` §5. Without `reset-harness-limits` every tier holder locks at their daily cap after 24h. `run-f0-monitoring` sweeps every ACTIVE F0 retainer, persists a run to `f0_monitoring_runs`, and emails the owner on a breach (any eventAlert urgency ACT_SOON/ACT_NOW); it skips retainers already swept within 6 days and halts LLM spend once the company-wide monthly cost cap is reached. Breaches surface as OPEN alerts (with last-run time) on the F0 dashboard until acknowledged; alert email is gated on the owner's personal-scope `retainerAlertsEnabled` notification preference. **Cron dead-man's-switch:** every successful `/api/cron/*` handler records a heartbeat in `cron_tick_status`; an in-process monitor (`src/lib/cron-heartbeat.ts`, 15-min interval, no-op under vitest) emails `ADMIN_EMAILS` exactly once per stale episode (UNIQUE `(target, stale_since_key)` stamp in `cron_stale_notifications`) when a target misses its window (sweep 60m; reset 48h; digest/f0 14d). Admins see per-target OK/STALE/NEVER-TICKED status at `/admin/ops` (`GET /api/admin/cron-status`).

### Env

- **Required:** `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (auto-provisioned).
- **Stripe pricing:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{PRACTITIONER,ARCHITECT}_{MONTHLY,YEARLY}`, `STRIPE_PRICE_TEAM_SEAT_{MONTHLY,YEARLY}` (per-seat → INSTITUTION, unlimited F8), `STRIPE_PRICE_TEAM_LITE_SEAT_{MONTHLY,YEARLY}` (per-seat → ARCHITECT, 2 F8/day), `STRIPE_PRICE_INGESTION_PROJECT`, `STRIPE_PRICE_CARTRIDGE_PROJECT` ($499.99 one-time).
- **ARK-X Hive Gold eligibility (only with `SUBSCRIPTIONS_ENABLED=true`):** `ARK_X_PUBLIC_KEY` (pinned PEM public key; escaped `\n` supported), `ARK_X_PUBLIC_KEY_KID` (required matching JWT `kid`), and optional `ARK_X_ALLOWED_ALGORITHMS` (comma-separated asymmetric algorithms; default `RS256`). ACC verifies the JWT locally and applies its own fixed 50%-off Architect coupon; the ARK subject and ACC account are linked one-to-one, never email-matched. A completed JTI is one-time, but the linked account may redeem a future fresh assertion for resubscription; Stripe checkout uses the JTI as its idempotency key.
- **Customer billing auth safeguard:** this deployment's active `STAFF_ACCESS_CODE` identity synthesizes ADMIN/INSTITUTION staff and is forbidden from every `/billing/*` customer route. The retained Clerk proxy/package is not an active, verified request-auth path. Until a reviewed customer-auth middleware is configured and mounted to resolve a real local customer + subscriber, billing (including ARK-X eligibility) responds `503 CUSTOMER_AUTH_NOT_CONFIGURED`; do not treat `SUBSCRIPTIONS_ENABLED=true` alone as sufficient to enable checkout.
- **Integrations & ops:** `ANTHROPIC_API_KEY`, `SPHINX_BASE_URL` (without it `/api/integrations/sphinx/publish` returns 503 `SPHINX_NOT_CONFIGURED`), `ARK_ONECRAFT_BASE_URL` + `ARK_ONECRAFT_API_KEY` (both required; without them `/api/me/jst/import-from-ark` returns 503 `ARK_NOT_CONFIGURED` — the JST score import that supersedes in-app self-assessment), `ADMIN_EMAILS`, `CRON_SECRET`, `RESEND_API_KEY` + `EMAIL_FROM` (falls back to `[email:dry-run]` console log when unset), `SENTRY_DSN` + `VITE_SENTRY_DSN` (no-op when unset), `PUBLIC_BASE_URL`, `GITHUB_OAUTH_CLIENT_ID` + `GITHUB_OAUTH_CLIENT_SECRET` (both required to enable the one-click "Connect GitHub" OAuth flow; without them the status endpoint reports `oauthAvailable:false` and the UI falls back to pasting a personal access token — the OAuth callback URL to register on the GitHub app is `<PUBLIC_BASE_URL or first REPLIT_DOMAINS>/api/integrations/github/oauth/callback`).
- **Cost-cap grandfather (optional, all UTC dates):** `COST_CAP_GRANDFATHER_UNTIL=YYYY-MM-DD`, `COST_CAP_LEGACY_CUTOFF=YYYY-MM-DD`, `MONTHLY_COST_CAP_LEGACY_{EXPLORER,PRACTITIONER,ARCHITECT,INSTITUTION}` (USD). All three must be set for a subscriber created before the cutoff to keep their legacy cap until the grandfather date. Unset = no grandfather, every subscriber uses the live `MONTHLY_COST_CAP_USD`. See `docs/architecture/llm-cost-guardrail.md → §3.2`.

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
- Ascension Protocol onboarding: `artifacts/api-server/src/lib/ascension.ts` (JST scoring + 13-rung journey composing badges/context-craft/artifacts/engine-runs/orgs), `routes/onboarding.ts` (`/me/jst`, `/me/ascension`, `/me/onboarding/reader-code`), DB `lib/db/src/schema/{jst-assessments,reader-onboarding}.ts`, frontend `pages/ascension.tsx`. *The Atomic Prompt* book is the onboarding spine; rungs are proven by real signals, never self-reported. Reader codes (allowlist in `routes/onboarding.ts`) flip the track to `atomic_prompt_v1`.

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
6. **Every engine route mounts `requireCostBudget` AFTER `rateLimit`.** Monthly LLM cost cap (live SUM over `harness_engine_runs.cost_usd` for the current UTC month) returns `402 COST_CAP_EXCEEDED` when hit. Tier defaults in `MONTHLY_COST_CAP_USD` (`lib/tier.ts`), per-subscriber override on `subscribers.monthly_cost_cap_usd_override` (admin sets via `PATCH /api/admin/subscribers/:userId/cost-cap`). Adding a new engine route without this middleware leaves a hole in the runaway-spend guard. The same gate also fire-and-forgets a one-time admin email (to every `ADMIN_EMAILS` address) the first time company spend crosses 80% / 95% / 100% of `STAFF_MONTHLY_COST_CAP_USD` each UTC month — exactly-once via the UNIQUE `(month, threshold_percent)` stamp in `cost_cap_notifications` (`src/lib/cost-cap-alerts.ts`; the stamp is only written when `ADMIN_EMAILS` is non-empty, so configuring it later still alerts; the dispatcher no-ops under vitest so cap-shrinking suites can't stamp the real month).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See `.local/skills/clerk-auth` for the Clerk integration pattern (must copy the canonical wiring verbatim).
