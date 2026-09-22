import { count, eq, sql } from "drizzle-orm";
import { db, cartridgeCreditsTable } from "@workspace/db";

/**
 * Atomically claim one available cartridge credit for the user. Mirrors the
 * ingestion-credit pattern (FOR UPDATE SKIP LOCKED). Returns the claimed credit
 * id, or `null` if the user has no available credits.
 */
export async function claimCartridgeCredit(
  userId: string,
): Promise<string | null> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE cartridge_credits
       SET status = 'consumed', consumed_at = now()
     WHERE id = (
       SELECT id FROM cartridge_credits
        WHERE user_id = ${userId}::uuid AND status = 'available'
        ORDER BY purchased_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id
  `);
  const row = (result as unknown as { rows?: Array<{ id: string }> }).rows?.[0];
  return row?.id ?? null;
}

/** Release a previously-claimed credit back to `available` (used on failure paths). */
export async function releaseCartridgeCredit(creditId: string): Promise<void> {
  await db
    .update(cartridgeCreditsTable)
    .set({ status: "available", consumedAt: null, cartridgePackageId: null })
    .where(eq(cartridgeCreditsTable.id, creditId));
}

/** Link a successfully-consumed credit to the cartridge package it paid for. */
export async function linkCreditToCartridge(
  creditId: string,
  cartridgePackageId: string,
  client: Pick<typeof db, "update"> = db,
): Promise<void> {
  const linked = await client
    .update(cartridgeCreditsTable)
    .set({ cartridgePackageId })
    .where(eq(cartridgeCreditsTable.id, creditId))
    .returning({ id: cartridgeCreditsTable.id });
  if (linked.length !== 1) {
    throw new Error("Reserved cartridge credit could not be linked");
  }
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
