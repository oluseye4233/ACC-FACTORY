import { getAuth, clerkClient } from "@clerk/express";
import type { Request } from "express";
import { db, usersTable, commandCentreSubscribersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeCreatorHash } from "./sku";
import { applyForgePractitioner, hasForgeLifetimePractitioner } from "./forge-lifetime";

/** Independent verified identities only. Never uses or elevates staff handles. */
export async function learningIdentity(req: Request) {
  if (!("auth" in req)) return null; // No verified student session; never infer one.
  const auth = getAuth(req);
  if (!auth.userId) return null;
  const remote = await clerkClient.users.getUser(auth.userId);
  const primary = remote.emailAddresses.find((e) =>
    e.id === remote.primaryEmailAddressId && e.verification?.status === "verified");
  if (!primary) return null;
  const email = primary.emailAddress.toLowerCase().trim();
  const [user] = await db.insert(usersTable).values({
    clerkUserId: auth.userId, email,
    displayName: [remote.firstName, remote.lastName].filter(Boolean).join(" ") || email,
    role: "USER", creatorHash: computeCreatorHash(auth.userId, email),
  }).onConflictDoUpdate({
    target: usersTable.clerkUserId,
    set: { email }, // Never trust identity claims to elevate a stored role.
  }).returning();
  await db.insert(commandCentreSubscribersTable).values({
    userId: user!.id, tier: "EXPLORER", status: "inactive",
  }).onConflictDoNothing({ target: commandCentreSubscribersTable.userId });
  const [subscriber] = await db.select().from(commandCentreSubscribersTable)
    .where(eq(commandCentreSubscribersTable.userId, user!.id));
  const lifetimePractitioner = await hasForgeLifetimePractitioner(user!.id);
  return {
    user: user!, email, lifetimePractitioner,
    subscriber: applyForgePractitioner(subscriber!, lifetimePractitioner),
  };
}
