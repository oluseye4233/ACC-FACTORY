import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db, cartridgeCreditsTable } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { logger } from "./logger";
import { subscriptionsEnabled } from "./feature-flags";

const LEASE_MS = 15 * 60 * 1000;
const RECONCILE_MS = 5 * 60 * 1000;
export interface CartridgeCreditReservation { id: string; token: string }
export class CartridgeCreditReservationLostError extends Error {
  constructor() {
    super("Cartridge credit reservation is no longer owned by this request");
    this.name = "CartridgeCreditReservationLostError";
  }
}

/**
 * Atomically claim one available cartridge credit for the user. Mirrors the
 * ingestion-credit pattern (FOR UPDATE SKIP LOCKED). Every claim gets a new
 * fencing token so a slow request cannot mutate a recovered/reclaimed credit.
 */
export async function claimCartridgeCredit(
  userId: string,
): Promise<CartridgeCreditReservation | null> {
  const token = randomUUID();
  const result = await db.execute<{ id: string; reservation_token: string }>(sql`
    UPDATE cartridge_credits
       SET status = 'consumed', consumed_at = now(), reservation_token = ${token}::uuid
     WHERE id = (
       SELECT id FROM cartridge_credits
        WHERE user_id = ${userId}::uuid AND status = 'available'
        ORDER BY purchased_at ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id, reservation_token
  `);
  const row = result.rows[0];
  return row ? { id: row.id, token: row.reservation_token } : null;
}

/** Release a previously-claimed credit back to `available` (used on failure paths). */
export async function releaseCartridgeCredit(reservation: CartridgeCreditReservation): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const released = await db.update(cartridgeCreditsTable)
        .set({ status: "available", consumedAt: null, reservationToken: null })
        .where(and(
          eq(cartridgeCreditsTable.id, reservation.id),
          eq(cartridgeCreditsTable.status, "consumed"),
          isNull(cartridgeCreditsTable.cartridgePackageId),
          eq(cartridgeCreditsTable.reservationToken, reservation.token),
        )).returning({ id: cartridgeCreditsTable.id });
      if (released.length !== 1) throw new CartridgeCreditReservationLostError();
      return;
    } catch (error) {
      if (error instanceof CartridgeCreditReservationLostError || attempt === 2) throw error;
      await delay(50 * (attempt + 1));
    }
  }
}

/** Link a successfully-consumed credit to the cartridge package it paid for. */
export async function linkCreditToCartridge(
  reservation: CartridgeCreditReservation,
  cartridgePackageId: string,
  client: Pick<typeof db, "update"> = db,
): Promise<void> {
  const linked = await client
    .update(cartridgeCreditsTable)
    .set({ cartridgePackageId, reservationToken: null })
    .where(and(
      eq(cartridgeCreditsTable.id, reservation.id),
      eq(cartridgeCreditsTable.status, "consumed"),
      isNull(cartridgeCreditsTable.cartridgePackageId),
      eq(cartridgeCreditsTable.reservationToken, reservation.token),
    ))
    .returning({ id: cartridgeCreditsTable.id });
  if (linked.length !== 1) {
    throw new CartridgeCreditReservationLostError();
  }
}

/** Bounded, restart-safe recovery. Legacy un-tokened rows require review. */
export async function reconcileStaleCartridgeCredits(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - LEASE_MS);
  const result = await db.execute<{ id: string }>(sql`
    WITH abandoned AS (
      SELECT id FROM cartridge_credits
      WHERE status = 'consumed' AND cartridge_package_id IS NULL
        AND reservation_token IS NOT NULL AND consumed_at < ${before}
      ORDER BY consumed_at, id LIMIT 100 FOR UPDATE SKIP LOCKED
    )
    UPDATE cartridge_credits c
    SET status = 'available', consumed_at = NULL, reservation_token = NULL
    FROM abandoned a WHERE c.id = a.id
    RETURNING c.id
  `);
  return result.rows.length;
}

export function startCartridgeCreditReconciler(): () => void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return () => {};
  let running = false;
  const reconcile = async () => {
    if (running || !subscriptionsEnabled()) return;
    running = true;
    try {
      const released = await reconcileStaleCartridgeCredits();
      if (released) logger.warn({ released }, "Recovered abandoned Cartridge credit reservations");
    } catch (err) {
      logger.error({ err }, "Cartridge credit recovery failed; will retry");
    } finally { running = false; }
  };
  void reconcile();
  const interval = setInterval(() => void reconcile(), RECONCILE_MS);
  interval.unref();
  return () => clearInterval(interval);
}

export interface CartridgeCreditsSummary {
  available: number;
  consumed: number;
  total: number;
}

export async function getCartridgeCreditsSummary(
  userId: string,
): Promise<CartridgeCreditsSummary> {
  const rows = await db
    .select({
      status: cartridgeCreditsTable.status,
      n: count(cartridgeCreditsTable.id),
    })
    .from(cartridgeCreditsTable)
    .where(eq(cartridgeCreditsTable.userId, userId))
    .groupBy(cartridgeCreditsTable.status);
  let available = 0;
  let consumed = 0;
  for (const r of rows) {
    if (r.status === "available") available = Number(r.n);
    else if (r.status === "consumed") consumed = Number(r.n);
  }
  return { available, consumed, total: available + consumed };
}
