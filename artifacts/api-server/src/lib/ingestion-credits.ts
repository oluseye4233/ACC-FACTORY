import { and, count, eq, sql } from "drizzle-orm";
import { db, ingestionCreditsTable } from "@workspace/db";

/**
 * Atomically claim one available ingestion credit for the user. Uses
 * `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` so concurrent
 * requests cannot double-spend the same credit. Returns the claimed credit id,
 * or `null` if the user has no available credits.
 */
export async function claimIngestionCredit(userId: string): Promise<string | null> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE ingestion_credits
       SET status = 'consumed', consumed_at = now()
     WHERE id = (
       SELECT id FROM ingestion_credits
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
export async function releaseIngestionCredit(creditId: string): Promise<void> {
  await db
    .update(ingestionCreditsTable)
    .set({ status: "available", consumedAt: null, ingestionDocumentId: null })
    .where(eq(ingestionCreditsTable.id, creditId));
}

/** Link a successfully-consumed credit to the ingestion document it paid for. */
export async function linkCreditToDocument(
  creditId: string,
  ingestionDocumentId: string,
): Promise<void> {
  await db
    .update(ingestionCreditsTable)
    .set({ ingestionDocumentId })
    .where(eq(ingestionCreditsTable.id, creditId));
}

export interface IngestionCreditsSummary {
  available: number;
  consumed: number;
  total: number;
}

export async function getIngestionCreditsSummary(
  userId: string,
): Promise<IngestionCreditsSummary> {
  const rows = await db
    .select({
      status: ingestionCreditsTable.status,
      n: count(ingestionCreditsTable.id),
    })
    .from(ingestionCreditsTable)
    .where(eq(ingestionCreditsTable.userId, userId))
    .groupBy(ingestionCreditsTable.status);
  let available = 0;
  let consumed = 0;
  for (const r of rows) {
    if (r.status === "available") available = Number(r.n);
    else if (r.status === "consumed") consumed = Number(r.n);
  }
  return { available, consumed, total: available + consumed };
}

// Suppress unused-import warning if `and` is dropped by future edits.
void and;
