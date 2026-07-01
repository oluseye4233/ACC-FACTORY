import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  type Subscriber,
  type User,
} from "@workspace/db";
import { computeCreatorHash } from "./sku";

/**
 * Internal-staff access model.
 *
 * The portal front door is a SINGLE shared access code (`STAFF_ACCESS_CODE`)
 * plus a free-text name/initials the staffer types purely for attribution.
 * There is no per-user password and no identity provider — Clerk has been
 * lifted out of the active path. A staffer who knows the code is fully trusted.
 *
 * On login we mint a signed session cookie carrying `{ handle, name }`. Every
 * authenticated request re-derives the local user + subscriber from that cookie
 * via `ensureStaffUser` / `ensureStaffSubscriber` (JIT upsert), so no schema
 * migration is needed: the synthetic `clerkUserId` (`staff:<handle>`) satisfies
 * the existing NOT NULL + UNIQUE constraint on `users.clerk_user_id`.
 */

/** Name of the signed session cookie. */
export const STAFF_COOKIE = "atanda_staff";

/** Prefix used to synthesise a `clerk_user_id` for staff (no real Clerk id). */
export const STAFF_CLERK_PREFIX = "staff:";

export interface StaffSession {
  handle: string;
  name: string;
}

/** Whether a shared access code is configured at all. */
export function accessCodeConfigured(): boolean {
  return typeof process.env.STAFF_ACCESS_CODE === "string" && process.env.STAFF_ACCESS_CODE.length > 0;
}

/** Constant-time comparison of a submitted code against `STAFF_ACCESS_CODE`. */
export function verifyAccessCode(submitted: string): boolean {
  const expected = process.env.STAFF_ACCESS_CODE;
  if (!expected) return false;
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Derive a stable attribution handle from the typed name/initials. Two staffers
 * who type the same name share one attribution identity — acceptable for an
 * internal tool where the name is a label, not a credential.
 */
export function slugifyHandle(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "staff";
}

/** Serialize a session for the signed cookie value. */
export function serializeSession(s: StaffSession): string {
  return JSON.stringify(s);
}

/** Parse (and validate) a signed-cookie value back into a session. */
export function parseSession(raw: unknown): StaffSession | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o && typeof o.handle === "string" && typeof o.name === "string" && o.handle.length > 0) {
      return { handle: o.handle, name: o.name };
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * JIT-upsert the local user row for a staff handle. All staff are ADMIN (the
 * portal is fully open behind the shared code) and carry no email. The typed
 * display name is refreshed on every login so attribution stays current.
 */
export async function ensureStaffUser(handle: string, name: string): Promise<User> {
  const clerkUserId = `${STAFF_CLERK_PREFIX}${handle}`;
  // SKU-001: mint the stable creator hash once, on first provision. It is set
  // only in the INSERT branch — the onConflict path never rewrites it — so a
  // staffer's catalog identity stays stable across every login.
  const creatorHash = computeCreatorHash(clerkUserId, null);
  const [row] = await db
    .insert(usersTable)
    .values({ clerkUserId, email: null, displayName: name, role: "ADMIN", creatorHash })
    .onConflictDoUpdate({
      target: usersTable.clerkUserId,
      set: { displayName: name, role: "ADMIN" },
    })
    .returning();
  if (row) return row;
  const reread = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  return reread[0]!;
}

/**
 * JIT-upsert the subscriber row for a staff user. Every staffer is pinned to
 * INSTITUTION/active so all tier + rate-limit gates pass (INSTITUTION = -1
 * unlimited on every feature). The subscription surface itself is off; this row
 * only exists to satisfy the gates that all engine routes already flow through.
 */
export async function ensureStaffSubscriber(userId: string): Promise<Subscriber> {
  const [row] = await db
    .insert(commandCentreSubscribersTable)
    .values({ userId, tier: "INSTITUTION", status: "active" })
    .onConflictDoUpdate({
      target: commandCentreSubscribersTable.userId,
      set: { tier: "INSTITUTION", status: "active" },
    })
    .returning();
  if (row) return row;
  const reread = await db
    .select()
    .from(commandCentreSubscribersTable)
    .where(eq(commandCentreSubscribersTable.userId, userId))
    .limit(1);
  return reread[0]!;
}
