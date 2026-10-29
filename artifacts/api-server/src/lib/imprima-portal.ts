import { buildArtifactFilename } from "@workspace/artifact-naming";
import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, gt, sql, inArray } from "drizzle-orm";
import { db, portalPublicationsTable as publications, portalChallengesTable as challenges,
  harnessArtifactsTable as artifacts, exemplarLibraryItemsTable as library, usersTable,
  spcPlayerDraftRunsTable as drafts, spcPlayerRunsTable as executions, imprimaFilesTable as legacyFiles,
  harnessSessionsTable as sessions } from "@workspace/db";
import { sendPublicationMessage } from "@workspace/email";
import { authorizeEmailScope, emailDeliveryReady, emailTransport } from "./email-delivery";
import { governanceHash } from "./artifact-governance";
import { readPrivate, savePrivate } from "./artifact-operations/private-storage";
import { CreatorError } from "./agent-creator";
import { publicationZip, renderPortalPdf, type PublicationDocument } from "./imprima-portal-render";
import { resolvePortalSource, portalActor, type PortalSourceInput } from "./imprima-portal-sources";
import { withOperationsActor } from "./artifact-operations/context";

export const publicationCodeHash = (id: string, userId: string, publicationId: string, code: string) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new CreatorError(503, "Publication code security is not configured.");
  return createHmac("sha256", secret).update(`${id}:${userId}:${publicationId}:${code}`).digest("hex");
};
const view = async (row: typeof publications.$inferSelect) => ({
  organizationId: row.organizationId,
  emailConfigured: await emailDeliveryReady({ userId: row.userId, organizationId: row.organizationId }),
  id: row.id, sourceId: row.sourceId, sourceType: row.sourceType, title: row.title,
  author: row.author, format: row.format, state: row.state, filename: row.filename, createdAt: row.createdAt.toISOString(),
});
async function ownedPublication(userId: string, id: string) {
  const [row] = await db.select().from(publications).where(and(eq(publications.id, id), eq(publications.userId, userId))).limit(1);
  if (!row) throw new CreatorError(404, "Publication not found.");
  return row;
}
async function subscriberEmail(userId: string) {
  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email)) throw new CreatorError(409, "Your subscriber profile needs a valid email address before publication.");
  return user.email;
}
export async function portalWorkspace(userId: string, organizationId?: string | null) {
  await authorizeEmailScope({ userId, organizationId });
  const [sourceRows, libraryRows, history, playerRows, preparationRows] = await Promise.all([
    db.select({ id: artifacts.id, title: artifacts.name, type: artifacts.artifactType, sessionId: artifacts.sessionId,
      parentSourceArtifactId: sql<string | null>`${artifacts.artifactContent}->>'sourceArtifactId'`,
      organizationId: sql<string | null>`CASE WHEN ${sessions.orgVisible} THEN ${sessions.orgId} ELSE NULL END` })
      .from(artifacts).leftJoin(sessions, and(eq(sessions.id, artifacts.sessionId), eq(sessions.userId, userId)))
      .where(eq(artifacts.userId, userId)).orderBy(desc(artifacts.createdAt)).limit(500),
    db.select({ id: library.id, title: library.title, type: library.kind }).from(library)
      .where(and(eq(library.ownerUserId, userId), eq(library.active, true))).limit(500),
    db.select().from(publications).where(eq(publications.userId, userId)).orderBy(desc(publications.createdAt)).limit(100),
    db.select({ id: drafts.id, title: drafts.title, sessionId: drafts.originSessionId })
      .from(drafts).innerJoin(executions, eq(executions.id, drafts.id))
      .where(and(eq(drafts.ownerUserId, userId), eq(executions.userId, userId), eq(executions.status, "completed"))).limit(100),
    db.select().from(artifacts).where(and(eq(artifacts.userId, userId),
      inArray(artifacts.artifactType, ["IMPRIMA_PREPARATION", "SHORT_SPRINT_PREPARATION"]))).limit(100),
  ]);
  let protectedSourcesStatus = "AVAILABLE";
  const protectedSources = await withOperationsActor(await portalActor(userId), async tx => tx
    .select({ id: legacyFiles.id, title: legacyFiles.filename }).from(legacyFiles)
    .where(eq(legacyFiles.userId, userId)).limit(100))
    .catch(() => { protectedSourcesStatus = "UNAVAILABLE_PROTECTED_WORKFLOWS"; return []; });
  const preparationSources = preparationRows.flatMap(row => {
    const files = (row.artifactContent as { files?: { id: string; filename: string }[] }).files;
    return Array.isArray(files) ? files.slice(0, 100).map(file => ({
      id: file.id, title: file.filename, type: "Private preparation file", sourceType: "PREPARATION_FILE",
      sessionId: row.sessionId, parentId: row.id, kind: row.artifactType === "IMPRIMA_PREPARATION" ? "imprima" : "short-sprints",
    })) : [];
  });
  return {
    emailConfigured: await emailDeliveryReady({ userId, organizationId }), storageConfigured: Boolean(process.env.PRIVATE_OBJECT_DIR),
    subscriberEmailAvailable: await subscriberEmail(userId).then(() => true, () => false),
    protectedSourcesStatus,
    sources: [
      ...sourceRows.filter(row => !["IMPRIMA_PREPARATION", "SHORT_SPRINT_PREPARATION"].includes(row.type))
        .map(row => ({ ...row, title: row.title ?? `${row.type} · ${row.id.slice(0, 8)}`, sourceType: "ARTIFACT" })),
      ...libraryRows.map(row => ({ ...row, sessionId: null, sourceType: "EXEMPLAR" })),
      ...playerRows.map(row => ({ ...row, type: "SPC Player synthesis", sourceType: "SPC_PLAYER" })),
      ...protectedSources.map(row => ({ ...row, type: "Historical IMPRIMA file", sourceType: "IMPRIMA_FILE", sessionId: null })),
      ...preparationSources,
    ],
    publications: await Promise.all(history.map(view)),
  };
}
export async function preparePublication(userId: string, input: PortalSourceInput & {
  format: "PDF" | "EDITABLE_ZIP"; author: string; rightsConfirmed: boolean;
}) {
  if (!input.rightsConfirmed) throw new CreatorError(400, "Confirm that you are authorized to publish this material.");
  const { content, title, native, artifactKind, sessionId } = await resolvePortalSource(userId, input);
  const [sourceSession] = sessionId ? await db.select({ organizationId: sessions.orgId, visible: sessions.orgVisible })
    .from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1) : [];
  if (sessionId && !sourceSession) throw new CreatorError(404, "The source session is not available to this subscriber.");
  const requiredOrg = sourceSession?.visible ? sourceSession.organizationId : null;
  if (requiredOrg && input.organizationId !== undefined && input.organizationId !== requiredOrg) {
    throw new CreatorError(403, "This organization-visible source must use its organization's email context.");
  }
  const organizationId = requiredOrg ?? input.organizationId ?? null;
  await authorizeEmailScope({ userId, organizationId });
  if (native && input.format !== "EDITABLE_ZIP") throw new CreatorError(400, "Use Editable ZIP for this source so the original file is preserved unchanged alongside the stamped publication document.");
  const serialized = JSON.stringify(content);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk_live_|sk-[A-Za-z0-9_-]{20}|ghp_[A-Za-z0-9]{20}|AKIA[A-Z0-9]{16})/.test(serialized)) {
    throw new CreatorError(409, "Possible credentials or private key material detected. Create a reviewed, sanitized source version before publication.");
  }
  const id = randomUUID(), createdAt = new Date(), sourceHash = governanceHash(native
    ? { content, originalHash: createHash("sha256").update(native.bytes).digest("hex") } : content);
  const document: PublicationDocument = { id, title, content, createdAt, sourceHash, sourceType: input.sourceType,
    author: input.author.trim(), subscriberStamp: createHash("sha256").update(userId).digest("hex").slice(0, 16),
    ...(native ? { native } : {}), ...(artifactKind ? { artifactKind } : {}) };
  if (!document.author) throw new CreatorError(400, "Author name is required.");
  const pdf = await renderPortalPdf(document);
  const bytes = input.format === "PDF" ? pdf : publicationZip(document, pdf);
  const mime = input.format === "PDF" ? "application/pdf" : "application/zip";
  const filename = buildArtifactFilename({ type: "IMPRIMA_PUBLICATION", title, id,
    extension: input.format === "PDF" ? "pdf" : "zip" });
  const storageKey = `imprima-portal/${id}`;
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`portal-prepare:${userId}`}, 0))`);
    const recent = await tx.select({ id: publications.id }).from(publications).where(and(
      eq(publications.userId, userId), gt(publications.createdAt, new Date(Date.now() - 5 * 60_000)))).limit(10);
    if (recent.length >= 10) throw new CreatorError(429, "Wait before preparing more publications.");
    await tx.insert(publications).values({
      organizationId,
    id, userId, sourceType: input.sourceType, sourceId: input.sourceId, sourceHash, title,
    author: document.author, format: input.format, filename, mime, storageKey, createdAt,
    editorial: { layout: "Structured headings, source provenance, declared authorship, publisher, page numbering and bottom-right time stamp",
      basis: "Deterministic KLARITY/SKRIBE-oriented layout; not independent SPC certification", rightsDeclared: true },
    });
  });
  try {
    const stored = await savePrivate(storageKey, bytes, mime);
    const [saved] = await db.update(publications).set({ state: "READY", contentHash: stored.hash }).where(eq(publications.id, id)).returning();
    return view(saved!);
  } catch (err) {
    await db.update(publications).set({ state: "FAILED" }).where(eq(publications.id, id));
    throw err;
  }
}
export async function issuePublicationCode(userId: string, publicationId: string) {
  const publication = await ownedPublication(userId, publicationId);
  const delivery = await emailTransport({ userId, organizationId: publication.organizationId });
  if (publication.state !== "READY") throw new CreatorError(409, "The publication is not ready.");
  const to = await subscriberEmail(userId);
  const id = randomUUID(), code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const codeHash = publicationCodeHash(id, userId, publicationId, code);
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`publication-code:${userId}`}, 0))`);
    const recent = await tx.select({ id: challenges.id }).from(challenges)
      .where(and(eq(challenges.userId, userId), gt(challenges.createdAt, new Date(Date.now() - 15 * 60_000)))).limit(3);
    if (recent.length >= 3) throw new CreatorError(429, "Wait before requesting more publication codes.");
    await tx.update(challenges).set({ state: "SUPERSEDED" }).where(and(eq(challenges.userId, userId),
      eq(challenges.publicationId, publicationId), inArray(challenges.state, ["ISSUED", "PENDING_EMAIL"])));
    await tx.insert(challenges).values({ id, userId, publicationId, codeHash, expiresAt });
  });
  const result = await sendPublicationMessage({
    to, subject: "Your single-use ATANDA.IMPRIMA publication code",
    text: `Publication: ${publication.title}\nPublication ID: ${publicationId}\nCode: ${code}\nExpires: ${expiresAt.toISOString()}\nThis code permits one download of this publication by your subscriber profile. Do not share it.`,
    idempotencyKey: `imprima-code-${id}`,
  }, delivery);
  if (!result.ok || result.dryRun) {
    await db.update(challenges).set({ state: "EMAIL_FAILED" }).where(eq(challenges.id, id));
    throw new CreatorError(503, "The publication code email was not confirmed. No download is authorized.");
  }
  const [issued] = await db.update(challenges).set({ state: "ISSUED", issuedAt: new Date() })
    .where(and(eq(challenges.id, id), eq(challenges.state, "PENDING_EMAIL"))).returning();
  if (!issued) throw new CreatorError(409, "Publication code issuance was not confirmed.");
  return { challengeId: id, expiresAt: expiresAt.toISOString() };
}
export async function redeemPublication(userId: string, publicationId: string, input: { challengeId: string; code: string; testCopyEmail?: string }) {
  const publication = await ownedPublication(userId, publicationId);
  const testCopyEmail = input.testCopyEmail?.trim();
  if (testCopyEmail !== undefined && (testCopyEmail.length > 254 || !/^[^@\s<>\r\n]+@[^@\s<>\r\n]+\.[^@\s<>\r\n]+$/.test(testCopyEmail))) {
    throw new CreatorError(400, "Enter one valid test-copy email address.");
  }
  const delivery = await emailTransport({ userId, organizationId: publication.organizationId });
  if (publication.state !== "READY" || !publication.contentHash) throw new CreatorError(409, "Publication is not ready.");
  const hash = publicationCodeHash(input.challengeId, userId, publicationId, input.code);
  const [claimed] = await db.update(challenges).set({
    attempts: sql`${challenges.attempts} + 1`,
    state: sql`CASE WHEN ${challenges.codeHash} = ${hash} THEN 'CLAIMED' WHEN ${challenges.attempts} >= 4 THEN 'LOCKED' ELSE 'ISSUED' END`,
  }).where(and(eq(challenges.id, input.challengeId), eq(challenges.userId, userId),
    eq(challenges.publicationId, publicationId), eq(challenges.state, "ISSUED"),
    sql`${challenges.expiresAt} > now()`, sql`${challenges.attempts} < 5`)).returning();
  if (!claimed || claimed.state !== "CLAIMED") throw new CreatorError(403, "Invalid, expired or already used publication code.");
  try {
    const bytes = await readPrivate(publication.storageKey, publication.contentHash);
    const result = await sendPublicationMessage({
      to: process.env.IMPRIMA_CONTROL_EMAIL ?? "atanda.projects@gmail.com",
      subject: `ATANDA.IMPRIMA publication copy · ${publication.title.slice(0, 150)}`,
      text: `Publication: ${publication.id}\nTitle: ${publication.title}\nAuthor: ${publication.author}\nPublisher: ATANDA\nSubscriber stamp: ${createHash("sha256").update(userId).digest("hex").slice(0, 16)}\nPublished: ${publication.createdAt.toISOString()}\nSHA-256: ${publication.contentHash}\nThe attached bytes are the exact publication being issued. Provider acceptance is not proof that the subscriber completed the download.`,
      idempotencyKey: `imprima-copy-${input.challengeId}`, attachment: { filename: publication.filename, bytes },
    }, delivery);
    if (!result.ok || result.dryRun) throw new CreatorError(503, "The control copy was not confirmed. No download was issued; request a new code after email service recovery.");
    if (testCopyEmail) {
      const copy = await sendPublicationMessage({
        to: testCopyEmail,
        subject: `ATANDA.IMPRIMA requested test copy · ${publication.title.slice(0, 150)}`,
        text: `The publication owner requested this test copy.\nPublication: ${publication.id}\nTitle: ${publication.title}\nAuthor: ${publication.author}\nPublisher: ATANDA\nPublished: ${publication.createdAt.toISOString()}\nSHA-256: ${publication.contentHash}\nThe attachment contains the exact published bytes. This message does not change account ownership, subscription or publication-code delivery.`,
        idempotencyKey: `imprima-test-copy-${input.challengeId}`,
        attachment: { filename: publication.filename, bytes },
      }, delivery);
      if (!copy.ok || copy.dryRun) throw new CreatorError(503, "The test copy was not confirmed. No download was issued. The control copy may already have been accepted; request a new code before trying again.");
    }
    const [consumed] = await db.update(challenges).set({ state: "CONSUMED", downloadIssuedAt: new Date(), controlMessageId: result.id })
      .where(and(eq(challenges.id, claimed.id), eq(challenges.state, "CLAIMED"))).returning({ id: challenges.id });
    if (!consumed) throw new CreatorError(409, "Publication authorization changed. No download was issued.");
    return { bytes, filename: publication.filename, mime: publication.mime };
  } catch (err) {
    await db.update(challenges).set({ state: "FAILED" }).where(and(eq(challenges.id, claimed.id), eq(challenges.state, "CLAIMED")));
    throw err;
  }
}
