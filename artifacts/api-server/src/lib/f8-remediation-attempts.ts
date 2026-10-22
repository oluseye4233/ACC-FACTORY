import { and, desc, eq } from "drizzle-orm";
import { db, f8RemediationAttemptsTable, harnessArtifactsTable, boomerangCasesTable } from "@workspace/db";
import { boomerangHash } from "./boomerang";
import { lockModelAttempt } from "./model-attempt-lock";

export interface RepairAttempt {
  phase: string;
  data: Record<string, unknown>;
}

export function repairAttemptId(userId: string, sessionId: string, reportId: string) {
  return boomerangHash({ purpose: "F8_DRIFT_REPAIR", userId, sessionId, reportId });
}

/** Session lock survives transactions and is shared by every API instance.
 * Never expire it by age: a slow provider must not create a second billable call.
 */
export async function lockRepairAttempt(id: string) {
  return lockModelAttempt(`f8-repair:${id}`);
}

export async function openRepairAttempt(id: string, userId: string, sessionId: string, sourceHash: string): Promise<RepairAttempt> {
  await db.insert(f8RemediationAttemptsTable).values({ id, userId, sessionId, sourceHash })
    .onConflictDoNothing();
  const [row] = await db.select().from(f8RemediationAttemptsTable).where(and(
    eq(f8RemediationAttemptsTable.id, id), eq(f8RemediationAttemptsTable.userId, userId),
    eq(f8RemediationAttemptsTable.sessionId, sessionId),
  ));
  if (!row || row.sourceHash !== sourceHash) throw new Error("Source evidence changed since this repair began; use a fresh drift report");
  return { phase: row.phase, data: row.data };
}

export async function saveRepairAttempt(id: string, userId: string, phase: string, data: Record<string, unknown>) {
  const rows = await db.update(f8RemediationAttemptsTable).set({ phase, data, updatedAt: new Date() })
    .where(and(eq(f8RemediationAttemptsTable.id, id), eq(f8RemediationAttemptsTable.userId, userId)))
    .returning({ id: f8RemediationAttemptsTable.id });
  if (!rows.length) throw new Error("Repair progress could not be saved");
}

export async function findRepairEvidence(userId: string, sessionId: string, attemptId: string) {
  // Bound to this owner/session. JSON keys are evidence links, never identities.
  const artifacts = await db.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.userId, userId), eq(harnessArtifactsTable.sessionId, sessionId),
  ));
  const linked = artifacts.filter(a => (a.artifactContent as Record<string, unknown>).repairAttemptId === attemptId);
  const journal = linked.find(a => a.artifactType === "F8_DRIFT_REMEDIATION");
  const bundle = linked.find(a => a.artifactType === "CODEBASE_BUNDLE");
  const reports = bundle ? artifacts.filter(a => a.artifactType === "PFP_REPORT" &&
    (a.artifactContent as Record<string, unknown>).sourceCodebaseBundleArtifactId === bundle.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : [];
  const cases = journal ? await db.select().from(boomerangCasesTable).where(and(
    eq(boomerangCasesTable.userId, userId), eq(boomerangCasesTable.originId, sessionId),
    eq(boomerangCasesTable.stage, "F8"),
  )).orderBy(desc(boomerangCasesTable.updatedAt)) : [];
  const review = cases.find(c => {
    try { return JSON.parse(c.resultText ?? "{}").remediationArtifactId === journal?.id; }
    catch { return false; }
  });
  return { journal, bundle, report: reports[0], review };
}
