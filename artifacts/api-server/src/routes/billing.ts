import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, commandCentreSubscribersTable, type SubscriberTier } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireSubscriptionsEnabled } from "../lib/feature-flags";
import { BillingCheckoutBody, BillingPortalBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../lib/stripe";
import type Stripe from "stripe";

const router: IRouter = Router();

// F1000 soft-launch: a $39-off "forever" coupon turns the $49/mo Practitioner
// plan into $10/mo. Applied ONLY at Practitioner monthly checkout for redeemed
// F1000 members — it is attached to that subscription's discounts, so a later
// Architect upgrade (a separate checkout) is billed at full price.
const F1000_COUPON_ID = "f1000_softlaunch";
const F1000_DISCOUNT_CENTS = 3900;

async function ensureF1000Coupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(F1000_COUPON_ID);
  } catch {
    await stripe.coupons.create({
      id: F1000_COUPON_ID,
      amount_off: F1000_DISCOUNT_CENTS,
      currency: "usd",
      duration: "forever",
      name: "F1000 Soft-Launch ($39 off Practitioner)",
    });
  }
  return F1000_COUPON_ID;
}

function priceIdFor(tier: SubscriberTier, interval: "month" | "year"): string | null {
  const map: Record<string, string | undefined> = {
    PRACTITIONER_month: process.env.STRIPE_PRICE_PRACTITIONER_MONTHLY,
    PRACTITIONER_year: process.env.STRIPE_PRICE_PRACTITIONER_YEARLY,
    ARCHITECT_month: process.env.STRIPE_PRICE_ARCHITECT_MONTHLY,
    ARCHITECT_year: process.env.STRIPE_PRICE_ARCHITECT_YEARLY,
  };
  return map[`${tier}_${interval}`] ?? null;
}

router.post("/billing/checkout", requireAuth, requireSubscriptionsEnabled, async (req, res): Promise<void> => {
  const parsed = BillingCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.tier === "EXPLORER") {
    res.status(400).json({ error: "Explorer tier is free; no checkout required" });
    return;
  }
  if (parsed.data.tier === "INSTITUTION") {
    res.status(400).json({ error: "Institution tier is sales-led; contact us" });
    return;
  }
  const priceId = priceIdFor(parsed.data.tier, parsed.data.interval);
  if (!priceId) {
    res
      .status(503)
      .json({ error: `Stripe price not configured for ${parsed.data.tier}/${parsed.data.interval}` });
    return;
  }

  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");

  let customerId = req.subscriber!.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.localUser!.email ?? undefined,
      metadata: { localUserId: req.localUser!.id, clerkUserId: req.clerkUserId! },
    });
    customerId = customer.id;
    await db
      .update(commandCentreSubscribersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(commandCentreSubscribersTable.id, req.subscriber!.id));
  }

  // F1000 promo: redeemed members get the $39-off coupon on the monthly
  // Practitioner plan ($49 -> $10/mo). Not applied to yearly or any other tier.
  let discounts: { coupon: string }[] | undefined;
  if (
    req.subscriber!.f1000Member &&
    parsed.data.tier === "PRACTITIONER" &&
    parsed.data.interval === "month"
  ) {
    discounts = [{ coupon: await ensureF1000Coupon(stripe) }];
  }

  // First-time subscribers get a 30-day free trial on any paid plan.
  const alreadySubscribedBefore = Boolean(req.subscriber!.stripeSubscriptionId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    discounts,
    subscription_data: alreadySubscribedBefore
      ? undefined
      : { trial_period_days: 30 },
    success_url: parsed.data.successUrl ?? `${origin}/billing?status=success`,
    cancel_url: parsed.data.cancelUrl ?? `${origin}/pricing?status=cancel`,
    metadata: { localUserId: req.localUser!.id, tier: parsed.data.tier },
  });
  res.json({ url: session.url ?? "" });
});

router.post("/billing/ingestion/checkout", requireAuth, requireSubscriptionsEnabled, async (req, res): Promise<void> => {
  const priceId = process.env.STRIPE_PRICE_INGESTION_PROJECT;
  if (!priceId) {
    res.status(503).json({
      error: "Ingestion project credit price not configured (set STRIPE_PRICE_INGESTION_PROJECT)",
    });
    return;
  }

  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  const successUrl =
    typeof req.body?.successUrl === "string" ? req.body.successUrl : null;
  const cancelUrl =
    typeof req.body?.cancelUrl === "string" ? req.body.cancelUrl : null;

  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");

  let customerId = req.subscriber!.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.localUser!.email ?? undefined,
      metadata: { localUserId: req.localUser!.id, clerkUserId: req.clerkUserId! },
    });
    customerId = customer.id;
    await db
      .update(commandCentreSubscribersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(commandCentreSubscribersTable.id, req.subscriber!.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_intent_data: {
      metadata: {
        kind: "ingestion_credit",
        localUserId: req.localUser!.id,
      },
    },
    success_url: successUrl ?? `${origin}/ingest?status=credit_purchased`,
    cancel_url: cancelUrl ?? `${origin}/ingest?status=cancel`,
    metadata: {
      kind: "ingestion_credit",
      localUserId: req.localUser!.id,
    },
  });
  res.json({ url: session.url ?? "" });
});

router.post("/billing/cartridge/checkout", requireAuth, requireSubscriptionsEnabled, async (req, res): Promise<void> => {
  const priceId = process.env.STRIPE_PRICE_CARTRIDGE_PROJECT;
  if (!priceId) {
    res.status(503).json({
      error: "Cartridge project price not configured (set STRIPE_PRICE_CARTRIDGE_PROJECT)",
    });
    return;
  }
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }
  const successUrl =
    typeof req.body?.successUrl === "string" ? req.body.successUrl : null;
  const cancelUrl =
    typeof req.body?.cancelUrl === "string" ? req.body.cancelUrl : null;
  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");
  let customerId = req.subscriber!.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.localUser!.email ?? undefined,
      metadata: { localUserId: req.localUser!.id, clerkUserId: req.clerkUserId! },
    });
    customerId = customer.id;
    await db
      .update(commandCentreSubscribersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(commandCentreSubscribersTable.id, req.subscriber!.id));
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_intent_data: {
      metadata: { kind: "cartridge_credit", localUserId: req.localUser!.id },
    },
    success_url: successUrl ?? `${origin}/cartridge?status=credit_purchased`,
    cancel_url: cancelUrl ?? `${origin}/cartridge?status=cancel`,
    metadata: { kind: "cartridge_credit", localUserId: req.localUser!.id },
  });
  res.json({ url: session.url ?? "" });
});

router.post("/billing/portal", requireAuth, requireSubscriptionsEnabled, async (req, res): Promise<void> => {
  const parsed = BillingPortalBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customerId = req.subscriber!.stripeCustomerId;
  if (!customerId) {
    res.status(400).json({ error: "No Stripe customer on file" });
    return;
  }
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }
  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: parsed.data.returnUrl ?? `${origin}/billing`,
  });
  res.json({ url: portal.url });
});

export default router;
