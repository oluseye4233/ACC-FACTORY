// Generates the ATANDA Command Centre Post-Publish Go-Live guide as a PDF.
// Run with:  node scripts/src/build-golive-guide.mjs
// Output:    docs/ATANDA_Post_Publish_GoLive_Guide.pdf

import { createRequire } from "node:module";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

const OUT_PATH = resolve(repoRoot, "docs/ATANDA_Post_Publish_GoLive_Guide.pdf");
mkdirSync(dirname(OUT_PATH), { recursive: true });

const NAVY = "#0b1d3a";
const ACCENT = "#1f7a8c";
const GREY = "#4b5563";
const LIGHT = "#e5e7eb";
const WARN = "#a05a00";

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "ATANDA Command Centre — Post-Publish Go-Live Guide",
    Author: "ATANDA Command Centre",
    Subject: "Step-by-step walkthrough from clicking Publish to a fully live, production-ready application."
  }
});

doc.pipe(createWriteStream(OUT_PATH));

function hr(color = LIGHT) {
  const y = doc.y + 6;
  doc.save().strokeColor(color).lineWidth(1).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke().restore();
  doc.moveDown(0.8);
}

function h1(text) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(text, { align: "left" });
  doc.moveDown(0.3);
}

function h2(text) {
  if (doc.y > doc.page.height - 200) doc.addPage();
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(text);
  doc.moveDown(0.2);
}

function h3(text) {
  if (doc.y > doc.page.height - 150) doc.addPage();
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(text.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.15);
}

function p(text) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11).text(text, { align: "left", lineGap: 2 });
  doc.moveDown(0.5);
}

function bullets(items) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11);
  for (const item of items) {
    doc.text(`•  ${item}`, { indent: 8, lineGap: 2, paragraphGap: 3 });
  }
  doc.moveDown(0.4);
}

function steps(items) {
  doc.fillColor(GREY).font("Helvetica").fontSize(11);
  items.forEach((item, i) => {
    doc.text(`${i + 1}.  ${item}`, { indent: 8, lineGap: 2, paragraphGap: 4 });
  });
  doc.moveDown(0.4);
}

function warn(text) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.fillColor(WARN).font("Helvetica-Bold").fontSize(11).text("HEADS UP — " + text, { lineGap: 2 });
  doc.moveDown(0.5);
}

// ---------- COVER ----------
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(34).text("ATANDA", { align: "left" });
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(34).text("Post-Publish Go-Live");
doc.moveDown(0.3);
doc.fillColor(GREY).font("Helvetica").fontSize(16).text("From clicking Publish to a fully live, production-ready application.");
doc.moveDown(0.5);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(11).text("A step-by-step walkthrough — 8 phases, ~30–60 minutes end to end.");
doc.moveDown(2);
hr(ACCENT);

h3("What this document is");
p("This is the operational runbook for taking the ATANDA Command Centre from the moment you press Publish in Replit to the moment you can confidently share the public URL with your first paying customer. It is written for the person doing the launch — not the developer who built it. Every step is concrete: where to click, what to verify, what to do if it goes wrong.");

h3("What you'll do, in eight phases");
bullets([
  "PHASE 1 — Pre-flight checks (15 min). Make sure nothing's still in dev mode.",
  "PHASE 2 — Pick your hosting shape (2 min). Confirm the deployment type and geography.",
  "PHASE 3 — Click Publish & wait for the build (5–10 min).",
  "PHASE 4 — First-load verification on the live URL (5 min).",
  "PHASE 5 — Wire up Stripe to the live URL (10 min).",
  "PHASE 6 — Swap Clerk to production keys & lock down your domain (10 min).",
  "PHASE 7 — Optional: custom domain, transactional email, error monitoring (15 min).",
  "PHASE 8 — Go-live smoke test with a real user (5 min) and post-launch monitoring."
]);

h3("What you'll need before you start");
bullets([
  "A Replit account with a paid plan (Core / Pro / Enterprise — Free can publish but with limitations).",
  "Admin access to your Stripe dashboard.",
  "Admin access to your Clerk tenant (or you're using the Replit-managed Clerk, in which case this is automatic).",
  "A domain name (optional, only if you want a custom URL like commandcentre.yourbrand.com).",
  "About 30–60 minutes of focused time."
]);

// ---------- PHASE 1 ----------
doc.addPage();
h1("Phase 1 — Pre-flight checks");
p("Don't skip these. Every minute you spend here saves an hour of debugging a half-live production app.");

h3("1.1  Confirm the three workflows are running cleanly");
p("Open the Replit workspace and look at the workflows panel. You should see three workflows in the RUNNING state with no error indicators:");
bullets([
  "artifacts/api-server: API Server  →  RUNNING",
  "artifacts/command-centre: web  →  RUNNING",
  "artifacts/mockup-sandbox: Component Preview Server  →  RUNNING (this one stays internal — it's not part of production)"
]);

h3("1.2  Hit the local health endpoint");
p("In the Replit shell, run:");
bullets([
  "curl localhost:80/api/health"
]);
p("You should see JSON containing status: ok, db: ok, engines: ok. If engines reports degraded, the LLM integration env is missing — see Phase 5 of the env checklist below.");

h3("1.3  Walk the public surface in the preview pane");
p("Open the preview pane and click through, looking for any red flags:");
bullets([
  "/  — landing page loads, no console errors.",
  "/pricing  — all four tier cards render with prices.",
  "/exemplars  — the exemplar library lists 9 entries, each with a DISC fingerprint.",
  "Sign in flow — Sign In opens the Clerk modal, signing in lands you in the Command Centre.",
  "/command — once signed in, the F1–F7 workspaces are all reachable."
]);

h3("1.4  Run the full typecheck");
p("In the shell:");
bullets([
  "pnpm run typecheck"
]);
p("Must return zero errors across all four packages. If anything fails, fix it before publishing — broken types often correlate with broken runtime behaviour you haven't hit yet.");

h3("1.5  Confirm the secrets that MUST be present");
p("Open the Secrets pane (lock icon in the left sidebar) and confirm these exist. Do not view their values — just confirm presence.");
bullets([
  "DATABASE_URL  (auto-provisioned)",
  "CLERK_SECRET_KEY  (auto-provisioned by Replit-managed Clerk)",
  "CLERK_PUBLISHABLE_KEY  (auto-provisioned)",
  "VITE_CLERK_PUBLISHABLE_KEY  (auto-provisioned)",
  "SESSION_SECRET",
  "STRIPE_SECRET_KEY  (required if you intend to charge)",
  "STRIPE_WEBHOOK_SECRET  (required if you intend to charge — we'll regenerate this in Phase 5)",
  "STRIPE_PRICE_PRACTITIONER_MONTHLY / _YEARLY",
  "STRIPE_PRICE_ARCHITECT_MONTHLY / _YEARLY"
]);

h3("1.6  Confirm the optional secrets you actually want live");
bullets([
  "RESEND_API_KEY + EMAIL_FROM — if you want real welcome/receipt/goodbye emails. Without these, emails go to the server log as '[email:dry-run]'.",
  "SENTRY_DSN + VITE_SENTRY_DSN — if you want production error tracking. Without these, errors are visible only in deployment logs.",
  "PUBLIC_BASE_URL — set this to your final production URL (e.g. https://command-centre.yourbrand.com or your *.replit.app URL) so the certificate verify URLs in outgoing emails are absolute.",
  "ADMIN_EMAILS — comma-separated list of email addresses that should automatically get admin role.",
  "CRON_SECRET — required only if you'll be calling /api/cron/reset-harness-limits externally."
]);

warn("Anything you add to Secrets now becomes part of the very next build. If you add a secret after clicking Publish, you must re-publish for it to take effect.");

// ---------- PHASE 2 ----------
doc.addPage();
h1("Phase 2 — Pick your hosting shape");

h3("2.1  Deployment target — already chosen for you");
p("This project is configured as an autoscale deployment. That's the right choice: it's a stateless web + API that scales up on traffic and scales to zero when idle, so you pay only for what gets used. You do not need to change this.");

h3("2.2  Pick your publishing geography (FIRST PUBLISH ONLY)");
warn("Geography is permanent. Once you publish to a region, you cannot change it. Pick deliberately.");
bullets([
  "If your users are mostly in the Americas → keep the default (North America).",
  "If your users are mostly in Europe → choose a European region for lower latency and easier GDPR posture.",
  "If your users are mostly in APAC → choose an Asia-Pacific region.",
  "If your plan is Free, you can only publish to North America. Upgrade first if geography matters to you."
]);
p("You'll set this in the Advanced section of the Publishing dialog before clicking the Publish button in Phase 3.");

h3("2.3  Confirm production visibility");
p("In the same Advanced section, you'll see a visibility toggle. For a real product launch this should be Public. The other options (Private, Password-protected) are for staging and previews.");

// ---------- PHASE 3 ----------
doc.addPage();
h1("Phase 3 — Click Publish & wait for the build");

h3("3.1  Open the Publishing dialog");
p("Top right of the Replit workspace, click the Publish button. The Publishing tool slides open from the right.");

h3("3.2  Review the summary screen");
p("Replit shows you a one-page summary of what's about to deploy:");
bullets([
  "Deployment type: autoscale (confirm).",
  "Region: the geography you chose in Phase 2.",
  "Build command and run command: pre-filled from each artifact.toml — leave these alone.",
  "Cost estimate: a small monthly minimum plus per-request usage. Read it; click through."
]);

h3("3.3  Press Publish");
p("Once you confirm, Replit:");
steps([
  "Snapshots your repo at the current commit.",
  "Spins up a clean build container with the same Node 24 + pnpm runtime.",
  "Runs the root-level build, then each artifact's build command.",
  "Provisions a production database (separate from your dev DB — your dev data does NOT come with you).",
  "Mints a production *.replit.app URL.",
  "Starts the production container and waits for the health check to pass.",
  "Flips the URL to live."
]);
p("Expected duration: 5–10 minutes for a clean build. You can watch progress in the Publishing pane.");

h3("3.4  If the build fails");
bullets([
  "Click 'View build logs' in the Publishing pane.",
  "The most common failure is a missing secret (the build will say so explicitly).",
  "The second most common is a TypeScript error that snuck in since your last local typecheck — re-run pnpm run typecheck and fix.",
  "Fix the root cause, commit, and click Publish again. Replit re-uses your published URL on every subsequent publish — you do not get a new URL every time."
]);

// ---------- PHASE 4 ----------
doc.addPage();
h1("Phase 4 — First-load verification on the live URL");

h3("4.1  Open the live URL");
p("From the Publishing pane, copy the production URL (looks like https://your-repl-name.replit.app or whatever subdomain Replit assigned). Open it in a fresh browser window — ideally a private/incognito window so no dev cookies leak through.");

h3("4.2  Hit the production health endpoint");
p("In a terminal:");
bullets([
  "curl https://YOUR-LIVE-URL/api/health"
]);
p("Expected response: { status: 'ok', db: 'ok', engines: 'ok', version: '...' }. If engines is degraded on production, your AI Integrations proxy env didn't come through — fix and re-publish.");

h3("4.3  Walk the public surface");
p("Same checklist as Phase 1.3, but on the live URL:");
bullets([
  "/  — landing renders.",
  "/pricing  — tier cards render with the correct prices.",
  "/exemplars  — exemplar library lists all 9 entries.",
  "Sign Up — create a brand-new test account using a real email you control. Confirm the verification email arrives.",
  "Sign In with that test account, land in the Command Centre, run an F1 against a throwaway prompt. It should return a diagnosis."
]);

h3("4.4  Confirm Clerk is on production keys, not dev keys");
p("Open the browser developer console. If you see the warning 'Clerk has been loaded with development keys', the Clerk swap did not happen automatically. Fix this in Phase 6.");

warn("Do NOT plug in real Stripe credit-card numbers yet. Phase 5 wires the webhook first — without it, a real purchase would charge the card but not record the subscription locally.");

// ---------- PHASE 5 ----------
doc.addPage();
h1("Phase 5 — Wire Stripe to the live URL");

h3("5.1  Why this is a separate phase");
p("Stripe knows your test webhook URL (localhost via Stripe CLI, or a *.replit.dev preview URL). On publish, the production URL is new — Stripe doesn't know about it yet. Until you tell Stripe, your first real customer's payment will succeed at Stripe but will never reach your app, leaving them charged and unprovisioned.");

h3("5.2  Add the production webhook endpoint in Stripe");
steps([
  "Log in to the Stripe dashboard (use Live mode, not Test mode).",
  "Navigate to Developers → Webhooks → Add endpoint.",
  "Endpoint URL: https://YOUR-LIVE-URL/api/webhooks/stripe",
  "Events to send — select these six: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed.",
  "Click 'Add endpoint'. Stripe creates the endpoint and shows you a Signing secret (starts with whsec_...).",
  "Copy that signing secret."
]);

h3("5.3  Put the signing secret into Replit Secrets");
steps([
  "In the Replit workspace, open the Secrets pane.",
  "Find STRIPE_WEBHOOK_SECRET. If it currently holds your test webhook secret, replace it with the production whsec_... you just copied.",
  "Click Save.",
  "Re-publish (Publish button → Publish). The new secret is picked up on the next deploy."
]);

h3("5.4  Confirm Stripe price IDs match LIVE mode");
warn("STRIPE_PRICE_* values in dev are usually TEST-mode price IDs. They will not exist in Stripe LIVE mode and any subscription attempt will fail with 'unknown price'.");
steps([
  "In Stripe (LIVE mode), go to Products. For each tier (Practitioner Monthly, Practitioner Yearly, Architect Monthly, Architect Yearly), copy the LIVE price ID (starts with price_...).",
  "In Replit Secrets, update STRIPE_PRICE_PRACTITIONER_MONTHLY, _PRACTITIONER_YEARLY, _ARCHITECT_MONTHLY, _ARCHITECT_YEARLY with the LIVE price IDs.",
  "Re-publish."
]);

h3("5.5  Send a test event");
steps([
  "Back in Stripe → Webhooks → your endpoint → 'Send test webhook'.",
  "Choose checkout.session.completed.",
  "Click Send. Watch the dashboard — it should show a 200 response from your endpoint.",
  "If it returns 400 'signature mismatch' → your STRIPE_WEBHOOK_SECRET is wrong; re-copy from Stripe and re-publish.",
  "If it returns 502 → check deployment logs; the app may be crashing on receipt."
]);

// ---------- PHASE 6 ----------
doc.addPage();
h1("Phase 6 — Swap Clerk to production keys & lock down your domain");

h3("6.1  Replit-managed Clerk: usually automatic");
p("If you're using the Replit-managed Clerk integration (the default for this project), the dev-to-prod key swap happens automatically when you publish. Open your live URL and look at the browser console — if there's no 'development keys' warning, you're done with Clerk. Skip to 6.4.");

h3("6.2  If the dev-keys warning is still showing on the live URL");
steps([
  "Open the Clerk dashboard (linked from the Replit Integrations pane).",
  "Confirm you have a Production instance, not just a Development instance.",
  "In the Production instance, go to API Keys and copy the Publishable Key (pk_live_...) and Secret Key (sk_live_...).",
  "In Replit Secrets, set CLERK_PUBLISHABLE_KEY = pk_live_..., VITE_CLERK_PUBLISHABLE_KEY = pk_live_..., and CLERK_SECRET_KEY = sk_live_...",
  "Re-publish.",
  "Hard-refresh the live URL. The dev-keys warning should be gone."
]);

h3("6.3  Add the live domain to Clerk's allowed origins");
steps([
  "In the Clerk dashboard (Production instance) → Paths → Domains.",
  "Add your *.replit.app URL (and your custom domain if you set one up in Phase 7).",
  "Save."
]);

h3("6.4  Lock down which OAuth providers are enabled");
p("In the Clerk dashboard → User & Authentication → Social Connections, confirm only the providers you actually want are enabled (Google, GitHub, etc.). Disable any provider you don't intend to support — leaving extras on creates needless attack surface and confusing UX.");

h3("6.5  Set your admin allowlist");
bullets([
  "In Replit Secrets, add ADMIN_EMAILS = your-email@example.com,co-founder@example.com (comma-separated, no spaces).",
  "Re-publish.",
  "Sign in once with your admin email — you'll be JIT-provisioned with admin role on first login."
]);

// ---------- PHASE 7 ----------
doc.addPage();
h1("Phase 7 — Optional polish");

h3("7.1  Connect a custom domain");
p("If you want to launch at commandcentre.yourbrand.com instead of *.replit.app:");
steps([
  "In the Publishing pane, click the Custom domains section.",
  "Enter your domain. Replit shows you a CNAME or A record to create at your DNS provider.",
  "In your DNS provider (Cloudflare, Route 53, Namecheap, etc.), create the record exactly as shown.",
  "Wait for propagation — usually 1–10 minutes, sometimes up to an hour.",
  "Replit auto-provisions a TLS certificate via Let's Encrypt as soon as the record resolves. You'll see a green checkmark when it's live.",
  "Update PUBLIC_BASE_URL in Replit Secrets to the new domain, then re-publish.",
  "Update the Stripe webhook endpoint URL (Phase 5.2) and the Clerk allowed origins (Phase 6.3) to use the new domain."
]);

h3("7.2  Turn on real transactional email (Resend)");
steps([
  "Sign up at resend.com and verify the sending domain you'll use (e.g. yourbrand.com).",
  "Create an API key with sending permission.",
  "In Replit Secrets, add RESEND_API_KEY = re_... and EMAIL_FROM = 'ATANDA Command Centre <noreply@yourbrand.com>'.",
  "Re-publish.",
  "Test by signing up a new account — the welcome email should arrive within seconds. If not, check deployment logs for any '[email:dry-run]' lines (means the secrets didn't load) or for Resend API errors."
]);

h3("7.3  Turn on error tracking (Sentry)");
steps([
  "Sign up at sentry.io and create two projects: 'atanda-api' (Node) and 'atanda-web' (React).",
  "Copy the DSN from each.",
  "In Replit Secrets, set SENTRY_DSN = <api-dsn> and VITE_SENTRY_DSN = <web-dsn>.",
  "Re-publish.",
  "Force a test error: visit https://YOUR-LIVE-URL/api/healthz?force_500=true (if you've added a debug route) or just trigger a deliberate 404. Within a minute it should appear in Sentry."
]);

h3("7.4  Schedule the daily rate-limit reset");
p("The HARNESS uses per-day per-engine rate limits stored on the subscriber row. There's a guarded endpoint, /api/cron/reset-harness-limits, that resets these counters. You need something to call it once per day.");
steps([
  "In Replit Secrets, set CRON_SECRET to a long random string.",
  "Re-publish.",
  "Set up a cron caller — easiest options: cron-job.org (free), GitHub Actions on a schedule, or Replit's own Scheduled Deployments.",
  "Schedule: 0 0 * * * UTC (midnight).",
  "Request: POST https://YOUR-LIVE-URL/api/cron/reset-harness-limits with header 'x-cron-secret: <your-CRON_SECRET>'.",
  "Expected response: 200 with a count of rows reset."
]);

// ---------- PHASE 8 ----------
doc.addPage();
h1("Phase 8 — Go-live smoke test & monitoring");

h3("8.1  Real-user smoke test");
p("Pretend to be a brand-new customer. Use a fresh email, a fresh browser profile, and run this exact flow end-to-end:");
steps([
  "Open the public landing page.",
  "Click Pricing → choose Practitioner Monthly → Subscribe.",
  "Complete Stripe Checkout with a REAL card (you'll cancel and refund yourself in step 8 below).",
  "Land back on the Command Centre. Confirm your tier shows as PRACTITIONER.",
  "Open the Account page → confirm Stripe subscription is recorded.",
  "Run a complete F1 → F2 → F3 → F4 → F5 → F6 → F7 flow on a real prompt.",
  "Confirm the F7 verification URL is reachable in an incognito tab — share it with yourself and click it.",
  "Cancel the subscription from the Billing page. Confirm cancellation reflects in Stripe within a minute.",
  "Refund the test charge in the Stripe dashboard."
]);

h3("8.2  Hook up uptime monitoring");
bullets([
  "Use any of: UptimeRobot (free), BetterUptime, Pingdom, healthchecks.io.",
  "Monitor URL: https://YOUR-LIVE-URL/api/health (returns JSON with status: ok). Check every 5 minutes. Alert on non-200 or on body not containing 'ok'.",
  "Add a second monitor on /  for the landing page."
]);

h3("8.3  Set your alerting addresses");
bullets([
  "Stripe → Settings → Notifications: turn ON 'Failed payments', 'Disputes', and 'Webhook delivery failures'. Send to a real on-call inbox.",
  "Sentry → Project Settings → Alerts: at minimum, set a rule for 'first error of a new issue' and 'error rate > 1% for 5 minutes'.",
  "Clerk → Dashboard → Notifications: turn on 'Unusual sign-in activity' alerts."
]);

h3("8.4  Bookmark these URLs");
bullets([
  "https://YOUR-LIVE-URL/  — public landing",
  "https://YOUR-LIVE-URL/api/health  — production health",
  "Replit Publishing pane — to re-publish or check build status",
  "Stripe Dashboard (LIVE mode) — payments, subscriptions, webhooks",
  "Clerk Dashboard (Production instance) — users, sign-in logs",
  "Sentry — runtime errors",
  "Your uptime monitor dashboard"
]);

// ---------- ROLLBACK & TROUBLESHOOTING ----------
doc.addPage();
h2("If something goes wrong after launch");

h3("Roll back to the previous good build");
p("Replit retains your previous successful builds. In the Publishing pane, the deployment history shows every prior build. Click the three-dot menu on the last known-good build → 'Promote to current'. The live URL switches back to that build within a minute. Use this BEFORE attempting a code fix if the live site is down — get back to green first, then debug.");

h3("If the database is misbehaving");
p("Production has a separate database from dev. To inspect it, use the Replit database tools in production mode (see the database skill). Do NOT manually edit production data unless you absolutely have to — every change is unrecoverable.");

h3("If a deploy is half-stuck");
bullets([
  "Check the Publishing pane → Build logs for the most recent attempt.",
  "If the build succeeded but the container is failing the health check, look at the deployment runtime logs (fetchable from the workspace).",
  "Most-common cause: a missing or mis-named env var. The app starts but crashes the moment it tries to read it. The fix is always: add/correct the secret, re-publish."
]);

h3("If a user can't sign in");
bullets([
  "Confirm they're not still hitting a stale browser cache — try in an incognito window.",
  "Check the Clerk dashboard → their user record exists and isn't blocked.",
  "If Clerk says they exist but our app returns 401 → the JIT user sync is failing. Look in deployment logs for 'ClerkIdentityNotFoundError' or 'ensureLocalUser' errors."
]);

h3("If Stripe payments succeed but subscriptions don't appear");
bullets([
  "Stripe dashboard → Webhooks → check the delivery log for your endpoint.",
  "If it shows 4xx or 5xx → click the failed event → 'Resend'. Fix the underlying cause first (almost always wrong signing secret or wrong price ID).",
  "If Stripe shows 200 but the user still has no tier → check deployment logs for 'UnknownPriceError' — that means a price ID exists in Stripe but is not in your STRIPE_PRICE_* env vars. Add it and re-publish."
]);

// ---------- CLOSING ----------
doc.addPage();
h2("Launch-day checklist (one page, all of it)");
bullets([
  "[ ]  All three workflows running clean, no errors.",
  "[ ]  pnpm run typecheck passes.",
  "[ ]  /api/health returns ok / ok / ok locally.",
  "[ ]  All required secrets present in Replit Secrets.",
  "[ ]  Geography chosen (first publish only — permanent).",
  "[ ]  Publish clicked. Build succeeded. Live URL responds 200.",
  "[ ]  /api/health on live URL returns ok / ok / ok.",
  "[ ]  Sign up + sign in works end-to-end on the live URL.",
  "[ ]  Browser console shows NO 'Clerk dev keys' warning.",
  "[ ]  Stripe webhook endpoint added in LIVE mode, signing secret in env, test event returns 200.",
  "[ ]  Stripe LIVE-mode price IDs in env (not test-mode).",
  "[ ]  Clerk Production keys in env, live domain added to allowed origins.",
  "[ ]  Admin email allowlist set, admin role confirmed on first admin sign-in.",
  "[ ]  (Optional) Custom domain live with green TLS cert; PUBLIC_BASE_URL updated.",
  "[ ]  (Optional) Resend keys in env; welcome email delivered to a test signup.",
  "[ ]  (Optional) Sentry DSNs in env; a forced error appears in Sentry.",
  "[ ]  (Optional) Daily cron caller scheduled for /api/cron/reset-harness-limits.",
  "[ ]  Real-card smoke test: subscribe → use → cancel → refund. All four steps clean.",
  "[ ]  Uptime monitor green on /api/health and /.",
  "[ ]  Alerting addresses set on Stripe, Sentry, Clerk."
]);

doc.moveDown(0.5);
hr(ACCENT);
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(9).text(
  `Generated ${new Date().toISOString().slice(0, 10)} · ATANDA Command Centre · Post-Publish Go-Live Guide`,
  { align: "center" }
);

doc.end();
console.log(`Wrote ${OUT_PATH}`);
