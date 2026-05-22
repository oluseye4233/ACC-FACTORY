import express, { Router, type IRouter } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db,
  commandCentreSubscribersTable,
  ingestionCreditsTable,
  cartridgeCreditsTable,
  stripeWebhookEventsTable,
  usersTable,
  type SubscriberTier,
} from "@workspace/db";
import {
  sendSubscriptionReceipt,
  sendSubscriptionCancelled,
  sendPaymentFailed,
} from "@workspace/email";
import { getStripeWebhookSecret, getUncachableStripeClient } from "../lib/stripe";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const router: IRouter = Router();

const PRICE_TO_TIER: () => Record<string, SubscriberTier> = () => ({
  [process.env.STRIPE_PRICE_PRACTITIONER_MONTHLY ?? ""]: "PRACTITIONER",
  [process.env.STRIPE_PRICE_PRACTITIONER_YEARLY ?? ""]: "PRACTITIONER",
  [process.env.STRIPE_PRICE_ARCHITECT_MONTHLY ?? ""]: "ARCHITECT",
  [process.env.STRIPE_PRICE_ARCHITECT_YEARLY ?? ""]: "ARCHITECT",
});

async function emailForCustomer(
  tx: Tx,
  customerId: string,
): Promise<{ email: string; tier: string } | null> {
  const rows = await tx
    .select({
      email: usersTable.email,
      tier: commandCentreSubscribersTable.tier,
    })
    .from(commandCentreSubscribersTable)
    .innerJoin(usersTable, eq(usersTable.id, commandCentreSubscribersTable.userId))
    .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId))
    .limit(1);
  const r = rows[0];
  if (!r || !r.email) return null;
  return { email: r.email, tier: r.tier };
}

class UnknownPriceError extends Error {
  constructor(priceId: string) {
    super(`Unknown Stripe price id: ${priceId}`);
    this.name = "UnknownPriceError";
  }
}

async function applySubscription(
  req: express.Request,
  tx: Tx,
  customerId: string,
  sub: Stripe.Subscription | null,
  priceMap: Record<string, SubscriberTier>,
): Promise<void> {
  if (!sub) return;
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  if (priceId && !(priceId in priceMap)) {
    req.log.warn({ priceId, customerId }, "Stripe webhook references unknown price id");
    throw new UnknownPriceError(priceId);
  }
  const tier: SubscriberTier = priceMap[priceId] ?? "EXPLORER";
  const periodEnd = item?.current_period_end ?? null;
  await tx
    .update(commandCentreSubscribersTable)
    .set({
      tier,
      status: sub.status,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId));
}

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

    // Single transaction: insert idempotency row + run handler. Concurrent duplicate
    // deliveries serialize on the PK; the loser sees onConflictDoNothing return
    // empty AFTER the winner commits, and returns replay. If the handler throws,
    // the transaction rolls back (including the idempotency row) so Stripe retries.
    try {
      const replay = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(stripeWebhookEventsTable)
          .values({ eventId: event.id, type: event.type })
          .onConflictDoNothing({ target: stripeWebhookEventsTable.eventId })
          .returning({ eventId: stripeWebhookEventsTable.eventId });

        if (inserted.length === 0) {
          return true;
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const customerId =
              typeof session.customer === "string" ? session.customer : session.customer?.id;
            if (!customerId) break;

            // One-time ingestion project credit purchase. Mode=payment with
            // metadata.kind=ingestion_credit; resolve the local user via the
            // Stripe customer id and insert a credit row keyed by checkout
            // session id (unique constraint = idempotency net beyond the
            // outer stripe_webhook_events PK).
            if (
              session.mode === "payment" &&
              session.metadata?.kind === "cartridge_credit"
            ) {
              const subRows = await tx
                .select({ userId: commandCentreSubscribersTable.userId })
                .from(commandCentreSubscribersTable)
                .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId))
                .limit(1);
              const userId = subRows[0]?.userId;
              if (!userId) {
                req.log.warn(
                  { customerId, sessionId: session.id },
                  "Cartridge credit purchase: no local user found for Stripe customer",
                );
                break;
              }
              const paymentIntentId =
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null;
              await tx
                .insert(cartridgeCreditsTable)
                .values({
                  userId,
                  status: "available",
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId,
                  amountUsdCents: session.amount_total ?? null,
                })
                .onConflictDoNothing({
                  target: cartridgeCreditsTable.stripeCheckoutSessionId,
                });
              break;
            }

            if (
              session.mode === "payment" &&
              session.metadata?.kind === "ingestion_credit"
            ) {
              const subRows = await tx
                .select({ userId: commandCentreSubscribersTable.userId })
                .from(commandCentreSubscribersTable)
                .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId))
                .limit(1);
              const userId = subRows[0]?.userId;
              if (!userId) {
                req.log.warn(
                  { customerId, sessionId: session.id },
                  "Ingestion credit purchase: no local user found for Stripe customer",
                );
                break;
              }
              const paymentIntentId =
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null;
              await tx
                .insert(ingestionCreditsTable)
                .values({
                  userId,
                  status: "available",
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId,
                  amountUsdCents: session.amount_total ?? null,
                })
                .onConflictDoNothing({
                  target: ingestionCreditsTable.stripeCheckoutSessionId,
                });
              break;
            }

            const subId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id;
            const subscription = subId ? await stripe.subscriptions.retrieve(subId) : null;
            await applySubscription(req, tx, customerId, subscription, priceMap);
            break;
          }
          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const sub = event.data.object as Stripe.Subscription;
            const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
            await applySubscription(req, tx, customerId, sub, priceMap);
            break;
          }
          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
            const item = sub.items.data[0];
            const periodEnd = item?.current_period_end
              ? new Date(item.current_period_end * 1000)
              : null;
            const before = await emailForCustomer(tx, customerId);
            await tx
              .update(commandCentreSubscribersTable)
              .set({
                tier: "EXPLORER",
                status: "canceled",
                stripeSubscriptionId: null,
                stripePriceId: null,
                cancelAtPeriodEnd: false,
                currentPeriodEnd: null,
              })
              .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId));
            if (before) {
              await sendSubscriptionCancelled({
                to: before.email,
                tier: before.tier,
                periodEnd,
              });
            }
            break;
          }
          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId =
              typeof invoice.customer === "string"
                ? invoice.customer
                : invoice.customer?.id ?? null;
            if (!customerId) break;
            const rec = await emailForCustomer(tx, customerId);
            if (rec) {
              await sendSubscriptionReceipt({
                to: rec.email,
                tier: rec.tier,
                amountUsd: (invoice.amount_paid ?? 0) / 100,
                periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
              });
            }
            break;
          }
          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId =
              typeof invoice.customer === "string"
                ? invoice.customer
                : invoice.customer?.id ?? null;
            if (!customerId) break;
            await tx
              .update(commandCentreSubscribersTable)
              .set({ status: "past_due" })
              .where(eq(commandCentreSubscribersTable.stripeCustomerId, customerId));
            const rec = await emailForCustomer(tx, customerId);
            if (rec) {
              await sendPaymentFailed({ to: rec.email, tier: rec.tier });
            }
            break;
          }
          default:
            req.log.debug({ type: event.type }, "Unhandled Stripe event");
        }
        return false;
      });

      if (replay) {
        req.log.info({ eventId: event.id, type: event.type }, "Stripe webhook replay ignored");
        res.json({ ok: true, replay: true });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err, eventId: event.id, type: event.type }, "Stripe webhook handler failed");
      const msg = err instanceof Error ? err.message : "Webhook handler failure";
      const status = err instanceof UnknownPriceError ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

export default router;
