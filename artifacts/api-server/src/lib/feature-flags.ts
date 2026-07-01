import type { NextFunction, Request, Response } from "express";

/**
 * Master switch for the (now-dormant) subscription + billing surface.
 *
 * The Command Centre was re-scoped into an INTERNAL staff ops platform: there
 * are no paying subscribers, every code-authenticated staffer gets full access,
 * and Stripe billing is switched OFF. All of the subscription machinery
 * (billing checkout, team-seat orgs, the F1000 promo, Stripe webhooks) is left
 * in place but gated behind this flag so re-enabling paid tiers later is a
 * one-env-var change — set `SUBSCRIPTIONS_ENABLED=true`.
 *
 * Default: OFF (any value other than the exact string "true").
 */
export function subscriptionsEnabled(): boolean {
  return process.env.SUBSCRIPTIONS_ENABLED === "true";
}

/**
 * Middleware guard for subscription/billing-only routes. Returns 503
 * SUBSCRIPTIONS_DISABLED while the platform runs in internal-staff mode.
 */
export function requireSubscriptionsEnabled(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!subscriptionsEnabled()) {
    res.status(503).json({
      error: "Subscriptions are disabled on this deployment",
      code: "SUBSCRIPTIONS_DISABLED",
    });
    return;
  }
  next();
}
