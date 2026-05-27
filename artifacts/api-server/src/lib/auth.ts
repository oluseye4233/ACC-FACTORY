import type { NextFunction, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  type Subscriber,
  type SubscriberTier,
  type User,
} from "@workspace/db";
import { effectiveTier, loadMembershipsForUser, type MembershipRow } from "./orgs";

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
    }
  }
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = clerkUserId;

  let local: User;
  try {
    local = await ensureLocalUser(clerkUserId);
  } catch (err) {
    if (err instanceof ClerkIdentityNotFoundError) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.log.error({ err, clerkUserId }, "ensureLocalUser failed");
    res.status(503).json({ error: "Identity service temporarily unavailable" });
    return;
  }
  req.localUser = local;

  const sub = await ensureSubscriber(local.id);
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

class ClerkIdentityNotFoundError extends Error {}

async function ensureLocalUser(clerkUserId: string): Promise<User> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  if (existing.length > 0) return existing[0]!;

  // First-time sync: REQUIRE a confirmed Clerk identity before creating a local shell.
  // A stale/replayed token whose Clerk user has been deleted must NOT be able to JIT-create
  // a fresh local account.
  let email: string | null = null;
  let displayName: string | null = null;
  let role = "USER";
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
    displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
      clerkUser.username ||
      null;
    const metaRole = (clerkUser.publicMetadata as Record<string, unknown> | null)?.role;
    if (typeof metaRole === "string" && metaRole.toUpperCase() === "ADMIN") {
      role = "ADMIN";
    } else if (email && adminEmails.includes(email.toLowerCase())) {
      role = "ADMIN";
    }
  } catch (err) {
    const status = (err as { status?: number; statusCode?: number }).status
      ?? (err as { status?: number; statusCode?: number }).statusCode;
    if (status === 404) {
      throw new ClerkIdentityNotFoundError(`clerk user ${clerkUserId} not found`);
    }
    // Any other error (Clerk outage etc.) is also unsafe to silently fall through on
    // first-time provisioning — the only way we'd know what email/role belongs to this
    // user is via Clerk.
    throw new Error(`clerk getUser failed during first JIT sync: ${(err as Error).message}`);
  }

  const [created] = await db
    .insert(usersTable)
    .values({ clerkUserId, email, displayName, role })
    .onConflictDoNothing({ target: usersTable.clerkUserId })
    .returning();
  if (created) {
    // Best-effort welcome email on first JIT-sync — never block auth on email failures.
    if (email) {
      void (async () => {
        try {
          const { sendWelcome } = await import("@workspace/email");
          await sendWelcome({ to: email, displayName });
        } catch {
          // swallow — email is best-effort
        }
      })();
    }
    return created;
  }
  const reread = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  return reread[0]!;
}

async function ensureSubscriber(userId: string): Promise<Subscriber> {
  const existing = await db
    .select()
    .from(commandCentreSubscribersTable)
    .where(eq(commandCentreSubscribersTable.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0]!;
  const [created] = await db
    .insert(commandCentreSubscribersTable)
    .values({ userId, tier: "EXPLORER", status: "inactive" })
    .onConflictDoNothing({ target: commandCentreSubscribersTable.userId })
    .returning();
  if (created) return created;
  const reread = await db
    .select()
    .from(commandCentreSubscribersTable)
    .where(eq(commandCentreSubscribersTable.userId, userId))
    .limit(1);
  return reread[0]!;
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
