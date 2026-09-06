import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  arkXAccountLinksTable,
  arkXRedemptionsTable,
  db,
  commandCentreSubscribersTable,
  type SubscriberTier,
} from "@workspace/db";
import { requireCustomerAuth } from "../lib/auth";
import { requireSubscriptionsEnabled } from "../lib/feature-flags";
import { BillingCheckoutBody, BillingPortalBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../lib/stripe";
import { verifyArkXEligibilityAssertion } from "../lib/ark-x-eligibility";
import type Stripe from "stripe";

const router: IRouter = Router();

// F1000 soft-launch: a $39-off "forever" coupon turns the $49/mo Practitioner
// plan into $10/mo. Applied ONLY at Practitioner monthly checkout for redeemed
// F1000 members — it is attached to that subscription's discounts, so a later
// Architect upgrade (a separate checkout) is billed at full price.
const F1000_COUPON_ID = "f1000_softlaunch";
const F1000_DISCOUNT_CENTS = 3900;
const ARK_X_HIVE_GOLD_COUPON_ID = "ark_x_hive_gold_50";

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

async function ensureArkXHiveGoldCoupon(stripe: Stripe): Promise<string> {
  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(ARK_X_HIVE_GOLD_COUPON_ID);
  } catch {
    try {
      coupon = await stripe.coupons.create({
        id: ARK_X_HIVE_GOLD_COUPON_ID,
        percent_off: 50,
        duration: "forever",
        name: "ARK-X Hive Gold (50% off Architect)",
      });
    } catch (err) {
      // A simultaneous first redemption can create the fixed-id coupon before
      // this request does. Retrieve it to make creation idempotent; rethrow
      // if it genuinely remains unavailable.
      try {
        coupon = await stripe.coupons.retrieve(ARK_X_HIVE_GOLD_COUPON_ID);
      } catch {
        throw err;
      }
    }
  }
  if (coupon.percent_off !== 50 || coupon.duration !== "forever") {
    throw new Error("ARK-X Hive Gold Stripe coupon does not have the required 50% forever discount");
  }
  return ARK_X_HIVE_GOLD_COUPON_ID;
}

type ArkXLinkResult = "linked" | "subject-linked-elsewhere" | "user-linked-elsewhere";

/**
 * The link is committed before Stripe checkout. Its two unique constraints are
 * the authority against concurrent attempts to attach the same ARK subject to
 * different ACC accounts (or vice versa).
 */
async function ensureArkXAccountLink(arkSubject: string, userId: string): Promise<ArkXLinkResult> {
  return db.transaction(async (tx) => {
    const [subjectLink] = await tx
      .select({ userId: arkXAccountLinksTable.userId })
      .from(arkXAccountLinksTable)
      .where(eq(arkXAccountLinksTable.arkSubject, arkSubject))
      .limit(1);
    if (subjectLink && subjectLink.userId !== userId) return "subject-linked-elsewhere";

    const [userLink] = await tx
      .select({ arkSubject: arkXAccountLinksTable.arkSubject })
      .from(arkXAccountLinksTable)
      .where(eq(arkXAccountLinksTable.userId, userId))
      .limit(1);
    if (userLink && userLink.arkSubject !== arkSubject) return "user-linked-elsewhere";
    if (subjectLink && userLink) return "linked";

    await tx
      .insert(arkXAccountLinksTable)
      .values({ arkSubject, userId })
      .onConflictDoNothing();

    // Re-read inside the transaction so a concurrent unique-index winner is
    // evaluated against the authenticated account rather than guessed.
    const [linkedSubject] = await tx
      .select({ userId: arkXAccountLinksTable.userId })
      .from(arkXAccountLinksTable)
      .where(eq(arkXAccountLinksTable.arkSubject, arkSubject))
      .limit(1);
    if (linkedSubject?.userId !== userId) return "subject-linked-elsewhere";
    const [linkedUser] = await tx
      .select({ arkSubject: arkXAccountLinksTable.arkSubject })
      .from(arkXAccountLinksTable)
      .where(eq(arkXAccountLinksTable.userId, userId))
      .limit(1);
    return linkedUser?.arkSubject === arkSubject ? "linked" : "user-linked-elsewhere";
  });
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

router.post("/billing/checkout", requireSubscriptionsEnabled, requireCustomerAuth, async (req, res): Promise<void> => {
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
  let arkXAssertion: ReturnType<typeof verifyArkXEligibilityAssertion> | undefined;
  if (parsed.data.arkXEligibilityAssertion) {
    if (parsed.data.tier !== "ARCHITECT") {
      res.status(400).json({ error: "ARK-X eligibility applies only to Architect checkout" });
      return;
    }
    try {
      arkXAssertion = verifyArkXEligibilityAssertion(parsed.data.arkXEligibilityAssertion);
    } catch (err) {
      req.log.warn({ err }, "ARK-X eligibility assertion rejected");
      res.status(400).json({ error: "Invalid ARK-X eligibility assertion" });
      return;
    }
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

  if (arkXAssertion) {
    const [existingRedemption] = await db
      .select({ userId: arkXRedemptionsTable.userId })
      .from(arkXRedemptionsTable)
      .where(eq(arkXRedemptionsTable.jti, arkXAssertion.jti))
      .limit(1);
    if (existingRedemption && existingRedemption.userId !== req.localUser!.id) {
      res.status(409).json({ error: "ARK-X eligibility assertion was redeemed by another account" });
      return;
    }

    let linkResult: ArkXLinkResult;
    try {
      linkResult = await ensureArkXAccountLink(arkXAssertion.sub, req.localUser!.id);
    } catch (err) {
      req.log.error({ err }, "ARK-X account link persistence failed");
      res.status(503).json({ error: "Unable to link ARK-X account" });
      return;
    }
    if (linkResult === "subject-linked-elsewhere") {
      res.status(409).json({ error: "ARK-X subject is already linked to another account" });
      return;
    }
    if (linkResult === "user-linked-elsewhere") {
      res.status(409).json({ error: "ACC account is already linked to another ARK-X subject" });
      return;
    }

    if (existingRedemption) {
      const [redemption] = await db
        .select({ checkoutSessionId: arkXRedemptionsTable.checkoutSessionId })
        .from(arkXRedemptionsTable)
        .where(eq(arkXRedemptionsTable.jti, arkXAssertion.jti))
        .limit(1);
      try {
        const session = await stripe.checkout.sessions.retrieve(redemption!.checkoutSessionId);
        res.json({ url: session.url ?? "" });
      } catch (err) {
        req.log.error({ err, jti: arkXAssertion.jti }, "ARK-X checkout session recovery failed");
        res.status(503).json({ error: "Unable to recover ARK-X checkout session" });
      }
      return;
    }

    try {
      // Establish the fixed Stripe coupon before checkout. A transient Stripe
      // configuration failure leaves the assertion unredeemed and retryable.
      await ensureArkXHiveGoldCoupon(stripe);
    } catch (err) {
      req.log.error({ err }, "ARK-X Hive Gold coupon unavailable");
      res.status(503).json({ error: "ARK-X discount is temporarily unavailable" });
      return;
    }
  }

  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");

  let customerId = req.subscriber!.stripeCustomerId ?? undefined;
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: req.localUser!.email ?? undefined,
        metadata: { localUserId: req.localUser!.id, clerkUserId: req.clerkUserId! },
      });
      customerId = customer.id;
      await db
        .update(commandCentreSubscribersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(commandCentreSubscribersTable.id, req.subscriber!.id));
    } catch (err) {
      req.log.error({ err }, "Stripe customer creation failed");
      res.status(503).json({ error: "Unable to prepare billing customer" });
      return;
    }
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
  if (arkXAssertion) {
    discounts = [{ coupon: ARK_X_HIVE_GOLD_COUPON_ID }];
  }

  // First-time subscribers get a 30-day free trial on any paid plan.
  const alreadySubscribedBefore = Boolean(req.subscriber!.stripeSubscriptionId);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      discounts,
      subscription_data: alreadySubscribedBefore
        ? undefined
        : { trial_period_days: 30 },
      success_url: parsed.data.successUrl ?? `${origin}/billing?status=success`,
      cancel_url: parsed.data.cancelUrl ?? `${origin}/pricing?status=cancel`,
      metadata: {
        localUserId: req.localUser!.id,
        tier: parsed.data.tier,
        ...(arkXAssertion ? { arkXEligibilityJti: arkXAssertion.jti } : {}),
      },
    }, arkXAssertion ? { idempotencyKey: `ark-x-eligibility:${arkXAssertion.jti}` } : undefined);
  } catch (err) {
    req.log.error({ err }, "Stripe checkout creation failed");
    res.status(503).json({ error: "Unable to create checkout session" });
    return;
  }
  if (arkXAssertion) {
    try {
      const inserted = await db
        .insert(arkXRedemptionsTable)
        .values({
          jti: arkXAssertion.jti,
          arkSubject: arkXAssertion.sub,
          userId: req.localUser!.id,
          checkoutSessionId: session.id,
          checkoutStatus: session.status ?? "created",
        })
        .onConflictDoNothing({ target: arkXRedemptionsTable.jti })
        .returning({ userId: arkXRedemptionsTable.userId, checkoutSessionId: arkXRedemptionsTable.checkoutSessionId });
      if (!inserted.length) {
        const [stored] = await db
          .select({ userId: arkXRedemptionsTable.userId, checkoutSessionId: arkXRedemptionsTable.checkoutSessionId })
          .from(arkXRedemptionsTable)
          .where(eq(arkXRedemptionsTable.jti, arkXAssertion.jti))
          .limit(1);
        if (!stored || stored.userId !== req.localUser!.id) {
          res.status(409).json({ error: "ARK-X eligibility assertion was redeemed by another account" });
          return;
        }
        const recovered = await stripe.checkout.sessions.retrieve(stored.checkoutSessionId);
        res.json({ url: recovered.url ?? "" });
        return;
      }
    } catch (err) {
      // The session was created with a jti-derived Stripe idempotency key. A
      // client retry can safely recover it and record the redemption.
      req.log.error({ err, jti: arkXAssertion.jti }, "ARK-X redemption persistence failed after checkout");
      res.status(503).json({ error: "Checkout created; retry to finish ARK-X redemption" });
      return;
    }
  }
  res.json({ url: session.url ?? "" });
});

router.post("/billing/ingestion/checkout", requireSubscriptionsEnabled, requireCustomerAuth, async (req, res): Promise<void> => {
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

router.post("/billing/cartridge/checkout", requireSubscriptionsEnabled, requireCustomerAuth, async (req, res): Promise<void> => {
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

router.post("/billing/portal", requireSubscriptionsEnabled, requireCustomerAuth, async (req, res): Promise<void> => {
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
