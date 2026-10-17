import { and, desc, eq, sql } from "drizzle-orm";
import { db, harnessArtifactsTable, harnessSessionsTable, f0ReportsTable, spcPlayerRunsTable } from "@workspace/db";
import { OperationsError } from "./context";
import { hashContent } from "./imprima-model";

const MAP: Record<string, readonly string[]> = {
  F3_MA: ["MA_BIRTH_PACKAGE"], F4_MICRO_PDD: ["MICRO_PDD"], F5_SPC: ["SPC"],
  F6_PDD: ["ATLAS_PDD", "ATLAS_PDD_JSON", "ATLAS_360_PLAN_VIEW", "ATLAS_360_SCAN_VIEW"], F7_MVP_PDD: ["MVP_PDD"],
};
export async function ownedOperationsSession(userId: string, sessionId: string) {
  const [session] = await db.select().from(harnessSessionsTable).where(and(eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, userId)));
  if (!session) throw new OperationsError(404, "Session not found.");
  return session;
}
export async function publicationSources(userId: string, sessionId?: string) {
  if (sessionId) await ownedOperationsSession(userId, sessionId);
  const artifacts = await db.select({ id: harnessArtifactsTable.id, name: harnessArtifactsTable.name, type: harnessArtifactsTable.artifactType, sessionId: harnessArtifactsTable.sessionId }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.userId, userId), sessionId ? eq(harnessArtifactsTable.sessionId, sessionId) : undefined)).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(200);
  const result = artifacts.flatMap(a => {
    const kind = Object.entries(MAP).find(([, types]) => types.includes(a.type))?.[0];
    return kind ? [{ id: a.id, kind, label: a.name || a.type, sessionId: a.sessionId as string | null }] : [];
  });
  if (sessionId) result.push({ id: sessionId, kind: "F95_LIVING_PDD", label: "Living PDD · dated session snapshot (custody not asserted)", sessionId });
  else {
    const reports = await db.select({ id: f0ReportsTable.id }).from(f0ReportsTable).where(eq(f0ReportsTable.userId, userId)).orderBy(desc(f0ReportsTable.createdAt)).limit(50);
    const players = await db.select({ id: spcPlayerRunsTable.id }).from(spcPlayerRunsTable).where(and(eq(spcPlayerRunsTable.userId, userId), eq(spcPlayerRunsTable.status, "completed"))).orderBy(desc(spcPlayerRunsTable.createdAt)).limit(50);
    result.push(...reports.map(r => ({ id: r.id, kind: "F0_SERVICE", label: `F0 service · ${r.id.slice(0, 8)}`, sessionId: null })), ...players.map(r => ({ id: r.id, kind: "SPC_PLAYER", label: `SPC Player · ${r.id.slice(0, 8)}`, sessionId: null })));
  }
  return result;
}
export async function savedPublicationSource(userId: string, kind: string, id: string) {
  let raw: unknown, sessionId: string | null = null, createdAt: Date;
  if (MAP[kind]) {
    const [a] = await db.select({ type: harnessArtifactsTable.artifactType, sessionId: harnessArtifactsTable.sessionId, createdAt: harnessArtifactsTable.createdAt, raw: sql<unknown>`CASE WHEN octet_length(${harnessArtifactsTable.artifactContent}::text) <= 512000 THEN ${harnessArtifactsTable.artifactContent} ELSE NULL END` }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.userId, userId), eq(harnessArtifactsTable.id, id)));
    if (!a || !MAP[kind]!.includes(a.type)) throw new OperationsError(404, "Saved source not found.");
    raw = a.raw; sessionId = a.sessionId; createdAt = a.createdAt;
  } else if (kind === "F0_SERVICE") {
    const [a] = await db.select({ raw: f0ReportsTable.content, createdAt: f0ReportsTable.createdAt }).from(f0ReportsTable).where(and(eq(f0ReportsTable.id, id), eq(f0ReportsTable.userId, userId)));
    if (!a) throw new OperationsError(404, "Saved source not found.");
    raw = { serviceOutput: a.raw, status: "Advisory service output; not a certified artifact" }; createdAt = a.createdAt;
  } else if (kind === "SPC_PLAYER") {
    const [a] = await db.select({ raw: spcPlayerRunsTable.outputPackage, createdAt: spcPlayerRunsTable.createdAt, status: spcPlayerRunsTable.status }).from(spcPlayerRunsTable).where(and(eq(spcPlayerRunsTable.id, id), eq(spcPlayerRunsTable.userId, userId)));
    if (!a || a.status !== "completed" || !a.raw) throw new OperationsError(404, "Completed Player output not found.");
    raw = { output: a.raw, status: "SPC Player saved advisory output; publication grants no new certification" }; createdAt = a.createdAt;
  } else if (kind === "F95_LIVING_PDD") {
    const session = await ownedOperationsSession(userId, id);
    const artifacts = await db.select({ id: harnessArtifactsTable.id, type: harnessArtifactsTable.artifactType, createdAt: harnessArtifactsTable.createdAt, content: sql<unknown>`CASE WHEN octet_length(${harnessArtifactsTable.artifactContent}::text) <= 512000 THEN ${harnessArtifactsTable.artifactContent} ELSE NULL END` }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.userId, userId), eq(harnessArtifactsTable.sessionId, id))).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(100);
    const latest = [...new Map(artifacts.map(a => [a.type, a] as const).reverse()).values()];
    raw = { snapshotAt: new Date().toISOString(), sessionId: id, custodyBand: "NOT_ESTABLISHED", note: "Dated working Living PDD snapshot. Not an OSIRIS-sealed or independently certified document.", latestArtifacts: latest };
    sessionId = id; createdAt = session.createdAt;
  } else throw new OperationsError(400, "Unsupported document source.");
  if (raw === null || raw === undefined || Buffer.byteLength(JSON.stringify(raw)) > 512_000) throw new OperationsError(413, "Source is empty or exceeds the 512 KB publication limit.");
  return { raw, sessionId, createdAt, hash: hashContent(raw) };
}
