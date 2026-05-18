import type { NextFunction, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  type Subscriber,
  type User,
} from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clerkUserId?: string;
      localUser?: User;
      subscriber?: Subscriber;
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

  const local = await ensureLocalUser(clerkUserId);
  req.localUser = local;

  const sub = await ensureSubscriber(local.id);
  req.subscriber = sub;
  next();
}

async function ensureLocalUser(clerkUserId: string): Promise<User> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  if (existing.length > 0) return existing[0]!;

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
  } catch {
    // best-effort identity sync; keep going
  }

  const [created] = await db
    .insert(usersTable)
    .values({ clerkUserId, email, displayName, role })
    .onConflictDoNothing({ target: usersTable.clerkUserId })
    .returning();
  if (created) return created;
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
