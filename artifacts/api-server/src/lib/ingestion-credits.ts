import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { db, ingestionCreditsTable } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

const RESERVATION_LEASE_MS = 15 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Atomically claim one available ingestion credit for the user. Uses
 * `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` so concurrent
 * requests cannot double-spend the same credit. Returns the claimed credit id,
 * or `null` if the user has no available credits.
 */
export interface IngestionCreditReservation {
  id: string;
  token: string;
}

export class IngestionCreditReservationLostError extends Error {
  constructor() {
    super("Ingestion credit reservation is no longer owned by this request");
    this.name = "IngestionCreditReservationLostError";
  }
}

export async function claimIngestionCredit(
  userId: string,
): Promise<IngestionCreditReservation | null> {
  const token = randomUUID();
  const result = await db.execute<{ id: string; reservation_token: string }>(sql`
    UPDATE ingestion_credits
       SET status = 'consumed',
           consumed_at = now(),
           reservation_token = ${token}::uuid
     WHERE id = (
       SELECT id FROM ingestion_credits
        WHERE user_id = ${userId}::uuid AND status = 'available'
        ORDER BY purchased_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id, reservation_token
  `);
  const row = (
    result as unknown as {
      rows?: Array<{ id: string; reservation_token: string }>;
    }
  ).rows?.[0];
  return row ? { id: row.id, token: row.reservation_token } : null;
}

/** Release a previously-claimed credit back to `available` (used on failure paths). */
export async function releaseIngestionCredit(
  reservation: IngestionCreditReservation,
): Promise<void> {
  const released = await db
    .update(ingestionCreditsTable)
    .set({
      status: "available",
      consumedAt: null,
      ingestionDocumentId: null,
      reservationToken: null,
    })
    .where(
      and(
        eq(ingestionCreditsTable.id, reservation.id),
        eq(ingestionCreditsTable.status, "consumed"),
        isNull(ingestionCreditsTable.ingestionDocumentId),
        eq(ingestionCreditsTable.reservationToken, reservation.token),
      ),
    )
    .returning({ id: ingestionCreditsTable.id });
  if (released.length !== 1) {
    throw new IngestionCreditReservationLostError();
  }
}

/**
 * Return expired reservations that were never linked to a persisted document.
 * The lease keeps an active ingestion safe while making abandoned reservations
 * recoverable after request failure or process restart.
 */
export async function reconcileStaleIngestionCredits(
  now = new Date(),
): Promise<number> {
  const staleBefore = new Date(now.getTime() - RESERVATION_LEASE_MS);
  const released = await db
    .update(ingestionCreditsTable)
    .set({
      status: "available",
      consumedAt: null,
      ingestionDocumentId: null,
      reservationToken: null,
    })
    .where(
      and(
        eq(ingestionCreditsTable.status, "consumed"),
        isNull(ingestionCreditsTable.ingestionDocumentId),
        lt(ingestionCreditsTable.consumedAt, staleBefore),
      ),
    )
    .returning({ id: ingestionCreditsTable.id });
  return released.length;
}

export function startIngestionCreditReconciler(): () => void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return () => {};
  }

  const reconcile = (): void => {
    void reconcileStaleIngestionCredits()
      .then((released) => {
        if (released > 0) {
          logger.warn(
            { released },
            "Reconciled stale unlinked ingestion credit reservations",
          );
        }
      })
      .catch((err: unknown) => {
        logger.error(
          { err },
          "Failed to reconcile stale ingestion credit reservations; will retry",
        );
      });
  };

  reconcile();
  const interval = setInterval(reconcile, RECONCILE_INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
}

/** Link a successfully-consumed credit to the ingestion document it paid for. */
export async function linkCreditToDocument(
  reservation: IngestionCreditReservation,
  ingestionDocumentId: string,
  client: Pick<typeof db, "update"> = db,
): Promise<void> {
  const linked = await client
    .update(ingestionCreditsTable)
    .set({ ingestionDocumentId, reservationToken: null })
    .where(
      and(
        eq(ingestionCreditsTable.id, reservation.id),
        eq(ingestionCreditsTable.status, "consumed"),
        isNull(ingestionCreditsTable.ingestionDocumentId),
        eq(ingestionCreditsTable.reservationToken, reservation.token),
      ),
    )
    .returning({ id: ingestionCreditsTable.id });
  if (linked.length !== 1) {
    throw new Error("Reserved ingestion credit could not be linked");
  }
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
