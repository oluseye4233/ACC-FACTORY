import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  mathmonIntakesTable,
  mathmonMapsTable,
} from "@workspace/db";

/**
 * The session's JCSE score for the FORGE VERIFIED gate: the maximum jcseScore
 * recorded across the session's artifacts (F1 diagnostic, F2 atomic prompt, and
 * the DE-SPC synthesiser all persist a 0–50 JCSE total). Returns null when the
 * session has no scored artifact yet, which can never pass the gate.
 */
export async function sessionMaxJcse(sessionId: string): Promise<number | null> {
  const rows = await db
    .select({ max: sql<number | null>`max(${harnessArtifactsTable.jcseScore})` })
    .from(harnessArtifactsTable)
    .where(eq(harnessArtifactsTable.sessionId, sessionId));
  const max = rows[0]?.max;
  return typeof max === "number" ? max : null;
}

/** Latest MATHMON intake report for a session (most recent first). */
export async function loadLatestIntake(
  sessionId: string,
  userId: string,
): Promise<typeof mathmonIntakesTable.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(mathmonIntakesTable)
    .where(
      and(
        eq(mathmonIntakesTable.sessionId, sessionId),
        eq(mathmonIntakesTable.userId, userId),
      ),
    )
    .orderBy(desc(mathmonIntakesTable.createdAt))
    .limit(1);
  return rows[0];
}

/** Latest MAP for a session (most recent first). */
export async function loadLatestMap(
  sessionId: string,
  userId: string,
): Promise<typeof mathmonMapsTable.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(mathmonMapsTable)
    .where(
      and(
        eq(mathmonMapsTable.sessionId, sessionId),
        eq(mathmonMapsTable.userId, userId),
      ),
    )
    .orderBy(desc(mathmonMapsTable.createdAt))
    .limit(1);
  return rows[0];
}
