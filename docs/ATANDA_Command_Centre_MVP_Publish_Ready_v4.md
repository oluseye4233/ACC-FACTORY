# Publish-Ready MVP — ATANDA Command Centre (Go-Live Runbook)

> **Step 3 of the ATLAS → SPARTAN → Publish path.** Takes the SPARTAN-certified MVP
> (`SPRT-AC-CC-CURRENT-2026-004`) and prepares it for publishing. This is the operator's
> go-live runbook, with the host selected by **F8-HDJ (HOST DJ)**: **Replit Deployments —
> Autoscale**.
>
> - **Document ID:** PUB-AC-CC-2026-004
> - **Source MVP:** `docs/ATANDA_Command_Centre_MVP_PDD_SPARTAN_v4_HostDJ.md`
> - **Certified host (HOST DJ primary):** Replit Deployments · Autoscale
> - **Certified host (HOST DJ fallback):** AWS (ECS + RDS + CloudFront) — only if HIPAA/BAA
>   or a hard region SLA is required
> - **Companion:** for the safe sample-data investor cut, see `docs/DEMO_PUBLISHING.md`.

---

## 0. Why Replit Deployments (the HOST DJ call)

The codebase **already targets** Replit's path-routing proxy: the api-server and
command-centre are two artifacts behind one proxy, with Replit-managed Clerk, the AI
Integrations proxy, Postgres, and Stripe all first-class. F8-HDJ's HSE matrix (see the
SPARTAN doc §3) scores **Replit Autoscale highest** for *this* stack — native stack
compatibility, scale-to-zero cost, one-click deploy, managed Postgres. Choosing any other
host means re-platforming, so the certified primary is the one the build already fits.

**Autoscale** is the right deployment type: the app is request-driven (HTTP API + static
SPA), so it scales to zero between traffic and back up on demand. Reserved VM is only
warranted if you later need always-on background work beyond the two scheduled cron ticks.

---

## 1. Pre-flight gate (must be green before you deploy)

Run from the repo root:

```bash
pnpm run typecheck      # full workspace — must be clean
pnpm run test           # workspace tests (cross-provider replay is offline)
pnpm run build          # typecheck + build all packages
```

Smoke the running app through the proxy (never hit service ports directly):

```bash
curl -s localhost:80/api/healthz     # expect 200 / ok
```

Checklist:
- [ ] `pnpm run typecheck` clean across all packages.
- [ ] Test suite green (cached-fixture cross-provider replay passes offline).
- [ ] `build` succeeds for api-server and command-centre.
- [ ] `/api/healthz` returns healthy through `localhost:80`.
- [ ] No `console.log` in server code (use `req.log` / `logger`).

---

## 2. Production environment variables

These are set in the **Deploy** panel's secrets, not committed. Grouped by necessity.

### Required (auto-provisioned by Replit)
- `DATABASE_URL`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`

### Required for live billing
- `STRIPE_SECRET_KEY` (live-mode key)
- `STRIPE_WEBHOOK_SECRET` (matches the webhook you register in step 4)
- `STRIPE_PRICE_PRACTITIONER_MONTHLY`, `STRIPE_PRICE_PRACTITIONER_YEARLY`
- `STRIPE_PRICE_ARCHITECT_MONTHLY`, `STRIPE_PRICE_ARCHITECT_YEARLY`
- `STRIPE_PRICE_TEAM_SEAT_MONTHLY`, `STRIPE_PRICE_TEAM_SEAT_YEARLY` (→ INSTITUTION)
- `STRIPE_PRICE_TEAM_LITE_SEAT_MONTHLY`, `STRIPE_PRICE_TEAM_LITE_SEAT_YEARLY` (→ ARCHITECT)
- `STRIPE_PRICE_INGESTION_PROJECT`, `STRIPE_PRICE_CARTRIDGE_PROJECT` ($499.99 one-time)

### Required for the LLM + cost guard
- `ANTHROPIC_API_KEY` (Claude Sonnet 4 via the AI Integrations proxy)
- (cost cap is on by default via `MONTHLY_COST_CAP_USD` tier defaults; no env needed to
  enable it — only the optional grandfather keys below tune it)

### Ops / required for correct production behaviour
- `PUBLIC_BASE_URL` — used to build the public `/verify?certId=…` URL in cert emails and
  the GitHub OAuth callback URL.
- `CRON_SECRET` — gates the cron endpoints. **Without `reset-harness-limits` every
  tier holder locks at their daily cap after 24h.**
- `ADMIN_EMAILS` — admin allowlist (cost-cap overrides, org/activity admin).
- `SESSION_SECRET` — already set; AES-256-GCM key derivation for stored integration creds.

### Recommended
- `RESEND_API_KEY` + `EMAIL_FROM` — transactional email (cert issued, invites, digests).
  Without them email falls back to a `[email:dry-run]` console log.
- `SENTRY_DSN` + `VITE_SENTRY_DSN` — crash telemetry (no-op when unset).

### Optional integrations (env-gated — absence returns a typed 503, never fabricates)
- `SPHINX_BASE_URL` — F5 → Sphinx publish.
- `ARK_ONECRAFT_BASE_URL` + `ARK_ONECRAFT_API_KEY` — JST score import.
- `GITHUB_OAUTH_CLIENT_ID` + `GITHUB_OAUTH_CLIENT_SECRET` — enables the one-click
  "Connect GitHub" flow for F8 push (without them, users paste a PAT instead). Register
  the callback URL `<PUBLIC_BASE_URL>/api/integrations/github/oauth/callback`.
- Cost-cap grandfather keys (all-or-nothing): `COST_CAP_GRANDFATHER_UNTIL`,
  `COST_CAP_LEGACY_CUTOFF`, `MONTHLY_COST_CAP_LEGACY_{EXPLORER,PRACTITIONER,ARCHITECT,INSTITUTION}`.

---

## 3. Deploy (Autoscale)

1. Open the **Deploy** panel (rocket icon) in the Replit workspace.
2. Choose **Autoscale** (scales to zero between requests).
3. Confirm the build command produces both artifacts and the run command serves them
   behind the shared proxy (each artifact binds the `PORT` the workflow injects — do not
   hard-code ports).
4. Add the production secrets from §2.
5. Click **Deploy** and wait for the build + health check to pass.
6. Copy the `https://<your-app>.replit.app` URL Replit hands you (also present in
   `$REPLIT_DOMAINS`).

---

## 4. Register the Stripe webhook (live)

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**.
2. Endpoint URL: `https://<your-app>.replit.app/api/webhooks/stripe`.
3. Subscribe to at least: `checkout.session.completed`,
   `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`.
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
5. Send a test event — a replay should return `{ok:true, replay:true}` (idempotency net).

---

## 5. Schedule the cron ticks (Scheduled Deployments)

The four cron endpoints are driven externally by
`pnpm --filter @workspace/scripts run cron-tick -- <target>` (needs `PUBLIC_BASE_URL` +
`CRON_SECRET`; exits non-zero on failure so a missed tick surfaces in logs):

- `reset-harness-limits` — **daily 00:00 UTC** (`0 0 * * *`; mandatory; otherwise tiers lock after 24h).
- `weekly-digest` — **Mondays 09:00 UTC** (`0 9 * * 1`).
- `run-f0-monitoring` — **Mondays 08:00 UTC** (`0 8 * * 1`).
- `sweep-cost-cap-alerts` — **every 15 minutes** (`*/15 * * * *`; 30 minutes also fine).
  Production is an autoscale deployment: with zero traffic the instance scales down and
  the server's in-process 15-minute cost-cap sweep cannot fire, so without this tick the
  80/95/100% company-spend threshold emails are only detected on the next request. The
  external tick keeps detection time-bounded even when the app is fully asleep; the
  exactly-once stamp in `cost_cap_notifications` makes the two paths safe to coexist.

Create one Scheduled Deployment per target (Publishing tool → **Scheduled**) with the
matching cron expression (UTC timezone) and the run command above, e.g. for the digest:

```
pnpm --filter @workspace/scripts run cron-tick -- weekly-digest
```

`CRON_SECRET` is already a global Secret; set `PUBLIC_BASE_URL` on each Scheduled
Deployment to the live app URL (e.g. `https://<your-app>.replit.app`).

> **Gotcha — the app must be published with *Public* visibility.** If the autoscale
> deployment is Private, Replit's private-app wall 307-redirects every external request
> (including cron ticks) to a Replit login, so `/api/cron/*` is unreachable and the digest
> never sends. `cron-tick` detects this and fails with an explicit
> "behind Replit's private-app wall" error.

---

## 6. Post-deploy verification (the go-live smoke test)

Against the live `https://<your-app>.replit.app`:

- [ ] Landing + `/pricing` render; tier CTAs open live Stripe Checkout.
- [ ] Sign up via Clerk → a subscriber row is JIT-created; portal opens.
- [ ] A session runs **F1 → F7** and yields a **public `/verify?certId=…`** URL that
      resolves.
- [ ] (Architect) **F8** scaffolds a `CODEBASE_BUNDLE`; **SEND TO IDE** downloads the ZIP
      with `AGENTS.md`; **Push to GitHub** connects (PAT or OAuth) and pushes.
- [ ] `/me/costs` shows the cost meter; an engine call increments month-to-date spend; the
      `402 COST_CAP_EXCEEDED` guard is active on every engine route.
- [ ] Stripe webhook test event acks; a second (replayed) event returns `replay:true`.
- [ ] `reset-harness-limits` cron tick returns success and zeroes the daily counters.
- [ ] Cert-issued email arrives (or logs `[email:dry-run]` if Resend is unset).

**F8-HDJ (HOST DJ) is shipped** — verify it returns a `HOSTING_PLAN` with a scored primary +
fallback host and a deployment journey, and that its SDF env template contains **keys only**
(no values).

---

## 7. Rollback & safeguards

- Every Replit **checkpoint** is a clean rollback target (listed in the chat sidebar).
- A bad deploy: redeploy the previous green build from the Deploy panel's history.
- DB: the cost cap is **fail-open** on a transient DB blip (requests pass, logged warn) so
  a database hiccup never locks out paying users; the per-tier rate limits still apply.
- To drop back to the safe investor preview at any time, follow `docs/DEMO_PUBLISHING.md`
  (`VITE_DEMO_MODE=true`, billing disabled) — same URL, ~60s rebuild.

---

## 8. Go-live definition of done

```
[ ] typecheck + test + build green
[ ] /api/healthz healthy through localhost:80 AND the live domain
[ ] All Required + live-billing envs set; Stripe webhook registered & test-acked
[ ] Both cron Scheduled Deployments created (reset daily, digest weekly)
[ ] F1→F7 produces a resolving public verification URL in production
[ ] F8 scaffolds + hands off (IDE export ZIP and GitHub push) in production
[ ] Cost cap + rate limits enforced on every engine route
[ ] Rollback path confirmed (previous checkpoint + demo-mode fallback)
```

When every box is checked, the MVP is **published and live** on the HOST DJ-certified
host (Replit Deployments · Autoscale).
