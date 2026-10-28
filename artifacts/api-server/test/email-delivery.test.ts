import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, usersTable, organizationsTable, organizationMembersTable, emailDeliverySettingsTable as settings,
  harnessSessionsTable, harnessArtifactsTable, portalPublicationsTable, portalChallengesTable } from "@workspace/db";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), managed: vi.fn(), provider: vi.fn() }));
vi.mock("@workspace/email", async original => ({
  ...await original<typeof import("@workspace/email")>(),
  learningEmailConfigured: mocks.configured, sendManagedEmail: mocks.managed, sendProviderEmail: mocks.provider,
}));
const objects = new Map<string, Buffer>();
vi.mock("../src/lib/artifact-operations/pdf-font", () => ({ documentPdfFont: async () => "Helvetica" }));
vi.mock("../src/lib/artifact-operations/private-storage", () => ({
  savePrivate: async (key: string, bytes: Buffer) => {
    objects.set(key, bytes); return { key, hash: createHash("sha256").update(bytes).digest("hex"), size: bytes.length };
  },
  readPrivate: async (key: string) => objects.get(key)!,
  fileHash: (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex"), deletePrivate: vi.fn(),
}));
import { emailDeliveryReady, emailDeliveryView, emailTransport, saveEmailDelivery,
  scopedEmailTransport, testEmailDelivery, verifyEmailDelivery } from "../src/lib/email-delivery";
import { issuePublicationCode, preparePublication, redeemPublication } from "../src/lib/imprima-portal";
import { sendHighCostRunAlert } from "@workspace/email";

let ids: string[], orgId: string, sessionId: string, sourceId: string, subscriberEmail: string;
const own = { mode: "OWN_PROVIDER" as const, provider: "RESEND" as const, fromEmail: "verified@example.test", credential: "synthetic-mail-test-credential" };
const scope = () => ({ userId: ids[0]! });
const org = (index = 0) => ({ userId: ids[index]!, organizationId: orgId });
const lastCode = () => String(mocks.provider.mock.calls.at(-1)![3].text).match(/\b[0-9]{6}\b/)![0];
const message = { to: "recipient@example.test", subject: "Synthetic test", text: "Synthetic test", html: "<p>Synthetic test</p>" };
async function activate(target = scope()) {
  await saveEmailDelivery(target, own); await testEmailDelivery(target); await verifyEmailDelivery(target, lastCode());
}
beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", "synthetic-email-settings-test-key-not-production");
  ids = [];
  for (let i = 0; i < 4; i++) {
    const [user] = await db.insert(usersTable).values({ clerkUserId: `mail-settings-${randomUUID()}`, email: `mail-${randomUUID()}@example.test` }).returning();
    ids.push(user!.id); if (i === 0) subscriberEmail = user!.email!;
  }
  const [organization] = await db.insert(organizationsTable).values({ name: "Synthetic Mail Organization", slug: `mail-${randomUUID()}`, createdByUserId: ids[0]! }).returning();
  orgId = organization!.id;
  await db.insert(organizationMembersTable).values([
    { organizationId: orgId, userId: ids[0]!, role: "owner" }, { organizationId: orgId, userId: ids[1]!, role: "admin" },
    { organizationId: orgId, userId: ids[2]!, role: "member" },
  ]);
  const [session] = await db.insert(harnessSessionsTable).values({ userId: ids[0]!, sessionName: "Synthetic Mail Publication" }).returning();
  sessionId = session!.id;
  const [artifact] = await db.insert(harnessArtifactsTable).values({ userId: ids[0]!, sessionId, featureId: 5,
    artifactType: "SPC", name: "Synthetic Mail Publication — SPC", artifactContent: { text: "Bounded synthetic publication used only in automated tests." } }).returning();
  sourceId = artifact!.id;
});
beforeEach(async () => {
  mocks.configured.mockReset().mockReturnValue(false);
  mocks.managed.mockReset().mockResolvedValue({ ok: true, id: "synthetic-managed-id" });
  mocks.provider.mockReset().mockResolvedValue({ ok: true, id: "synthetic-provider-id" });
  await db.delete(settings).where(inArray(settings.scopeKey, [...ids.map(id => `user:${id}`), `org:${orgId}`]));
  await db.update(harnessSessionsTable).set({ orgId: null, orgVisible: false }).where(eq(harnessSessionsTable.id, sessionId));
  await db.insert(organizationMembersTable).values({ organizationId: orgId, userId: ids[0]!, role: "owner" }).onConflictDoNothing();
});
afterAll(async () => {
  if (ids?.length) {
    await db.delete(portalChallengesTable).where(inArray(portalChallengesTable.userId, ids));
    await db.delete(portalPublicationsTable).where(inArray(portalPublicationsTable.userId, ids));
    await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, sessionId));
    await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, sessionId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
  }
  vi.unstubAllEnvs();
});
describe("subscriber-scoped email delivery", () => {
  it("defaults to managed delivery and does not claim absent infrastructure is configured", async () => {
    expect(await emailDeliveryView(scope())).toMatchObject({ mode: "MANAGED", configured: false, status: "UNCONFIGURED", authenticationSeparate: true });
    await expect(emailTransport(scope())).rejects.toMatchObject({ status: 503 });
    mocks.configured.mockReturnValue(true);
    expect(await emailDeliveryReady(scope())).toBe(true);
  });
  it("encrypts scope-bound credentials and never returns credentials or verification hashes", async () => {
    const view = await saveEmailDelivery(scope(), own);
    expect(view).toMatchObject({ configured: false, status: "PENDING_VERIFICATION", hasCredential: true });
    expect(JSON.stringify(view)).not.toContain(own.credential);
    expect(view).not.toHaveProperty("credentialEncrypted");
    expect(view).not.toHaveProperty("verificationHash");
    const [row] = await db.select().from(settings).where(eq(settings.scopeKey, `user:${ids[0]}`));
    expect(row!.credentialEncrypted).toMatch(/^enc:/);
    expect(row!.credentialEncrypted).not.toContain(own.credential);
    await expect(emailTransport(scope())).rejects.toMatchObject({ status: 503 });
  });
  it("retains a hidden key only for the same provider and re-verifies changed settings", async () => {
    await activate();
    const { credential: _credential, ...withoutCredential } = own;
    expect(await saveEmailDelivery(scope(), withoutCredential)).toMatchObject({ status: "PENDING_VERIFICATION", hasCredential: true });
    await expect(saveEmailDelivery(scope(), { ...withoutCredential, provider: "POSTMARK" })).rejects.toMatchObject({ status: 400 });
  });
  it("runs publication OTP, mandatory control copy and download through a verified own provider without global email", async () => {
    await activate();
    const publication = await preparePublication(ids[0]!, { sourceType: "ARTIFACT", sourceId, format: "PDF", author: "Synthetic Author", rightsConfirmed: true });
    expect(publication.emailConfigured).toBe(true);
    const challenge = await issuePublicationCode(ids[0]!, publication.id);
    expect(mocks.provider.mock.calls.at(-1)![3].to).toBe(subscriberEmail);
    const output = await redeemPublication(ids[0]!, publication.id, { challengeId: challenge.challengeId, code: lastCode() });
    expect(output.bytes.length).toBeGreaterThan(100);
    const copy = mocks.provider.mock.calls.at(-1)![3];
    expect(copy.to).not.toBe(subscriberEmail);
    expect(copy.attachments).toHaveLength(1);
    expect(Buffer.from(copy.attachments[0].content, "base64")).toEqual(output.bytes);
    expect(mocks.managed).not.toHaveBeenCalled();
  });
  it("keeps failed provider verification closed with no managed fallback", async () => {
    await saveEmailDelivery(scope(), own);
    mocks.provider.mockResolvedValueOnce({ ok: false, error: "Synthetic refusal" });
    await expect(testEmailDelivery(scope())).rejects.toMatchObject({ status: 503 });
    expect(await emailDeliveryView(scope())).toMatchObject({ configured: false, verificationExpiresAt: null });
    expect(mocks.managed).not.toHaveBeenCalled();
  });
  it("limits tests across configuration revisions and both delivery modes", async () => {
    mocks.configured.mockReturnValue(true);
    await saveEmailDelivery(scope(), own);
    for (let i = 0; i < 3; i++) await testEmailDelivery(scope());
    await saveEmailDelivery(scope(), { mode: "MANAGED" });
    await expect(testEmailDelivery(scope())).rejects.toMatchObject({ status: 429 });
    expect(mocks.managed).not.toHaveBeenCalled();
  });
  it("allows organization admins to manage, members to view, and excludes nonmembers", async () => {
    await saveEmailDelivery(org(1), own);
    expect(await emailDeliveryView(org(2))).toMatchObject({ canManage: false, hasCredential: true, configured: false });
    await expect(saveEmailDelivery(org(2), own)).rejects.toMatchObject({ status: 403 });
    await expect(testEmailDelivery(org(2))).rejects.toMatchObject({ status: 403 });
    await expect(emailDeliveryView(org(3))).rejects.toMatchObject({ status: 403 });
  });
  it("does not allow test rate limits to be bypassed by changing organization scopes", async () => {
    await saveEmailDelivery(org(), own);
    for (let i = 0; i < 3; i++) await testEmailDelivery(org());
    mocks.configured.mockReturnValue(true);
    await expect(testEmailDelivery(scope())).rejects.toMatchObject({ status: 429 });
    expect(mocks.managed).not.toHaveBeenCalled();
  });
  it("binds a verification code to the administrator who received it", async () => {
    await saveEmailDelivery(org(), own); await testEmailDelivery(org()); const code = lastCode();
    await expect(verifyEmailDelivery(org(1), code)).rejects.toMatchObject({ status: 403 });
    expect(await verifyEmailDelivery(org(), code)).toMatchObject({ configured: true });
    await expect(verifyEmailDelivery(org(), code)).rejects.toMatchObject({ status: 403 });
  });
  it("locks five wrong attempts and rejects expired codes", async () => {
    await saveEmailDelivery(scope(), own); await testEmailDelivery(scope()); const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyEmailDelivery(scope(), wrong)).rejects.toMatchObject({ status: 403 });
    await expect(verifyEmailDelivery(scope(), code)).rejects.toMatchObject({ status: 403 });
    await testEmailDelivery(scope()); const nextCode = lastCode();
    await db.update(settings).set({ verificationExpiresAt: new Date(Date.now() - 1000) }).where(eq(settings.scopeKey, `user:${ids[0]}`));
    await expect(verifyEmailDelivery(scope(), nextCode)).rejects.toMatchObject({ status: 403 });
  });
  it("invalidates an in-flight verification when settings change", async () => {
    await saveEmailDelivery(scope(), own);
    let release!: (result: { ok: boolean; id: string }) => void;
    mocks.provider.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = testEmailDelivery(scope());
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const oldCode = lastCode();
    await saveEmailDelivery(scope(), { ...own, senderName: "Changed synthetic sender" });
    release({ ok: true, id: "synthetic-delayed-id" });
    await expect(pending).rejects.toMatchObject({ status: 409 });
    await expect(verifyEmailDelivery(scope(), oldCode)).rejects.toMatchObject({ status: 403 });
    expect(await emailDeliveryReady(scope())).toBe(false);
  });
  it("rejects ciphertext copied from another subscriber's scope", async () => {
    await activate();
    const [row] = await db.select().from(settings).where(eq(settings.scopeKey, `user:${ids[0]}`));
    await db.insert(settings).values({ scopeKey: `user:${ids[3]}`, userId: ids[3]!, mode: "OWN_PROVIDER",
      provider: "RESEND", fromEmail: own.fromEmail, credentialEncrypted: row!.credentialEncrypted, status: "ACTIVE" });
    const other = { userId: ids[3]! };
    expect(await emailDeliveryView(other)).toMatchObject({ status: "ERROR", configured: false });
    await expect(emailTransport(other)).rejects.toMatchObject({ status: 503 });
  });
  it("binds visible-organization publications and blocks sending after membership is revoked", async () => {
    await activate(org());
    await db.update(harnessSessionsTable).set({ orgId, orgVisible: true }).where(eq(harnessSessionsTable.id, sessionId));
    const input = { sourceType: "ARTIFACT" as const, sourceId, format: "PDF" as const, author: "Synthetic Author", rightsConfirmed: true };
    await expect(preparePublication(ids[0]!, { ...input, organizationId: null })).rejects.toMatchObject({ status: 403 });
    const publication = await preparePublication(ids[0]!, input);
    expect(publication).toMatchObject({ organizationId: orgId, emailConfigured: true });
    await db.delete(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId, orgId), eq(organizationMembersTable.userId, ids[0]!)));
    await expect(issuePublicationCode(ids[0]!, publication.id)).rejects.toMatchObject({ status: 403 });
  });
  it("uses an explicitly chosen managed sender and clears retained provider credentials", async () => {
    await activate(); mocks.configured.mockReturnValue(true);
    await saveEmailDelivery(scope(), { mode: "MANAGED", senderName: "Synthetic Subscriber", replyTo: "reply@example.test" });
    await (await emailTransport(scope()))(message);
    expect(mocks.managed).toHaveBeenCalledWith(message, { senderName: "Synthetic Subscriber", replyTo: "reply@example.test" });
    expect(await emailDeliveryView(scope())).toMatchObject({ configured: true, hasCredential: false, provider: null });
  });
  it("routes existing subscriber alert templates without silent fallback", async () => {
    await activate();
    mocks.provider.mockResolvedValueOnce({ ok: false, error: "Synthetic provider failure" });
    const result = await sendHighCostRunAlert({ delivery: scopedEmailTransport(scope()), to: subscriberEmail,
      orgName: "Synthetic organization", actorEmail: subscriberEmail, engineId: 8, sessionId, costUsd: 5, thresholdUsd: 1,
      occurredAt: new Date(), activityUrl: "https://example.test/activity", unsubscribeUrl: "https://example.test/unsubscribe" });
    expect(result.ok).toBe(false);
    expect(mocks.managed).not.toHaveBeenCalled();
  });
});
