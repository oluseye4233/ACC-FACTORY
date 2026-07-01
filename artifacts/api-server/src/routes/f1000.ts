import { Router, type IRouter, type Request } from "express";
import { and, asc, eq, lt, ne, sql } from "drizzle-orm";
import {
  db,
  f1000InvitesTable,
  commandCentreSubscribersTable,
} from "@workspace/db";
import { F1000RedeemBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireSubscriptionsEnabled } from "../lib/feature-flags";

const router: IRouter = Router();

/** Total size of the First 1000 pool. */
const F1000_TOTAL = 1000;

/** F1000 members get a $49 monthly LLM-usage budget. */
const F1000_COST_CAP_USD = "49.00";

/**
 * Unredeemed `issued` codes are reclaimed back to `available` after this long,
 * so a scanner that bails on sign-up can't permanently lock a slot.
 */
const ISSUED_TTL_MS = 48 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Lightweight in-memory IP rate limiter for the public /activate endpoint.
// A single process is fine for a soft-launch; the strict 1000-row pool plus
// 48h recycling is the real abuse ceiling — this just blunts rapid scripting.
// ---------------------------------------------------------------------------
const ACTIVATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ACTIVATE_MAX_PER_WINDOW = 5;
const activateHits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function activateRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = activateHits.get(ip);
  if (!entry || now >= entry.resetAt) {
    activateHits.set(ip, { count: 1, resetAt: now + ACTIVATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= ACTIVATE_MAX_PER_WINDOW) return true;
  entry.count += 1;
  return false;
}

/**
 * Public counter for the landing page banner. Cheap aggregate; no auth.
 */
router.get("/f1000/status", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      redeemed: sql<string>`COUNT(*) FILTER (WHERE ${f1000InvitesTable.status} = 'redeemed')`,
    })
    .from(f1000InvitesTable);
  const claimed = Number(rows[0]?.redeemed ?? 0);
  const remaining = Math.max(0, F1000_TOTAL - claimed);
  res.json({ total: F1000_TOTAL, claimed, remaining, open: remaining > 0 });
});

/**
 * Hand out the next available invite code. Recycles stale `issued` codes first,
 * then atomically claims the lowest-seq `available` row with SKIP LOCKED so two
 * concurrent scanners never get the same code.
 */
router.post("/f1000/activate", requireSubscriptionsEnabled, async (req, res): Promise<void> => {
  if (activateRateLimited(clientIp(req))) {
    res.status(429).json({ error: "Too many invite requests. Try again shortly." });
    return;
  }

  // Reclaim expired issued codes (lazy GC) so the pool self-heals.
  const cutoff = new Date(Date.now() - ISSUED_TTL_MS);
  await db
    .update(f1000InvitesTable)
    .set({ status: "available", issuedAt: null })
    .where(
      and(
        eq(f1000InvitesTable.status, "issued"),
        lt(f1000InvitesTable.issuedAt, cutoff),
      ),
    );

  const claimed = await db.transaction(async (tx) => {
    const [next] = await tx
      .select()
      .from(f1000InvitesTable)
      .where(eq(f1000InvitesTable.status, "available"))
      .orderBy(asc(f1000InvitesTable.seq))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return null;
    const [updated] = await tx
      .update(f1000InvitesTable)
      .set({ status: "issued", issuedAt: new Date() })
      .where(eq(f1000InvitesTable.id, next.id))
      .returning();
    return updated ?? null;
  });

  if (!claimed) {
    res.status(410).json({
      error: "The First 1000 offer is fully claimed.",
      detail: "Every F1000 invite has been redeemed. Standard pricing applies.",
    });
    return;
  }

  res.json({
    code: claimed.code,
    seq: claimed.seq,
    signupPath: `/sign-up?invite=${encodeURIComponent(claimed.code)}`,
  });
});

/**
 * Bind an invite code to the signed-in user and unlock the offer. Idempotent:
 * a user who already redeemed any code just gets their existing seq back.
 */
router.post("/f1000/redeem", requireAuth, requireSubscriptionsEnabled, async (req, res): Promise<void> => {
  const parsed = F1000RedeemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  const code = parsed.data.code.trim();

  // Already a member? Return their bound code — one redemption per account.
  const [mine] = await db
    .select()
    .from(f1000InvitesTable)
    .where(eq(f1000InvitesTable.redeemedByUserId, userId))
    .limit(1);
  if (mine) {
    res.json({ ok: true, seq: mine.seq, alreadyRedeemed: true });
    return;
  }

  const [invite] = await db
    .select()
    .from(f1000InvitesTable)
    .where(eq(f1000InvitesTable.code, code))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "Unknown or invalid invite code." });
    return;
  }
  if (invite.status === "redeemed") {
    res.status(409).json({ error: "This invite code has already been used." });
    return;
  }

  // Bind atomically, guarding against a concurrent redeem of the same row.
  // The partial unique index on redeemed_by_user_id also rejects a second
  // concurrent redeem from the SAME user binding a different row.
  let bound: typeof invite | undefined;
  try {
    [bound] = await db
      .update(f1000InvitesTable)
      .set({
        status: "redeemed",
        redeemedAt: new Date(),
        redeemedByUserId: userId,
      })
      .where(
        and(eq(f1000InvitesTable.id, invite.id), ne(f1000InvitesTable.status, "redeemed")),
      )
      .returning();
  } catch (err) {
    // Unique violation = this user already redeemed another code concurrently.
    if ((err as { code?: string })?.code === "23505") {
      const [existing] = await db
        .select()
        .from(f1000InvitesTable)
        .where(eq(f1000InvitesTable.redeemedByUserId, userId))
        .limit(1);
      if (existing) {
        res.json({ ok: true, seq: existing.seq, alreadyRedeemed: true });
        return;
      }
    }
    throw err;
  }
  if (!bound) {
    res.status(409).json({ error: "This invite code has already been used." });
    return;
  }

  // Unlock the promo on the subscriber row: F1000 membership + $49 usage cap.
  await db
    .update(commandCentreSubscribersTable)
    .set({ f1000Member: true, monthlyCostCapUsdOverride: F1000_COST_CAP_USD })
    .where(eq(commandCentreSubscribersTable.id, req.subscriber!.id));

  req.log.info({ userId, seq: bound.seq }, "F1000 invite redeemed");
  res.json({ ok: true, seq: bound.seq, alreadyRedeemed: false });
});

export default router;
