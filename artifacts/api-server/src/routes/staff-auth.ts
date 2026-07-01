import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import {
  STAFF_COOKIE,
  accessCodeConfigured,
  ensureStaffSubscriber,
  ensureStaffUser,
  parseSession,
  serializeSession,
  slugifyHandle,
  verifyAccessCode,
} from "../lib/staff-auth";

const router: IRouter = Router();

// Brute-force guard for the shared access code: a single secret grants full
// staff access, so throttle login attempts per client IP. Only failed attempts
// count toward the window — a correct code clears the counter — so ordinary
// staff typos never lock out a legitimate device.
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function loginRateLimited(ip: string): boolean {
  const entry = loginFailures.get(ip);
  if (!entry || Date.now() >= entry.resetAt) return false;
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || now >= entry.resetAt) {
    loginFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearLoginFailures(ip: string): void {
  loginFailures.delete(ip);
}

// Hand-written schema: auth is legitimately outside the OpenAPI contract (the
// Clerk endpoints were too), so it does not flow through codegen.
const LoginBody = z.object({
  code: z.string().min(1).max(256),
  name: z.string().trim().min(1).max(120),
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    path: "/",
    maxAge: THIRTY_DAYS_MS,
  };
}

/**
 * Exchange the shared access code + a typed name for a signed session cookie.
 * The name is attribution only; the code is the sole credential.
 */
router.post("/auth/login", async (req, res): Promise<void> => {
  if (!accessCodeConfigured()) {
    res.status(503).json({
      error: "Access code not configured",
      code: "STAFF_ACCESS_NOT_CONFIGURED",
    });
    return;
  }
  const ip = clientIp(req);
  if (loginRateLimited(ip)) {
    res.status(429).json({
      error: "Too many failed attempts. Try again in a few minutes.",
      code: "STAFF_LOGIN_RATE_LIMITED",
    });
    return;
  }
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A name and access code are required" });
    return;
  }
  const { code, name } = parsed.data;
  if (!verifyAccessCode(code)) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Invalid access code" });
    return;
  }
  clearLoginFailures(ip);

  const handle = slugifyHandle(name);
  try {
    const user = await ensureStaffUser(handle, name);
    await ensureStaffSubscriber(user.id);
  } catch (err) {
    req.log.error({ err, handle }, "staff login upsert failed");
    res.status(503).json({ error: "Identity service temporarily unavailable" });
    return;
  }

  res.cookie(STAFF_COOKIE, serializeSession({ handle, name }), cookieOptions());
  res.json({ authenticated: true, name, handle });
});

/** Clear the session cookie. */
router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(STAFF_COOKIE, { path: "/" });
  res.json({ ok: true });
});

/**
 * Report the current session. Never 401s — an unauthenticated caller simply
 * gets `{ authenticated: false }` so the front-end gate can decide whether to
 * show the access-code screen. Resolves everything from the signed cookie; all
 * staff are ADMIN / INSTITUTION so no DB round-trip is needed here.
 */
router.get("/auth/session", (req, res): void => {
  const session = parseSession(req.signedCookies?.[STAFF_COOKIE]);
  if (!session) {
    res.json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    name: session.name,
    handle: session.handle,
    role: "ADMIN",
    tier: "INSTITUTION",
  });
});

export default router;
