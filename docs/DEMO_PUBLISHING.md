# Investor-Preview Demo — Publishing Walkthrough

**Audience:** you (the founder), publishing a safe, sample-data version of the ATANDA Command Centre for investor viewing — before any go-live deploy with real billing.

**What investors will see:** the existing landing page, a clear yellow **INVESTOR PREVIEW** banner across every screen, and one obvious CTA — **TAKE THE 7-STAGE TOUR** — leading to the `/demo` page (an 802-line, fully scripted walkthrough of F1 → F7 with pre-baked dummy data, JCSE pillar progression, badges, and the ATLAS / SPARTAN certification beats). Sign-up and Sign-in routes are hidden from the top nav, so investors physically cannot create an account or hit a paywall.

---

## What "demo mode" actually does

When the build env `VITE_DEMO_MODE=true` is set, **at build time** the SPA flips three switches:

| Switch | Behaviour |
|---|---|
| **Landing CTA** | Primary button becomes **TAKE THE 7-STAGE TOUR** → `/demo` (was: **INITIATE SESSION** → `/sign-up`). Secondary button becomes **VIEW PRICING**. |
| **Top nav (signed-out)** | "Sign In" link + "INITIATE" button are removed and replaced with a single **VIEW DEMO** button. Mobile sheet matches. |
| **Home redirect** | `/` always renders `Landing` (no auth-state branch). Direct visits to `/command`, `/sessions`, `/ingest` still ask for auth — investors won't land there from any UI path. |
| **Persistent banner** | Yellow **INVESTOR PREVIEW — sample data, no live billing, no real accounts** strip is rendered above every route, with a "Take the 7-stage tour →" link. |

`BILLING_ENABLED` (in `src/lib/billing-flag.ts`) stays `false` for the investor cut, so the pricing page's CTAs already fall back to `mailto:` access requests — investors cannot accidentally trigger a live Stripe Checkout.

No backend changes. No new tables. The api-server doesn't need to be reachable for the investor experience because the `/demo` page renders entirely from local component state — but it's still running so the rest of the surface (pricing copy, exemplars) works the moment you want to show it.

---

## Before you publish — one-time setup checklist

- [ ] **Set `ACCESS_REQUEST_EMAIL`** in `artifacts/command-centre/src/lib/billing-flag.ts` to a real intake address (currently `access@atanda.example`). Any investor who clicks a pricing CTA will hit `mailto:` with that address pre-filled.
- [ ] Confirm `BILLING_ENABLED = false` in the same file (it is, by default).
- [ ] Confirm `VITE_CLERK_PUBLISHABLE_KEY` is set (auto-provisioned; required even in demo mode because the Clerk provider stays loaded in the background).
- [ ] You do **not** need `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or any `STRIPE_PRICE_*` env for the investor preview. Leave them unset.

---

## Publishing the investor preview (≈ 90 seconds)

1. **Open the Deploy panel** in the Replit workspace (rocket icon in the sidebar, or click the deploy suggestion card in chat).
2. **Choose `Autoscale`.** It scales to zero between investor visits, so there is no idle cost between demos.
3. **Add one secret to the deploy config:**
   - Key: `VITE_DEMO_MODE`
   - Value: `true`
   *(This is a Vite build-time env. The deploy build step picks it up and bakes the demo behaviour into the bundle.)*
4. **Leave all `STRIPE_*` envs blank** for this deploy. Keep:
   - `DATABASE_URL` (auto)
   - `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (auto)
   - Optional: `ADMIN_EMAILS` set to your own email
   - Optional: `SENTRY_DSN` / `VITE_SENTRY_DSN` if you want crash telemetry from the preview
5. **Click Deploy.** Wait ~60 seconds for the build to finish.
6. **Copy the URL** Replit hands you — it will look like `https://<your-app>.replit.app`. **That's the investor link.**

### What to send investors

> *"Here's a private preview of the ATANDA Command Centre — `https://<your-app>.replit.app`. Click 'Take the 7-stage tour' on the landing page for the full F1 → F7 walkthrough; the banner makes it clear this is sample data."*

That's it. No login. No setup on their side. Mobile-friendly.

---

## Demo entry points (what to point investors at)

| URL | What it shows |
|---|---|
| `/` | Landing with demo CTA + investor-preview banner |
| `/demo` | The 7-stage scripted tour: F1 diagnose → F2 atomic prompt → F3 CELL MA → F4 micro PDD → F5 SPC → F6 ATLAS PDD → F7 SPARTAN MVP-PDD, with JCSE pillar progression + quest badges unlocking inline |
| `/pricing` | All four pricing surfaces, including the **$199.99 / project** standalone Ingestion card. CTAs route to your `mailto:` intake. |
| `/exemplars` | Public catalogue — no auth required, useful for "here's what real outputs look like" |
| `/verify/PWDD-ATANDA-001` | Public certificate verification endpoint — drop a sample cert id to show the audit-trail story |

---

## Going live with real billing (after investor cycle)

When you're ready to flip the switch from preview to production:

1. **Edit `artifacts/command-centre/src/lib/billing-flag.ts`:** change `BILLING_ENABLED` from `false` to `true`. Commit.
2. **In the Deploy panel, change one secret:** set `VITE_DEMO_MODE` to `false` (or delete the secret entirely).
3. **Add all production Stripe secrets:**
   - `STRIPE_SECRET_KEY` (live mode key)
   - `STRIPE_WEBHOOK_SECRET` (matching the webhook you'll register in Stripe Dashboard)
   - `STRIPE_PRICE_PRACTITIONER_MONTHLY`, `STRIPE_PRICE_PRACTITIONER_YEARLY`
   - `STRIPE_PRICE_ARCHITECT_MONTHLY`, `STRIPE_PRICE_ARCHITECT_YEARLY`
   - **`STRIPE_PRICE_INGESTION_PROJECT`** — point at a **$199.99 one-time** price id you've created in Stripe for the per-project Ingestion credit
4. **Register the Stripe webhook** in the Stripe Dashboard → Developers → Webhooks → endpoint URL `https://<your-app>.replit.app/api/webhooks/stripe`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. **Optional but recommended for transactional email:** `RESEND_API_KEY` + `EMAIL_FROM`.
6. **Click Deploy again.** Same URL, live billing on, demo banner gone, sign-in restored.

---

## Rollback / dry-run safeguards

- The investor preview and the go-live cut **share the same URL**, so investor bookmarks keep working post-launch.
- If you ever need to drop investors back into the preview during go-live (e.g. for a press demo), just toggle `VITE_DEMO_MODE` back to `true` in the deploy config and redeploy. The bundle rebuilds with all demo behaviour restored in ~60 seconds.
- Every Replit checkpoint is a clean rollback target; the last green checkpoints with all of this wired are listed in your chat sidebar.

---

## Verifying the preview looks right (60-second self-check before you send the link)

Visit your `https://<your-app>.replit.app` URL and confirm:

- [ ] Yellow **INVESTOR PREVIEW** banner across the top of every page
- [ ] Landing primary CTA reads **TAKE THE 7-STAGE TOUR**, not **INITIATE SESSION**
- [ ] Top-right shows **VIEW DEMO** — no "Sign In", no "INITIATE"
- [ ] `/demo` loads and lets you click through all 7 stages without errors
- [ ] `/pricing` shows four tiers (Explorer / Practitioner / Architect + the **$199.99 / project** standalone Ingestion card) and CTAs open a `mailto:` window pointed at your `ACCESS_REQUEST_EMAIL`
- [ ] Trying to type `/command` in the URL bar redirects you to the Clerk sign-in screen (proves the real product is protected, the preview is sample-only)

If any of those fail, the most likely cause is that `VITE_DEMO_MODE=true` didn't make it into the build env — check the deploy config and redeploy.
