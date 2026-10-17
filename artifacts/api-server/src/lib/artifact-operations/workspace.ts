import { and, desc, eq } from "drizzle-orm";
import { imprimaJobsTable, imprimaFilesTable, shortSprintRunsTable, artifactOperationEventsTable, sprintVerifierAuthoritiesTable } from "@workspace/db";
import { withOperationsActor, type OperationsActor } from "./context";
import { publicationSources } from "./sources";
import { imprimaActions, recoverImprima } from "./imprima";
import { sprintActions } from "./short-sprints";

export async function artifactOperationsWorkspace(actor: OperationsActor, kind: "imprima" | "short-sprints", sessionId?: string, offset = 0, selectedId?: string) {
  if (kind === "imprima") await recoverImprima(actor);
  const sources = await publicationSources(actor.id, sessionId);
  return withOperationsActor(actor, async tx => {
    const rows = kind === "imprima"
      ? await tx.select().from(imprimaJobsTable).where(and(eq(imprimaJobsTable.userId, actor.id), sessionId ? eq(imprimaJobsTable.sessionId, sessionId) : undefined)).orderBy(desc(imprimaJobsTable.createdAt), desc(imprimaJobsTable.id)).limit(51).offset(offset)
      : await tx.select().from(shortSprintRunsTable).where(and(eq(shortSprintRunsTable.userId, actor.id), sessionId ? eq(shortSprintRunsTable.sessionId, sessionId) : undefined)).orderBy(desc(shortSprintRunsTable.createdAt), desc(shortSprintRunsTable.id)).limit(51).offset(offset);
    const items = [];
    for (const row of rows.slice(0, 50)) {
      const files = kind === "imprima" ? await tx.select().from(imprimaFilesTable).where(and(eq(imprimaFilesTable.jobId, row.id), eq(imprimaFilesTable.userId, actor.id))).orderBy(desc(imprimaFilesTable.createdAt)) : [];
      const events = await tx.select().from(artifactOperationEventsTable).where(and(eq(artifactOperationEventsTable.workflowId, row.id), eq(artifactOperationEventsTable.userId, actor.id))).orderBy(desc(artifactOperationEventsTable.createdAt), desc(artifactOperationEventsTable.id)).limit(100);
      const { cdmKey: _privateKey, ...publicResult } = row.result;
      if (publicResult.package && typeof publicResult.package === "object") {
        const { objectKey: _objectKey, ...publicPackage } = publicResult.package as Record<string, unknown>;
        publicResult.package = publicPackage;
      }
      items.push({
        id: row.id, kind, state: row.state, revision: row.revision, sessionId: row.sessionId, title: String(row.config.title ?? (row.config.manifest as Record<string, unknown> | undefined)?.name ?? "SHORT SPRINTS"),
        sourceHash: row.sourceHash, config: row.config, result: publicResult,
        files: kind === "imprima" ? files.map(f => ({ id: f.id, format: f.format, filename: f.filename, size: f.size, fileHash: f.fileHash, contentHash: f.contentHash, variant: f.variant, downloadPath: `/api/artifact-operations/imprima/files/${f.id}` })) :
          ((row.result.package as { files?: { name: string; sha256: string; size: number }[] } | undefined)?.files ?? row.result.shippedFiles as { name: string; sha256: string; size: number }[] ?? [])
            .filter(f => Number.isFinite(f.size)).map(f => ({ id: `${row.id}:${f.name}`, format: "JSON", filename: f.name, size: f.size, fileHash: f.sha256, contentHash: row.sourceHash, variant: row.result.package ? "verification-package" : "preparation", downloadPath: `/api/artifact-operations/short-sprints/${row.id}/files/${encodeURIComponent(f.name)}` })),
        events: events.map(e => ({ action: e.action, actorId: e.actorId, revision: e.revision, createdAt: e.createdAt.toISOString(), data: e.data })),
        allowedActions: kind === "imprima" ? imprimaActions(row as typeof imprimaJobsTable.$inferSelect) : sprintActions(row as typeof shortSprintRunsTable.$inferSelect),
        createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
      });
    }
    const authorities = await tx.select().from(sprintVerifierAuthoritiesTable).orderBy(desc(sprintVerifierAuthoritiesTable.createdAt)).limit(100);
    return { kind, items, sources: kind === "imprima" ? sources : sources.filter(s => ["F4_MICRO_PDD", "F5_SPC"].includes(s.kind)), selectedId: selectedId ?? null, hasMore: rows.length > 50, mayRegisterVerifier: actor.role === "ADMIN",
      verifiers: authorities.map(a => ({ id: a.id, name: a.name, publicKey: a.publicKey, fingerprint: a.fingerprint, mechanism: a.mechanism, scopes: a.scopes, revokedAt: a.revokedAt?.toISOString() ?? null })),
      notices: kind === "imprima" ? [
        "Private document publishing does not certify its source artifact. Final and SAFE_LIFE Draft require named human approval.",
        "Clarity is a model estimate; truthfulness and detectability are NOT RUN. Structural layout checks are not an independent accessibility audit.",
      ] : [
        "Signed evidence must come from administrator-approved independent verifiers. Legacy flags, model scores and owner assertions cannot clear gates.",
        "External test and provider receipts are verified, not invented. No traffic or deployment is changed merely by accepting a receipt.",
        "Firmware must use the full path until MECHA short-route compatibility is resolved. Existing core functionality remains available.",
      ] };
  });
}
