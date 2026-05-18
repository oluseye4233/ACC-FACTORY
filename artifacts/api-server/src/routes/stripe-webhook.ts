import express, { Router, type IRouter } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, commandCentreSubscribersTable, type SubscriberTier } from "@workspace/db";
import { getStripeWebhookSecret, getUncachableStripeClient } from "../lib/stripe";

const router: IRouter = Router();

const PRICE_TO_TIER: () => Record<string, SubscriberTier> = () => ({
  [process.env.STRIPE_PRICE_PRACTITIONER_MONTHLY ?? ""]: "PRACTITIONER",
  [process.env.STRIPE_PRICE_PRACTITIONER_YEARLY ?? ""]: "PRACTITIONER",
  [process.env.STRIPE_PRICE_ARCHITECT_MONTHLY ?? ""]: "ARCHITECT",
  [process.env.STRIPE_PRICE_ARCHITECT_YEARLY ?? ""]: "ARCHITECT",
});

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const secret = await getStripeWebhookSecret();
    if (!secret) {
      res.status(503).json({ error: "Webhook secret not configured (set STRIPE_WEBHOOK_SECRET)" });
      return;
    }
    let stripe;
    try {
      stripe = await getUncachableStripeClient();
    } catch {
      res.status(503).json({ error: "Stripe client unavailable" });
      return;
    }
    const sig = req.headers["stripe-signature"];
    if (!sig || Array.isArray(sig)) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
    } catch (err) {
      req.log.warn({ err }, "Stripe webhook signature failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const priceMap = PRICE_TO_TIER();

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId =
            typeof session.customer === "string" ? session.customer : session.customer?.id;
          if (!customerId) break;
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          const subscription = subId ? await stripe.subscriptions.retrieve(subId) : null;
          await applySubscription(customerId, subscription, priceMap);
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          await applySubscription(customerId, sub, priceMap);
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          await db
            .update(commandCentreSubscribersTable)
            .set({
              tier: "EXPLORER",
              status: "canceled",
              stripeSubscriptionId: null,
              stripePriceId: null,
              cancelAtPeriodEnd: "false",
              currentPeriodEnd: null,
            })
            .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId));
          break;
        }
        default:
          req.log.debug({ type: event.type }, "Unhandled Stripe event");
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook handler failed");
      res.status(500).json({ error: "Webhook handler failure" });
    }
  },
);

async function applySubscription(
  customerId: string,
  sub: Stripe.Subscription | null,
  priceMap: Record<string, SubscriberTier>,
): Promise<void> {
  if (!sub) return;
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  const tier: SubscriberTier = priceMap[priceId] ?? "EXPLORER";
  const periodEnd = item?.current_period_end ?? null;
  await db
    .update(commandCentreSubscribersTable)
    .set({
      tier,
      status: sub.status,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      cancelAtPeriodEnd: sub.cancel_at_period_end ? "true" : "false",
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId));
}

export default router;
