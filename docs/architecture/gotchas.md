# Gotchas

Non-obvious traps. The top-5 most-frequently-relevant ones stay inline in `replit.md`; everything else lives here.

## OpenAPI / codegen

- **OpenAPI naming.** Never name a component `<OperationIdPascal>Body` or use inline request bodies (causes TS2308). For Zod params that need validation (`minimum`/`maximum`/etc.), Orval will emit them to both `api.ts` and `types/` and collide — keep query-param validators simple or move the constraint server-side.
- **Generated Zod = operationId-shaped.** Use `CreateSessionBody.safeParse(req.body)`, not `SessionInput`. Response shapes have no Zod — return plain objects typed by the TS interface.

## Stripe

- **Stripe webhook is idempotent.** Every event id is recorded in `stripe_webhook_events` (PK on `event_id`) on receipt; replays return `{ok:true, replay:true}` without re-executing handlers. If a handler throws, the idempotency row is rolled back so Stripe can legitimately retry.
- **Unknown Stripe price ids fail loudly.** `applySubscription` throws `UnknownPriceError` → 400, logged with `{priceId, customerId}`. Add new price envs (`STRIPE_PRICE_*`) before launching a new tier.
- **Team-seat price envs must be registered.** Adding any new team-seat price env without registering it in `TEAM_SEAT_PRICE_IDS()` in `routes/stripe-webhook.ts` (which returns a `Map<priceId, 'team'|'team_lite'>`) will silently route org sub events into the personal-tier handler OR mis-classify the plan.

## Engines / telemetry

- **Per-engine telemetry** is written to `harness_engine_runs` on every Claude call via the optional `RunContext` argument to `callClaude`/`callClaudeJson`. Failures here log a warning but never break the request — telemetry is best-effort.
- **DE-SPC** (`engineId=8`, `/api/harness/evolve`) is gated by `requireAuth + requireTier("PRACTITIONER") + requireAspeBadge`. Persist path is `persistArtifact` followed by an `UPDATE` to set `spcOrigin='digitally_evolved'` since `persistArtifact` doesn't accept that field.
- **F8 Code DJ has three distinct numbers on purpose.** `engineId=9` for telemetry, `featureId=8` for the `f8_today` rate-limit column, frontend `ENGINES.id=9` because `id=8` is taken by F6-VDJ. The route is `/api/harness/f8` gated by `requireAuth + requireTier("ARCHITECT") + rateLimit(8)`. Architect cap is 2/day, Institution unlimited, Practitioner/Explorer explicitly 0. F8 refuses any source MVP PDD without a `spartanCert`. F8 is **not** in `feature_states` (it's a side-step like F6-VDJ); the session-detail nav special-cases `engineId > 7` as always `AVAILABLE` and lets the server tier gate be the real authority. The cron reset (`/api/cron/reset-harness-limits`) MUST include `f8Today: 0` — adding a new rate-limited engine without updating that handler permanently locks tier holders after their first day.

## Badges

- **Quest badges are computed live**, not stored. `lib/badges.ts#computeBadgeProgress` re-counts SPCs / MAs / PDDs on every `/me/badges` call. Only AISE persists a row (after URL verification) in `command_centre_badges`.
- **AISE URL verifier blocks private IPs.** `lib/badges.ts#headOk` resolves the hostname and refuses RFC1918 / loopback / link-local / metadata (169.254.169.254) / CGNAT / multicast addresses, and rejects anything that is not `https:`. Do not relax this without a deliberate SSRF review.

## Build / runtime

- **PDFKit needs `@swc/helpers`.** `pdfkit`'s embedded `fontkit` does `require("@swc/helpers/cjs/_define_property.cjs")` from the bundled output, so `@swc/helpers` must be present as a real `dependency` of `@workspace/api-server` — esbuild does not pull it in transitively.
- **Sentry init must run before any other module-side-effect imports** in `app.ts`; both API (`@sentry/node`) and web (`@sentry/react`) gate on DSN env and no-op cleanly in dev. `@opentelemetry/*` is NOT externalized in the esbuild bundle (Sentry needs it bundled into the CJS output).

## Account / identity

- **Account delete is external-first, local-last.** `POST /api/me/delete` order is: cancel Stripe sub (hard-fail 502 if Stripe is unreachable while a `stripeSubscriptionId` exists; benign on Stripe 404/`resource_missing`) → `clerkClient.users.deleteUser` (hard-fail 502 on error) → only then cascade-delete the local `users` row → best-effort goodbye email. Never re-order this — flipping local-first orphans Stripe subs and lets a stale token JIT-recreate a shell user.
- **`ensureLocalUser` is strict on first JIT sync.** It requires a successful `clerkClient.users.getUser` before inserting. Clerk 404 → `ClerkIdentityNotFoundError` → `requireAuth` returns 401. Other Clerk errors → 503 from `requireAuth`. Existing local users short-circuit before the Clerk call, so a Clerk outage does not lock out already-provisioned accounts.
