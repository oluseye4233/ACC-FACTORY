import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { zipSync } from "fflate";
import { z } from "zod/v4";
import { db, harnessArtifactsTable, preparationStorageLeasesTable } from "@workspace/db";
import { humanName, OperationsError, type OperationsActor } from "./context";
import { databaseProtection } from "./database-protection";
import { hashContent, normaliseDocument, publishRequest, sourceSafety } from "./imprima-model";
import { renderImprima } from "./imprima-render";
import { fileHash, readPrivate, savePrivate } from "./private-storage";
import { ownedOperationsSession, publicationSources, savedPublicationSource } from "./sources";
import { prepareSprintSource } from "./short-sprints";
import { internalEvaluation, INTERNAL_CAVEAT } from "./internal-evaluation";
import { reviewInternalDocument, type InternalEditorialEvidence } from "./internal-editorial";

export type PreparationKind = "imprima" | "short-sprints";
const TYPES = { imprima: "IMPRIMA_PREPARATION", "short-sprints": "SHORT_SPRINT_PREPARATION" } as const;
const inputSchema = z.object({ sourceId: z.string().uuid(), sourceKind: z.string().max(80), options: z.record(z.string(), z.unknown()),
  evaluationMode: z.enum(["PREPARATION", "INTERNAL"]).default("PREPARATION") }).strict();
type StoredFile = { id: string; format: string; filename: string; size: number; fileHash: string; contentHash: string; variant: string; objectKey: string; mime: string };
type StoredPreparation = {
  schemaVersion: "SPARTAN-PREPARATION-1"; kind: PreparationKind; sourceId: string; sourceKind: string; sourceHash: string;
  manifestHash: string; state: "PREPARED_DRAFT" | "PREPARED_PROPOSAL"; releaseAllowed: false; files: StoredFile[]; notices: string[];
  evaluationMode?: "PREPARATION" | "INTERNAL"; internalEvaluation?: ReturnType<typeof internalEvaluation>;
};
const notice = [
  "Private preparation only. No Final approval, source certification, marketplace eligibility, independent verification or deployment is granted.",
  "Files are archived once in private App Storage and verified against their original hashes. Corrections create a new preparation.",
  "This lane uses existing authenticated owner-scoped artifact access. It does not claim the full workflow's database-role/RLS isolation.",
];
function dto(row: typeof harnessArtifactsTable.$inferSelect) {
  const p = row.artifactContent as StoredPreparation;
  return { id: row.id, kind: p.kind, title: row.name ?? "Preparation", sessionId: row.sessionId, sourceId: p.sourceId,
    sourceKind: p.sourceKind, sourceHash: p.sourceHash, manifestHash: p.manifestHash, state: p.state,
    releaseAllowed: false as const, createdAt: row.createdAt.toISOString(), notices: p.notices,
    evaluationMode: p.evaluationMode ?? "PREPARATION", ...(p.internalEvaluation ? { internalEvaluation: p.internalEvaluation } : {}),
    files: p.files.map(({ objectKey: _key, mime: _mime, ...f }) => ({ ...f, downloadPath: `/api/artifact-operations/${p.kind}/preparations/${row.id}/files/${f.id}` })) };
}
export async function preparationWorkspace(actor: OperationsActor, kind: PreparationKind, sessionId?: string, offset = 0) {
  if (sessionId) await ownedOperationsSession(actor.id, sessionId);
  const [rows, sources, protection] = await Promise.all([
    db.select().from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.userId, actor.id), eq(harnessArtifactsTable.artifactType, TYPES[kind]),
      sessionId ? eq(harnessArtifactsTable.sessionId, sessionId) : undefined)).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(51).offset(offset),
    publicationSources(actor.id, sessionId), databaseProtection(),
  ]);
  return { kind, items: rows.slice(0, 50).map(dto), hasMore: rows.length > 50, authorName: actor.displayName,
    sources: sources.filter(s => s.sessionId && (kind === "imprima" || ["F4_MICRO_PDD", "F5_SPC"].includes(s.kind))),
    databaseProtection: protection, notices: [...notice, "Ordinary preparation makes no model calls. IMPRIMA Internal runs budgeted KLARITY and SOCRATES model reviews; these are not independent verification.",
      "Session-backed sources are supported in this MVP. Sessionless service/Player publishing remains in the guarded full workflow."] };
}
export async function createPreparation(actor: OperationsActor, kind: PreparationKind, input: unknown) {
  const body = inputSchema.parse(input), author = humanName(actor);
  const source = await savedPublicationSource(actor.id, body.sourceKind, body.sourceId);
  if (!source.sessionId) throw new OperationsError(409, "This preparation MVP requires a saved session-backed source.");
  await ownedOperationsSession(actor.id, source.sessionId);
  const id = randomUUID(), createdAt = new Date();
  const files: { filename: string; format: string; mime: string; bytes: Buffer; contentHash: string }[] = [];
  let sprint: Parameters<typeof internalEvaluation>[0]["sprint"];
  let editorial: InternalEditorialEvidence | undefined;
  let title: string;
  if (kind === "imprima") {
    const config = publishRequest.parse({ ...body.options, author });
    if (config.mode !== "DRAFT") throw new OperationsError(409, "SPARTAN preparation supports DRAFT only. Final requires the guarded approval workflow.");
    const scan = sourceSafety(source.raw, config);
    if (scan.groState !== "LIFE") throw new OperationsError(409, "This source requires the guarded safety/human-review workflow; no preparation was released.");
    let cdm = normaliseDocument(body.sourceKind, body.sourceId, source.raw, config);
    cdm.disclosure = "SPARTAN source-preserving DRAFT. No KLARITY/SOCRATES editorial or truthfulness review has run. No approval or certification is asserted.";
    if (body.evaluationMode === "INTERNAL") {
      const reviewed = await reviewInternalDocument(cdm, { userId: actor.id, sessionId: source.sessionId, engineId: -201 });
      cdm = reviewed.cdm;
      editorial = reviewed.evidence;
      cdm.disclosure = `IMPRIMA Internal DRAFT. KLARITY: ${editorial.clarity === null ? "NOT_RUN (no editable prose)" : `clarity estimate ${editorial.clarity}/100`}. SOCRATES: ${editorial.review.verdict}. ${INTERNAL_CAVEAT}`;
      const evidence = Buffer.from(JSON.stringify(editorial, null, 2));
      files.push({ filename: "internal-editorial-review.json", format: "JSON", mime: "application/json", bytes: evidence, contentHash: fileHash(evidence) });
      const original = Buffer.from(JSON.stringify(source.raw, null, 2));
      files.push({ filename: "source-snapshot.json", format: "JSON", mime: "application/json", bytes: original, contentHash: source.hash });
    }
    for (const format of config.formats) {
      const f = await renderImprima(cdm, format, { renderedAt: createdAt, version: 1, approval: null, collision: 1 });
      files.push({ filename: f.filename, format, bytes: f.bytes, mime: f.mime, contentHash: f.contentHash });
    }
    title = config.title;
  } else {
    const expectedKind = (body.options.circuit === "SC_ONE") ? "F4_MICRO_PDD" : "F5_SPC";
    if (body.sourceKind !== expectedKind) throw new OperationsError(400, "Circuit and source kind do not match.");
    const prepared = await prepareSprintSource(actor, source.sessionId, body.sourceId, body.options, id);
    sprint = prepared.config;
    const scan = sourceSafety({ source: source.raw, manifest: prepared.config.manifest, birthPackage: prepared.birthPackage },
      publishRequest.parse({ title: prepared.config.manifest.name, project: source.sessionId, author, authorIsHuman: true, formats: ["HTML"] }));
    if (scan.groState !== "LIFE") throw new OperationsError(409, "This source or manifest requires the guarded safety-review workflow.");
    for (const f of prepared.releaseFiles) files.push({ filename: f.name, format: "JSON", bytes: Buffer.from(f.content), mime: "application/json", contentHash: source.hash });
    title = prepared.config.manifest.name;
  }
  let assessment: ReturnType<typeof internalEvaluation> | undefined;
  const recordNotices = body.evaluationMode === "INTERNAL" ? [...notice, INTERNAL_CAVEAT] : [...notice];
  if (body.evaluationMode === "INTERNAL") {
    // Scores are inherited ONLY from this owner-held source. Session snapshots
    // and unscored sources remain unscored; callers cannot supply score values.
    const [scores] = body.sourceKind === "F95_LIVING_PDD" ? [] : await db.select({
      jcseScore: harnessArtifactsTable.jcseScore, mathmonScore: harnessArtifactsTable.mathmonScore,
    }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.id, body.sourceId), eq(harnessArtifactsTable.userId, actor.id)));
    assessment = internalEvaluation({ kind, source: source.raw, sourceHash: source.hash, assessedAt: createdAt,
      scores: scores ?? { jcseScore: null, mathmonScore: null }, sprint, editorial });
    const bytes = Buffer.from(JSON.stringify(assessment, null, 2));
    files.push({ filename: "internal-evaluation.json", format: "JSON", mime: "application/json", bytes, contentHash: fileHash(bytes) });
    if (kind === "short-sprints") {
      const caveat = Buffer.from(`# SHORT SPRINT Internal\n\n${INTERNAL_CAVEAT}\n\nAssessment: ${assessment.state}\nSource SHA-256: ${source.hash}\n`);
      files.push({ filename: "INTERNAL-ONLY.md", format: "MD", mime: "text/markdown", bytes: caveat, contentHash: fileHash(caveat) });
    }
  }
  if (files.reduce((sum, f) => sum + f.bytes.length, 0) > 10_000_000) throw new OperationsError(413, "Combined preparation exceeds the 10 MB limit.");
  const descriptors = files.map(f => ({ filename: f.filename, format: f.format, size: f.bytes.length, sha256: fileHash(f.bytes), contentHash: f.contentHash }));
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: "SPARTAN-PREPARATION-1", id, kind, sourceId: body.sourceId, sourceKind: body.sourceKind,
    sourceHash: source.hash, createdAt: createdAt.toISOString(), author, releaseAllowed: false, certification: "NOT_ASSERTED",
    independentVerification: "NOT_RUN", humanApproval: "NOT_RECORDED", deployment: "NOT_RUN", notices: recordNotices,
    evaluationMode: body.evaluationMode, ...(assessment ? { internalEvaluation: assessment } : {}), files: descriptors }, null, 2));
  const manifestHash = fileHash(manifest);
  files.push({ filename: "integrity-manifest.json", format: "JSON", mime: "application/json", bytes: manifest, contentHash: manifestHash });
  const zipEntries = Object.fromEntries(files.map(f => [f.filename, f.bytes]));
  files.push({ filename: `${kind}-${body.evaluationMode === "INTERNAL" ? "internal" : "preparation"}-${id}.zip`, format: "ZIP", mime: "application/zip", bytes: Buffer.from(zipSync(zipEntries)), contentHash: manifestHash });
  // Existing artifact persistence, not a fallback connection into protected tables.
  // Serialize the per-owner quota across workers; no protected workflow DDL.
  // Persist upload intent OUTSIDE the save transaction. A crash/rollback must
  // not erase the evidence needed to recover its uncommitted private bytes.
  await db.insert(preparationStorageLeasesTable).values({
    id, userId: actor.id,
    fileKeys: files.map((_, index) => `spartan-preparations/${actor.id}/${id}/file-${index}`),
  });
  const [row] = await db.transaction(async tx => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${actor.id}), 210) AS acquired`);
    if (lock.rows[0]?.acquired !== true) throw new OperationsError(429, "Another preparation is being saved. Please retry after it finishes.");
    const lease = await tx.select({ id: preparationStorageLeasesTable.id }).from(preparationStorageLeasesTable)
      .where(and(eq(preparationStorageLeasesTable.id, id), eq(preparationStorageLeasesTable.state, "UPLOADING"),
        sql`${preparationStorageLeasesTable.createdAt} > now() - interval '1 day'`)).for("update");
    if (lease.length !== 1) throw new OperationsError(409, "The preparation upload lease has expired. Please prepare a new version.");
    const recent = await tx.select({ id: harnessArtifactsTable.id }).from(harnessArtifactsTable)
      .where(and(eq(harnessArtifactsTable.userId, actor.id), inArray(harnessArtifactsTable.artifactType, Object.values(TYPES)),
        sql`${harnessArtifactsTable.createdAt} > now() - interval '1 day'`)).limit(30);
    if (recent.length >= 30) throw new OperationsError(429, "The preparation limit is 30 per account per day. Existing files remain downloadable.");
    const stored: StoredFile[] = [];
    for (const [index, f] of files.entries()) {
      const objectKey = `spartan-preparations/${actor.id}/${id}/file-${index}`;
      const archived = await savePrivate(objectKey, f.bytes, f.mime);
      stored.push({ id: `file-${index}`, format: f.format, filename: f.filename, size: archived.size, fileHash: archived.hash,
        contentHash: f.contentHash, variant: kind === "imprima" ? "draft" : "preparation", objectKey, mime: f.mime });
    }
    const record: StoredPreparation = { schemaVersion: "SPARTAN-PREPARATION-1", kind, sourceId: body.sourceId, sourceKind: body.sourceKind,
      sourceHash: source.hash, manifestHash, state: kind === "imprima" ? "PREPARED_DRAFT" : "PREPARED_PROPOSAL", releaseAllowed: false, files: stored, notices: recordNotices,
      evaluationMode: body.evaluationMode, ...(assessment ? { internalEvaluation: assessment } : {}) };
    const result = await tx.insert(harnessArtifactsTable).values({ id, userId: actor.id, sessionId: source.sessionId!, artifactType: TYPES[kind],
      featureId: kind === "imprima" ? -210 : -211, parentArtifactId: body.sourceKind === "F95_LIVING_PDD" ? null : body.sourceId,
      name: title, artifactContent: record, contentHash: manifestHash, verificationStatus: "UNVERIFIED", forgeVerified: false, groState: "LIFE", createdAt }).returning();
    await tx.update(preparationStorageLeasesTable).set({ state: "COMMITTED" })
      .where(eq(preparationStorageLeasesTable.id, id));
    return result;
  });
  return dto(row!);
}
export async function preparationDownload(actor: OperationsActor, kind: PreparationKind, id: string, fileId: string) {
  const [row] = await db.select().from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.id, id),
    eq(harnessArtifactsTable.userId, actor.id), eq(harnessArtifactsTable.artifactType, TYPES[kind])));
  if (!row) throw new OperationsError(404, "Preparation not found.");
  await ownedOperationsSession(actor.id, row.sessionId);
  const p = row.artifactContent as StoredPreparation, f = p.files.find(f => f.id === fileId);
  if (!f || p.kind !== kind || !f.objectKey.startsWith(`spartan-preparations/${actor.id}/${id}/`)) throw new OperationsError(404, "Preparation file not found.");
  return { filename: f.filename, mime: f.mime, bytes: await readPrivate(f.objectKey, f.fileHash), fileHash: f.fileHash };
}
