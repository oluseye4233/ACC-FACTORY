import { createHmac, randomInt, randomUUID } from "node:crypto";
import { and, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { db, emailDeliverySettingsTable as settings, usersTable } from "@workspace/db";
import { learningEmailConfigured, sendManagedEmail, sendProviderEmail, type EmailTransport } from "@workspace/email";
import { encryptApiKey, decryptApiKey } from "./integration-crypto";
import { memberRole } from "./orgs";

export class EmailDeliveryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = typeof settings.$inferSelect;
export type EmailScope = { userId: string; organizationId?: string | null };
type Input = { mode: "MANAGED" | "OWN_PROVIDER"; provider?: "RESEND" | "POSTMARK";
  senderName?: string; fromEmail?: string; replyTo?: string; credential?: string };
const email = /^[^@\s<>\r\n]+@[^@\s<>\r\n]+\.[^@\s<>\r\n]+$/;
function scopeKey(scope: EmailScope) { return scope.organizationId ? `org:${scope.organizationId}` : `user:${scope.userId}`; }
export async function authorizeEmailScope(scope: EmailScope, write = false) {
  if (!scope.organizationId) return true;
  const role = await memberRole(scope.userId, scope.organizationId);
  if (!role) throw new EmailDeliveryError(403, "You are not a member of this organization.");
  const canManage = role === "owner" || role === "admin";
  if (write && !canManage) throw new EmailDeliveryError(403, "Only organization owners and administrators can change email delivery.");
  return canManage;
}
async function rowFor(scope: EmailScope) {
  const [row] = await db.select().from(settings).where(eq(settings.scopeKey, scopeKey(scope))).limit(1);
  return row;
}
function credentialFor(row: Row) {
  try {
    if (!row.credentialEncrypted) throw new Error("Missing");
    const value = JSON.parse(decryptApiKey(row.credentialEncrypted)) as { scopeKey: string; provider: string; credential: string };
    if (value.scopeKey !== row.scopeKey || value.provider !== row.provider || typeof value.credential !== "string" || !value.credential) throw new Error("Binding");
    return value.credential;
  } catch { throw new EmailDeliveryError(503, "Reconnect this scope's email provider before sending messages."); }
}
export async function emailDeliveryView(scope: EmailScope) {
  const canManage = await authorizeEmailScope(scope);
  const row = await rowFor(scope);
  const mode = row?.mode === "OWN_PROVIDER" ? "OWN_PROVIDER" as const : "MANAGED" as const;
  let status = mode === "MANAGED" ? learningEmailConfigured() ? "ACTIVE" : "UNCONFIGURED" : row!.status;
  if (mode === "OWN_PROVIDER" && status === "ACTIVE") {
    try { credentialFor(row!); } catch { status = "ERROR"; }
  }
  return {
    organizationId: scope.organizationId ?? null, mode, provider: row?.provider ?? null,
    senderName: row?.senderName ?? null, fromEmail: mode === "OWN_PROVIDER" ? row?.fromEmail ?? null : null,
    replyTo: row?.replyTo ?? null, status, configured: status === "ACTIVE", canManage,
    hasCredential: Boolean(row?.credentialEncrypted),
    verificationExpiresAt: row?.verificationSent ? row.verificationExpiresAt?.toISOString() ?? null : null,
    authenticationSeparate: true,
  };
}
export async function emailDeliveryReady(scope: EmailScope): Promise<boolean> {
  try { return (await emailDeliveryView(scope)).configured; } catch { return false; }
}
export async function saveEmailDelivery(scope: EmailScope, input: Input) {
  await authorizeEmailScope(scope, true);
  if ((input.senderName && /[\u0000-\u001F\u007F<>]/.test(input.senderName)) ||
      (input.replyTo && !email.test(input.replyTo))) throw new EmailDeliveryError(400, "Use a valid sender name and reply-to email.");
  const key = scopeKey(scope);
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`email-settings:${key}`}, 0))`);
    const [old] = await tx.select().from(settings).where(eq(settings.scopeKey, key)).limit(1);
    let encrypted: string | null = null;
    if (input.mode === "OWN_PROVIDER") {
      if (!input.provider || !input.fromEmail || !email.test(input.fromEmail)) throw new EmailDeliveryError(400, "Choose a provider and a valid provider-verified sender address.");
      if (input.credential) {
        if (/[^\x21-\x7E]/.test(input.credential) || input.credential.length < 8) throw new EmailDeliveryError(400, "Enter a valid provider credential.");
        encrypted = encryptApiKey(JSON.stringify({ scopeKey: key, provider: input.provider, credential: input.credential }));
      } else if (old?.provider === input.provider && old.credentialEncrypted) {
        credentialFor(old); encrypted = old.credentialEncrypted;
      } else throw new EmailDeliveryError(400, "A credential is required for this provider connection.");
    }
    const values = {
      mode: input.mode, provider: input.mode === "OWN_PROVIDER" ? input.provider! : null,
      senderName: input.senderName?.trim() || null, fromEmail: input.mode === "OWN_PROVIDER" ? input.fromEmail! : null,
      replyTo: input.replyTo || null, credentialEncrypted: encrypted,
      status: input.mode === "MANAGED" ? "ACTIVE" : "PENDING_VERIFICATION",
      revision: randomUUID(), verificationId: null, verificationHash: null, verificationUserId: null,
      verificationExpiresAt: null, verificationAttempts: 0, verificationSent: false, verifiedAt: null, updatedAt: new Date(),
    };
    await tx.insert(settings).values({ scopeKey: key, userId: scope.organizationId ? null : scope.userId,
      organizationId: scope.organizationId ?? null, ...values })
      .onConflictDoUpdate({ target: settings.scopeKey, set: values });
  });
  return emailDeliveryView(scope);
}
function transportFor(row: Row | undefined, allowUnverified = false): EmailTransport {
  if (!row || row.mode === "MANAGED") {
    return args => sendManagedEmail(args, { senderName: row?.senderName, replyTo: row?.replyTo });
  }
  if (!allowUnverified && row.status !== "ACTIVE") throw new EmailDeliveryError(503, "Verify this email provider connection before using it.");
  if (!row.fromEmail || !["RESEND", "POSTMARK"].includes(row.provider ?? "")) throw new EmailDeliveryError(503, "Email provider configuration is incomplete.");
  const key = credentialFor(row);
  return args => sendProviderEmail(row.provider as "RESEND" | "POSTMARK", key,
    { fromEmail: row.fromEmail!, senderName: row.senderName, replyTo: row.replyTo }, args);
}
export async function emailTransport(scope: EmailScope): Promise<EmailTransport> {
  await authorizeEmailScope(scope);
  const row = await rowFor(scope);
  if ((!row || row.mode === "MANAGED") && !learningEmailConfigured()) throw new EmailDeliveryError(503, "Platform email is unavailable. Configure a verified subscriber-owned provider or contact your administrator.");
  return transportFor(row);
}
export function scopedEmailTransport(scope: EmailScope): EmailTransport {
  return async args => {
    try { return await (await emailTransport(scope))(args); }
    catch { return { ok: false, error: "This scope's email delivery is unavailable; no alternate sender was used." }; }
  };
}
function verificationHash(scope: EmailScope, id: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new EmailDeliveryError(503, "Email verification is unavailable.");
  return createHmac("sha256", secret).update(`email-settings:${scopeKey(scope)}:${scope.userId}:${id}:${code}`).digest("hex");
}
export async function testEmailDelivery(scope: EmailScope) {
  await authorizeEmailScope(scope, true);
  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, scope.userId)).limit(1);
  if (!user?.email || !email.test(user.email)) throw new EmailDeliveryError(409, "Your authenticated profile needs a valid email address.");
  const id = randomUUID(), code = String(randomInt(0, 1_000_000)).padStart(6, "0"), expires = new Date(Date.now() + 600_000);
  const key = scopeKey(scope), hash = verificationHash(scope, id, code);
  const row = await db.transaction(async tx => {
    // A subscriber cannot multiply the test allowance by creating/changing org scopes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`email-tests:${scope.userId}`}, 0))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`email-settings:${key}`}, 0))`);
    const personalKey = `user:${scope.userId}`;
    if (scope.organizationId) {
      await tx.insert(settings).values({ scopeKey: personalKey, userId: scope.userId }).onConflictDoNothing();
      const [personal] = await tx.select().from(settings).where(eq(settings.scopeKey, personalKey)).limit(1);
      const currentWindow = personal!.testWindowStart && Date.now() - personal!.testWindowStart.getTime() < 900_000;
      if (currentWindow && personal!.testCount >= 3) throw new EmailDeliveryError(429, "Wait before requesting another delivery test.");
      await tx.update(settings).set({ testCount: currentWindow ? personal!.testCount + 1 : 1,
        testWindowStart: currentWindow ? personal!.testWindowStart : new Date() }).where(eq(settings.scopeKey, personalKey));
    }
    await tx.insert(settings).values({ scopeKey: key, userId: scope.organizationId ? null : scope.userId,
      organizationId: scope.organizationId ?? null }).onConflictDoNothing();
    const [old] = await tx.select().from(settings).where(eq(settings.scopeKey, key)).limit(1);
    const inWindow = old!.testWindowStart && Date.now() - old!.testWindowStart.getTime() < 900_000;
    if (inWindow && old!.testCount >= 3) throw new EmailDeliveryError(429, "Wait before requesting another delivery test.");
    const [updated] = await tx.update(settings).set({
      verificationId: id, verificationHash: old!.mode === "OWN_PROVIDER" ? hash : null,
      verificationUserId: scope.userId, verificationExpiresAt: old!.mode === "OWN_PROVIDER" ? expires : null,
      verificationSent: false, verificationAttempts: 0, status: old!.mode === "OWN_PROVIDER" ? "PENDING_VERIFICATION" : "ACTIVE",
      testCount: inWindow ? old!.testCount + 1 : 1, testWindowStart: inWindow ? old!.testWindowStart : new Date(), updatedAt: new Date(),
    }).where(eq(settings.scopeKey, key)).returning();
    return updated!;
  });
  const text = row.mode === "OWN_PROVIDER"
    ? `Confirm your email delivery connection.\nCode: ${code}\nExpires in 10 minutes. This is not a sign-in or publication code.`
    : "Your platform-managed email delivery test. This does not change your sign-in or notification preferences.";
  const result = await transportFor(row, true)({ to: user.email, subject: "ATANDA — email delivery verification", text,
    html: `<p>${text.replace(/\n/g, "<br/>")}</p>`, idempotencyKey: `email-settings-${id}` });
  if (!result.ok || result.dryRun) {
    await db.update(settings).set({ verificationHash: null, verificationExpiresAt: null, verificationSent: false })
      .where(and(eq(settings.scopeKey, key), eq(settings.verificationId, id)));
    throw new EmailDeliveryError(503, "Email acceptance was not confirmed. Check your provider's sender verification and connection; no fallback was used.");
  }
  const [confirmed] = await db.update(settings).set({ verificationSent: true })
    .where(and(eq(settings.scopeKey, key), eq(settings.verificationId, id), eq(settings.revision, row.revision))).returning();
  if (!confirmed) throw new EmailDeliveryError(409, "Settings changed during the test. Request a new code.");
  return { message: row.mode === "OWN_PROVIDER" ? "Enter the code delivered to your authenticated account email to activate this connection."
    : "Test message accepted for delivery to your authenticated account email.", expiresAt: row.mode === "OWN_PROVIDER" ? expires.toISOString() : null };
}
export async function verifyEmailDelivery(scope: EmailScope, code: string) {
  await authorizeEmailScope(scope, true);
  const row = await rowFor(scope);
  if (!row?.verificationId) throw new EmailDeliveryError(403, "No current verification code.");
  const hash = verificationHash(scope, row.verificationId, code);
  const [updated] = await db.update(settings).set({
    verificationAttempts: sql`${settings.verificationAttempts} + 1`,
    status: sql`CASE WHEN ${settings.verificationHash} = ${hash} THEN 'ACTIVE' ELSE ${settings.status} END`,
    verificationHash: sql`CASE WHEN ${settings.verificationHash} = ${hash} OR ${settings.verificationAttempts} >= 4 THEN NULL ELSE ${settings.verificationHash} END`,
    verifiedAt: sql`CASE WHEN ${settings.verificationHash} = ${hash} THEN now() ELSE ${settings.verifiedAt} END`,
  }).where(and(eq(settings.scopeKey, scopeKey(scope)), eq(settings.revision, row.revision),
    eq(settings.verificationId, row.verificationId), eq(settings.verificationUserId, scope.userId),
    eq(settings.verificationSent, true), isNotNull(settings.verificationHash),
    gt(settings.verificationExpiresAt, new Date()), lt(settings.verificationAttempts, 5))).returning();
  if (!updated || updated.status !== "ACTIVE") throw new EmailDeliveryError(403, "Invalid, expired, replaced or exhausted verification code.");
  return emailDeliveryView(scope);
}
