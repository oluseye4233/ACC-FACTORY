import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  type Subscriber,
  type SubscriberTier,
  type User,
} from "@workspace/db";
import { effectiveTier, loadMembershipsForUser, type MembershipRow } from "./orgs";
import { learningIdentity } from "./learning-identity";
import { activeLearningMembership, learningRouteAllowed, learningCallContext } from "./learning-access";
import {
  STAFF_COOKIE,
  ensureStaffSubscriber,
  ensureStaffUser,
  parseSession,
} from "./staff-auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clerkUserId?: string;
      localUser?: User;
      subscriber?: Subscriber;
      /** Personal tier maxed against any active org team-seat sub. */
      effectiveTier?: SubscriberTier;
      /** Memberships at request-time; loaded once by `requireAuth` for downstream reuse. */
      memberships?: MembershipRow[];
      studentVerifiedEmail?: string;
      education?: { cohortId: string; membershipId: string };
      lifetimePractitioner?: boolean;
    }
  }
}

/**
 * Authenticate a request via the signed staff-session cookie.
 *
 * The subscription SaaS front door (Clerk) has been replaced by a single shared
 * access code + typed name (see `staff-auth.ts`). Clerk files/packages remain in
 * the repo but are no longer on the active request path. Every staffer resolves
 * to an ADMIN, INSTITUTION-tier local user so all existing tier / rate-limit /
 * admin gates pass unchanged.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = parseSession(req.signedCookies?.[STAFF_COOKIE]);
  if (!session) {
    try {
      const identity = await learningIdentity(req);
      if (!identity) { res.status(401).json({ error: "Unauthorized" }); return; }
      req.localUser = identity.user; req.subscriber = identity.subscriber;
      req.clerkUserId = identity.user.clerkUserId; req.studentVerifiedEmail = identity.email;
      req.effectiveTier = identity.subscriber.tier;
      req.memberships = [];
      req.lifetimePractitioner = identity.lifetimePractitioner;
      const hint = req.get("x-learning-membership");
      if (hint && !/^[a-f0-9-]{36}$/i.test(hint)) { res.status(400).json({ error: "Invalid training membership" }); return; }
      const enrolled = await activeLearningMembership(identity.user.id, hint);
      if (!learningRouteAllowed(req.method, req.path, Boolean(enrolled), identity.lifetimePractitioner)) {
        res.status(403).json({ error: "This action is outside your active training subscription" }); return;
      }
      // Course funding/elevated teaching capabilities apply only to the existing
      // curriculum route policy, never to newly available commercial operations.
      if (enrolled && learningRouteAllowed(req.method, req.path, true)) {
        req.education = { cohortId: enrolled.cohort.id, membershipId: enrolled.member.id };
        learningCallContext.run({ userId: identity.user.id, ...req.education }, () => next());
      } else next();
    } catch (error) {
      // No fallback to staff privileges or unverified identities.
      req.log.error({ err: error }, "student identity resolution failed");
      res.status(503).json({ error: "Student identity service unavailable" });
    }
    return;
  }

  let local: User;
  let sub: Subscriber;
  try {
    local = await ensureStaffUser(session.handle, session.name);
    sub = await ensureStaffSubscriber(local.id);
  } catch (err) {
    req.log.error({ err, handle: session.handle }, "staff identity upsert failed");
    res.status(503).json({ error: "Identity service temporarily unavailable" });
    return;
  }

  req.clerkUserId = local.clerkUserId;
  req.localUser = local;
  req.subscriber = sub;

  // Org tier elevation — best-effort. On lookup failure, fall back to the
  // personal tier so a transient DB blip cannot lock the whole portal out.
  try {
    const memberships = await loadMembershipsForUser(local.id);
    req.memberships = memberships;
    req.effectiveTier = effectiveTier(sub.tier, memberships);
  } catch (err) {
    req.log.warn({ err, userId: local.id }, "loadMembershipsForUser failed; using personal tier");
    req.memberships = [];
    req.effectiveTier = sub.tier;
  }
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.localUser?.role !== "ADMIN") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}

export { and, eq };
