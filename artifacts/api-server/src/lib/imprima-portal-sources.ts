import { and, eq } from "drizzle-orm";
import { db, harnessArtifactsTable as artifacts, harnessSessionsTable as sessions, exemplarLibraryItemsTable as library,
  spcPlayerDraftRunsTable as drafts, spcPlayerRunsTable as executions,
  imprimaFilesTable as files, usersTable } from "@workspace/db";
import { DownloadF10ExportBody } from "@workspace/api-zod";
import { CreatorError } from "./agent-creator";
import { withOperationsActor } from "./artifact-operations/context";
import { imprimaJob } from "./artifact-operations/imprima";
import { preparationDownload } from "./artifact-operations/preparations";
import { sprintExport } from "./artifact-operations/short-sprints";
import { readPrivate } from "./artifact-operations/private-storage";
import { buildExport, SOURCE_TYPES, type OwnedSource, type ExportProfile } from "./f10-export";

export type PortalSourceInput = {
  sourceId: string; sourceType: string; parentId?: string; kind?: "imprima" | "short-sprints";
  exportOptions?: Record<string, unknown>;
};
export type ResolvedPortalSource = { title: string; content: unknown; artifactKind?: string; native?: { filename: string; bytes: Buffer } };
export async function portalActor(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) throw new CreatorError(404, "Subscriber not found.");
  return { id: userId, role: user.role, displayName: user.displayName };
}
export async function resolvePortalSource(userId: string, input: PortalSourceInput): Promise<ResolvedPortalSource> {
  if (input.sourceType === "SPC_PLAYER") {
    const [row] = await db.select({ draft: drafts, execution: executions }).from(drafts)
      .innerJoin(executions, eq(executions.id, drafts.id))
      .where(and(eq(drafts.id, input.sourceId), eq(drafts.ownerUserId, userId), eq(executions.userId, userId))).limit(1);
    if (!row || row.execution.status !== "completed" || !row.execution.outputPackage) throw new CreatorError(409, "An owned, completed SPC Player synthesis is required.");
    return { title: row.draft.title, content: row.execution.outputPackage };
  }
  if (input.sourceType === "IMPRIMA_FILE") {
    const actor = await portalActor(userId);
    const file = await withOperationsActor(actor, async tx => {
      const [file] = await tx.select().from(files).where(and(eq(files.id, input.sourceId), eq(files.userId, userId))).limit(1);
      if (!file) throw new CreatorError(404, "Owned publication file not found.");
      const job = await imprimaJob(tx, actor, file.jobId);
      if (file.variant === "final" && job.state !== "PUBLISHED") throw new CreatorError(409, "The Final version has not been released.");
      return file;
    });
    return { title: file.filename, content: { originalFilename: file.filename, originalHash: file.fileHash,
      notice: "Original document retained unchanged beside this publication cover; its original approval scope is not extended." },
      native: { filename: file.filename, bytes: await readPrivate(file.objectKey, file.fileHash) } };
  }
  if (input.sourceType === "PREPARATION_FILE") {
    if (!input.parentId || !input.kind) throw new CreatorError(400, "Preparation ID and kind are required.");
    const file = await preparationDownload(await portalActor(userId), input.kind, input.parentId, input.sourceId);
    return { title: file.filename, content: { originalFilename: file.filename, originalHash: file.fileHash,
      notice: "Private preparation only, not independently verified or approved for release." },
      native: { filename: file.filename, bytes: file.bytes } };
  }
  if (input.sourceType === "SPRINT_EXPORT") {
    const content = await sprintExport(await portalActor(userId), input.sourceId);
    return { title: `Short Sprint ${input.sourceId.slice(0, 8)} — Historical release package`, content };
  }
  if (input.sourceType === "EXEMPLAR") {
    const [item] = await db.select().from(library).where(and(eq(library.id, input.sourceId), eq(library.ownerUserId, userId), eq(library.active, true))).limit(1);
    if (!item) throw new CreatorError(404, "Owned library source not found.");
    const snapshot = item.artifactSnapshot as Record<string, unknown> | null;
    return { title: item.title, content: { title: item.title, kind: item.kind, body: item.body,
      ...(snapshot ? { artifact: snapshot.artifactContent ?? snapshot } : {}),
      notice: "Private library publication is not marketplace qualification or a transfer of certification." } };
  }
  if (!["ARTIFACT", "F10_EXPORT"].includes(input.sourceType)) throw new CreatorError(400, "Unsupported publication source.");
  const [source] = await db.select().from(artifacts).where(and(eq(artifacts.id, input.sourceId), eq(artifacts.userId, userId))).limit(1);
  if (!source) throw new CreatorError(404, "Owned artifact not found.");
  const [session] = await db.select({ name: sessions.sessionName }).from(sessions).where(and(eq(sessions.id, source.sessionId), eq(sessions.userId, userId))).limit(1);
  if (!session) throw new CreatorError(404, "Source project not found.");
  const title = source.name?.startsWith(session.name) ? source.name : `${session.name} — ${source.name ?? source.artifactType}`;
  if (input.sourceType === "F10_EXPORT") {
    if (!(SOURCE_TYPES as readonly string[]).includes(source.artifactType) ||
        (source.artifactType === "VERIFIED_CODEBASE_BUNDLE" && (source.verificationStatus !== "VERIFIED" || !source.contentHash || !source.verificationEvidenceHash))) {
      throw new CreatorError(409, "This source does not satisfy the existing F10 export requirements.");
    }
    const profile = DownloadF10ExportBody.safeParse({ ...input.exportOptions, sourceArtifactId: source.id });
    if (!profile.success) throw new CreatorError(400, "Select a valid F10 export family, output kind and target.");
    const output = buildExport({ id: source.id, type: source.artifactType as OwnedSource["type"], name: source.name,
      content: source.artifactContent, createdAt: source.createdAt }, profile.data as ExportProfile);
    return { title, content: { manifest: output.manifest, notice: "Target packaging only. No deployment or external permission is conferred." },
      native: { filename: "target-export.zip", bytes: output.bundle } };
  }
  if (["IMPRIMA_PREPARATION", "SHORT_SPRINT_PREPARATION"].includes(source.artifactType)) {
    throw new CreatorError(409, "Choose the preparation's file in IMPRIMA Portal, not its internal storage metadata.");
  }
  return { title, content: source.artifactContent, artifactKind: source.artifactType };
}
