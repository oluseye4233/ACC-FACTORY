import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, magnetSessionsTable, usersTable, type MagnetSession } from "@workspace/db";

/**
 * Shared plumbing for the anonymous, pre-auth acquisition magnets (D25).
 *
 * The two magnet tools (Test Kit, Savings Calculator) run WITHOUT a signed-in
 * user. This module supplies the pieces the authenticated engine path normally
 * gets for free: a stable system user to attribute LLM spend to (so the
 * company-wide cost cap still sees it), a per-IP/email rate limiter, and the
 * telemetry writes for the `magnet_sessions` store.
 */

/** Sentinel engine ids for magnet LLM spend in `harness_engine_runs`. */
export const MAGNET_TEST_KIT_ENGINE_ID = 25;
export const MAGNET_CALCULATOR_ENGINE_ID = 26;

/** Synthetic clerk id for the magnet system user (satisfies the NOT NULL + UNIQUE). */
const MAGNET_SYSTEM_CLERK_ID = "system:magnet";

let cachedSystemUserId: string | null = null;

/**
 * Lazily upsert (and cache) a single system user that owns all magnet LLM runs.
 * `harness_engine_runs.user_id` is NOT NULL, so anonymous magnet spend needs a
 * real user row to attribute to. This user carries no subscriber and never logs
 * in — it exists only so magnet cost is tallied by the global monthly cost cap.
 */
export async function ensureMagnetSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;
  const [row] = await db
    .insert(usersTable)
    .values({
      clerkUserId: MAGNET_SYSTEM_CLERK_ID,
      email: null,
      displayName: "Magnet System",
      role: "USER",
    })
    .onConflictDoUpdate({
      target: usersTable.clerkUserId,
      set: { displayName: "Magnet System" },
    })
    .returning();
  if (row) {
    cachedSystemUserId = row.id;
    return row.id;
  }
  const reread = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, MAGNET_SYSTEM_CLERK_ID))
    .limit(1);
  cachedSystemUserId = reread[0]!.id;
  return cachedSystemUserId;
}

/** First hop of `x-forwarded-for` (proxy) else the socket address. */
export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/** One-way hash of the client IP — we store this, never the raw address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

// ─── Rate limiting ────────────────────────────────────────────────────────
// Sliding-window, in-memory, 5 requests / hour, keyed by IP AND (if present)
// email. In-memory (per-process) is deliberate and matches the existing staff
// brute-force guard: a magnet is a low-stakes public tool, and a process
// restart clearing the window is acceptable.

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5;
const hits = new Map<string, number[]>();

function pruned(key: string, now: number): number[] {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.set(key, arr);
  return arr;
}

/**
 * Express middleware: reject with 429 when either the caller's IP or their
 * typed email has already made 5 magnet requests in the last hour. Records a
 * hit against every key only when the request is admitted. Reads `req.body`
 * (email), so it must mount AFTER the JSON body parser — which it does, since
 * the app parses JSON app-wide before the `/api` router.
 */
export function magnetRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const email =
    typeof req.body?.email === "string" && req.body.email.trim().length > 0
      ? req.body.email.trim().toLowerCase()
      : null;
  const keys = [`ip:${clientIp(req)}`];
  if (email) keys.push(`email:${email}`);

  for (const key of keys) {
    if (pruned(key, now).length >= RATE_MAX) {
      const oldest = Math.min(...hits.get(key)!);
      const retryAfterSec = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "You've reached the limit of 5 free checks per hour. Try again later.",
        code: "MAGNET_RATE_LIMITED",
      });
      return;
    }
  }
  for (const key of keys) {
    hits.get(key)!.push(now);
  }
  next();
}

/** Test-only: clear the in-memory rate-limit ledger. */
export function _resetMagnetRateLimit(): void {
  hits.clear();
}

// ─── Telemetry ──────────────────────────────────────────────────────────────

export interface MagnetSessionInsert {
  tool: "test_kit" | "calculator";
  ipHash: string;
  email: string | null;
  inputChars: number;
  band?: string | null;
  savingsLowPct?: number | null;
  savingsHighPct?: number | null;
  compressionClass?: string | null;
  rawScore?: number | null;
  provider?: string | null;
}

/**
 * Persist a magnet telemetry row. NOTE: the submitted text is intentionally
 * NOT stored (ephemeral by design) — only its length, an IP hash, and the
 * coarse outcome. The authoritative LLM cost lives in `harness_engine_runs`
 * (attributed to the magnet system user); `cost_usd` here stays at its default.
 */
export async function recordMagnetSession(input: MagnetSessionInsert): Promise<MagnetSession> {
  const [row] = await db.insert(magnetSessionsTable).values(input).returning();
  return row!;
}

/**
 * Flag a magnet session as converted (visitor clicked through to the staff
 * front door). Idempotent: a second call keeps the original `convertedAt`.
 */
export async function markMagnetConverted(id: string): Promise<boolean> {
  const rows = await db
    .update(magnetSessionsTable)
    .set({ converted: true, convertedAt: new Date() })
    .where(eq(magnetSessionsTable.id, id))
    .returning({ id: magnetSessionsTable.id });
  return rows.length > 0;
}
