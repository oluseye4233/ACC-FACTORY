import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { imprimaFilesTable, imprimaJobsTable, sprintVerifierAuthoritiesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireCostBudget } from "../lib/cost-budget";
import { resolveProvider, sendProviderTierError } from "../engines/shared";
import { withOperationsActor, OperationsError, operationEvent, type OperationsActor } from "../lib/artifact-operations/context";
import { artifactOperationsWorkspace } from "../lib/artifact-operations/workspace";
import { createImprima, imprimaCommand, imprimaJob } from "../lib/artifact-operations/imprima";
import { createSprint, sprintCommand, sprintExport } from "../lib/artifact-operations/short-sprints";
import { registerAuthority } from "../lib/artifact-operations/sprint-evidence";
import { readPrivate, fileHash } from "../lib/artifact-operations/private-storage";
import { publicHandoff } from "../lib/artifact-operations/public-handoff";
import { MIME } from "../lib/artifact-operations/imprima-render";
import { createPreparation, preparationDownload, preparationWorkspace } from "../lib/artifact-operations/preparations";
import { databaseProtection } from "../lib/artifact-operations/database-protection";

const router: IRouter = Router();
const kindSchema = z.enum(["imprima", "short-sprints"]);
const uuid = z.string().uuid();
const requestSchema = z.object({ action: z.string().max(60), workflowId: uuid.optional(), revision: z.number().int().min(0).optional(), sessionId: uuid.optional(), sourceId: uuid.optional(), sourceKind: z.string().max(80).optional(), options: z.record(z.string(), z.unknown()) }).strict();
const actorOf = (req: Express.Request): OperationsActor => ({ id: req.localUser!.id, role: req.localUser!.role, displayName: req.localUser!.displayName });
function fail(res: import("express").Response, error: unknown) {
  if (error instanceof OperationsError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
  if (error instanceof z.ZodError) { res.status(400).json({ error: "Invalid workflow input.", details: error.issues.map(i => ({ field: i.path.join("."), message: i.message })) }); return; }
  const pg = error as { code?: string; cause?: { code?: string } };
  if (pg?.code === "23505" || pg?.cause?.code === "23505") { res.status(409).json({ error: "A concurrent request already created this version, authority or active route. Refresh before continuing." }); return; }
  res.status(500).json({ error: "The operation failed. No successful gate or release was issued." });
}
router.get("/artifact-operations/:kind/preparations", requireAuth, async (req, res) => {
  try {
    const query = z.object({ sessionId: uuid.optional(), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(req.query);
    res.json(await preparationWorkspace(actorOf(req), kindSchema.parse(req.params.kind), query.sessionId, query.offset));
  } catch (error) { fail(res, error); }
});
router.post("/artifact-operations/:kind/preparations", requireAuth, async (req, res) => {
  try {
    res.status(201).json(await createPreparation(actorOf(req), kindSchema.parse(req.params.kind), req.body));
  } catch (error) { fail(res, error); }
});
router.get("/artifact-operations/:kind/preparations/:preparationId/files/:fileId", requireAuth, async (req, res) => {
  try {
    const f = await preparationDownload(actorOf(req), kindSchema.parse(req.params.kind), uuid.parse(req.params.preparationId),
      z.string().regex(/^file-[0-9]{1,2}$/).parse(req.params.fileId));
    res.set({ "Content-Type": f.mime, "Content-Disposition": `attachment; filename="${f.filename}"`, "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "X-Content-SHA256": f.fileHash, "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" }).send(f.bytes);
  } catch (error) { fail(res, error); }
});
router.get("/artifact-operations/:kind", requireAuth, async (req, res) => {
  try {
    const kind = kindSchema.parse(req.params.kind);
    const query = z.object({ sessionId: uuid.optional(), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(req.query);
    res.json(await artifactOperationsWorkspace(actorOf(req), kind, query.sessionId, query.offset));
  } catch (error) { fail(res, error); }
});
router.post("/artifact-operations/:kind", requireAuth, async (req, res, next) => {
  try {
    if (!(await databaseProtection()).ready) throw new OperationsError(503, "The full workflow requires verified production database guards. Private preparations are available separately.", "DATABASE_GUARDS_MISSING");
    next();
  } catch (error) { fail(res, error); }
}, async (req, res, next) => {
  if (req.params.kind === "imprima" && ["CREATE", "RETRY"].includes(req.body?.action)) return requireCostBudget(req, res, next);
  next();
}, async (req, res) => {
  try {
    const actor = actorOf(req), kind = kindSchema.parse(req.params.kind), body = requestSchema.parse(req.body);
    let selectedId: string | undefined;
    if (body.action === "REGISTER_VERIFIER") {
      if (kind !== "short-sprints") throw new OperationsError(400, "Verifier registration belongs to SHORT SPRINTS.");
      await withOperationsActor(actor, tx => registerAuthority(tx, actor, body.options));
    } else if (body.action === "REVOKE_VERIFIER") {
      if (kind !== "short-sprints") throw new OperationsError(400, "Verifier governance belongs to SHORT SPRINTS.");
      if (actor.role !== "ADMIN") throw new OperationsError(403, "Administrator approval required.");
      const authorityId = uuid.parse(body.options.authorityId);
      await withOperationsActor(actor, async tx => { await tx.update(sprintVerifierAuthoritiesTable).set({ revokedAt: new Date() }).where(eq(sprintVerifierAuthoritiesTable.id, authorityId)); });
    } else if (body.action === "CREATE") {
      if (kind === "imprima") {
        const provider = resolveProvider(req, body.options.provider, "claude");
        selectedId = await createImprima(actor, z.string().parse(body.sourceKind), uuid.parse(body.sourceId), { ...body.options, provider });
      } else selectedId = await createSprint(actor, uuid.parse(body.sessionId), body.sourceId, body.options);
    } else {
      const id = uuid.parse(body.workflowId), revision = z.number().int().min(0).parse(body.revision);
      if (kind === "short-sprints") selectedId = await sprintCommand(actor, id, revision, body.action, body.options);
      else if (body.action === "HANDOFF") {
        const options = z.object({ targetUrl: z.string().url().max(1000), consent: z.literal(true) }).strict().parse(body.options);
        const { job, files } = await withOperationsActor(actor, async tx => {
          const job = await imprimaJob(tx, actor, id);
          if (job.revision !== revision || job.state !== "PUBLISHED" || job.config.mode !== "FINAL" || !job.result.approval) throw new OperationsError(409, "Only the current human-approved Final version can be handed off.");
          const files = await tx.select().from(imprimaFilesTable).where(and(eq(imprimaFilesTable.jobId, id), eq(imprimaFilesTable.userId, actor.id), eq(imprimaFilesTable.variant, "final")));
          if (!files.length) throw new OperationsError(409, "No approved files are available.");
          return { job, files };
        });
        const payload = { kind: "IMPRIMA_DOCUMENT_HANDOFF", jobId: id, contentHash: job.result.contentHash, sourceHash: job.sourceHash, files: await Promise.all(files.sort((a, b) => a.format.localeCompare(b.format)).map(async f => ({ filename: f.filename, format: f.format, sha256: f.fileHash, contentBase64: (await readPrivate(f.objectKey, f.fileHash)).toString("base64") }))) };
        const response = await publicHandoff(options.targetUrl, payload, fileHash(`${id}:${revision}:${options.targetUrl}`));
        const ack = z.object({ accepted: z.literal(true), jobId: z.literal(id), contentHash: z.literal(String(job.result.contentHash)), receiptId: z.string().min(1).max(160) }).passthrough().parse(response);
        await withOperationsActor(actor, async tx => { await operationEvent(tx, actor, actor.id, id, "imprima", "HANDOFF", revision, { receiptId: ack.receiptId, contentHash: ack.contentHash, receiverOrigin: new URL(options.targetUrl).origin, deliveryOnly: true }); });
        selectedId = id;
      } else {
        let options = body.options;
        if (body.action === "RETRY") {
          const existing = await withOperationsActor(actor, tx => imprimaJob(tx, actor, id));
          const provider = resolveProvider(req, body.options.provider, z.enum(["claude", "openai", "gemini"]).parse(existing.config.provider));
          options = { ...body.options, provider };
        }
        selectedId = await imprimaCommand(actor, id, revision, body.action, options);
      }
    }
    res.json(await artifactOperationsWorkspace(actor, kind, body.sessionId, 0, selectedId));
  } catch (error) {
    if (sendProviderTierError(res, error)) return;
    fail(res, error);
  }
});
router.get("/artifact-operations/imprima/files/:fileId", requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req), id = uuid.parse(req.params.fileId);
    const file = await withOperationsActor(actor, async tx => {
      const [file] = await tx.select().from(imprimaFilesTable).where(and(eq(imprimaFilesTable.id, id), eq(imprimaFilesTable.userId, actor.id)));
      if (!file) throw new OperationsError(404, "File not found.");
      const job = await imprimaJob(tx, actor, file.jobId);
      if (file.variant === "final" && job.state !== "PUBLISHED") throw new OperationsError(409, "The Final version is not released.");
      return file;
    });
    const bytes = await readPrivate(file.objectKey, file.fileHash);
    res.set({ "Content-Type": MIME[file.format as keyof typeof MIME] ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" }).send(bytes);
  } catch (error) { fail(res, error); }
});
router.get("/artifact-operations/short-sprints/:workflowId/export", requireAuth, async (req, res) => {
  try {
    const data = await sprintExport(actorOf(req), uuid.parse(req.params.workflowId));
    res.set({ "Content-Type": "application/json", "Content-Disposition": `attachment; filename="short-sprint-${data.workflowId}.json"`, "Cache-Control": "private, no-store" }).send(JSON.stringify(data, null, 2));
  } catch (error) { fail(res, error); }
});
router.get("/artifact-operations/short-sprints/:workflowId/files/:filename", requireAuth, async (req, res) => {
  try {
    const filename = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/).parse(req.params.filename);
    const data = await sprintExport(actorOf(req), uuid.parse(req.params.workflowId));
    const file = data.files.find(f => f.name === filename);
    if (!file) throw new OperationsError(404, "Release file not found.");
    res.set({ "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }).send(file.content);
  } catch (error) { fail(res, error); }
});
export default router;
