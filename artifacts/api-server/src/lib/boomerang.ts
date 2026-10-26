import { createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { returnedArtifactHref } from "./boomerang-upgrades";
import {
  db, f0EngagementsTable, f0ReportsTable, harnessArtifactsTable,
  harnessSessionsTable, type BoomerangCaseRow,
} from "@workspace/db";

export const BOOMERANG_STAGES = [
  "F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9",
  "F9.5", "F10", "F11", "F12", "F6-VDJ", "MM",
] as const;
/** Canonical cockpit IDs are deliberately not stage numbers. */
export const BOOMERANG_FEATURES: Record<string, number> = {
  F1: 1, F2: 2, F3: 3, F4: 4, F5: 5, F6: 6, F7: 7,
  "F6-VDJ": 8, F8: 9, MM: 10, F9: 11, F10: 12, F11: 13,
};

export class BoomerangError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function boomerangHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

type DbReader = Pick<typeof db, "select">;
export async function boomerangOrigin(reader: DbReader, userId: string, kind: string, id: string, stage: string) {
  if (!BOOMERANG_STAGES.includes(stage as typeof BOOMERANG_STAGES[number]) ||
      (kind === "F0" ? stage !== "F0" : kind !== "SESSION" || stage === "F0")) {
    throw new BoomerangError(400, "INVALID_ORIGIN_STAGE", "F0 requires an owned advisory engagement; session stages use their exact F label.");
  }
  if (kind === "F0") {
    const [engagement] = await reader.select().from(f0EngagementsTable).where(and(
      eq(f0EngagementsTable.id, id), eq(f0EngagementsTable.userId, userId),
    )).limit(1);
    if (!engagement) throw new BoomerangError(404, "ORIGIN_NOT_FOUND", "Origin engagement not found");
    const reports = await reader.select().from(f0ReportsTable).where(and(
      eq(f0ReportsTable.engagementId, id), eq(f0ReportsTable.userId, userId),
    )).orderBy(asc(f0ReportsTable.id));
    const refs = reports.map((report) => ({ id: report.id, hash: boomerangHash(report.content) }));
    return {
      hash: boomerangHash({ stage, discovery: engagement.discoveryTranscript,
        challenge: engagement.challengeResponse, artifactId: engagement.artifactId, refs }),
      refs, href: `/f0?engagementId=${encodeURIComponent(id)}`,
    };
  }
  const [session] = await reader.select().from(harnessSessionsTable).where(and(
    eq(harnessSessionsTable.id, id), eq(harnessSessionsTable.userId, userId),
  )).limit(1);
  if (!session) throw new BoomerangError(404, "ORIGIN_NOT_FOUND", "Origin session not found");
  // Conservative baseline: any production artifact change requires a fresh
  // supporting-work request. Support attachments themselves cannot create drift.
  const artifacts = await reader.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.sessionId, id), eq(harnessArtifactsTable.userId, userId),
  )).orderBy(asc(harnessArtifactsTable.id));
  const refs = artifacts.filter((artifact) => artifact.artifactType !== "SPC_PLAYER_SUPPORT")
    .map((artifact) => ({
      id: artifact.id, featureId: artifact.featureId, type: artifact.artifactType,
      hash: boomerangHash({ content: artifact.artifactContent, status: artifact.verificationStatus }),
    }));
  const featureId = BOOMERANG_FEATURES[stage];
  const href = featureId
    ? `/session/${encodeURIComponent(id)}?featureId=${featureId}`
    : `/boomerang?originKind=SESSION&originId=${encodeURIComponent(id)}&stage=${encodeURIComponent(stage)}`;
  return {
    hash: boomerangHash({ stage, origin: session.origin,
      ingestionId: session.ingestionId, cartridgeId: session.cartridgeId, refs }),
    refs, href,
  };
}

export async function boomerangResponse(row: BoomerangCaseRow, origin?: Awaited<ReturnType<typeof boomerangOrigin>> | null, reader: DbReader = db) {
  const current = origin === undefined
    ? await boomerangOrigin(db, row.userId, row.originKind, row.originId, row.stage).catch((error) => {
      if (error instanceof BoomerangError && error.status === 404) return null;
      throw error;
    }) : origin;
  const { userId: _owner, sourceRefs: _refs, ...data } = row;
  let correctedId: string | undefined;
  try {
    const refs = JSON.parse(row.resultText ?? "{}");
    if (typeof refs.correctedBundleArtifactId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refs.correctedBundleArtifactId)) correctedId = refs.correctedBundleArtifactId;
  } catch { /* Manual supporting text is not necessarily JSON. */ }
  const [returned] = row.originKind === "SESSION" ? await reader.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.userId, row.userId), eq(harnessArtifactsTable.sessionId, row.originId),
    correctedId ? eq(harnessArtifactsTable.id, correctedId) :
      sql`${harnessArtifactsTable.artifactContent}->>'boomerangCaseId' = ${row.id}`,
  )).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(1) : [];
  const upgrade = (returned?.artifactContent as Record<string, unknown> | undefined)?.boomerangUpgrade as { label?: string } | undefined;
  const featureId = BOOMERANG_FEATURES[row.stage];
  return {
    ...data, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    originAvailable: Boolean(current), sourceChanged: !current || current.hash !== row.sourceHash,
    originHref: current?.href ?? "/boomerang", advisoryOnly: true, releaseAllowed: false,
    returnedArtifactId: returned?.id ?? null,
    upgradeLabel: upgrade?.label ?? null,
    returnedArtifactHref: returned && featureId ? returnedArtifactHref(row.originId, featureId, returned.id) : null,
  };
}

export function assertBoomerangTransition(state: string, action: string, drifted: boolean) {
  const allowed: Record<string, string[]> = {
    RETURN: ["REQUESTED", "REVISION_REQUESTED"],
    ACCEPT: ["RETURNED"], REQUEST_REVISION: ["RETURNED"], REJECT: ["RETURNED"],
    CANCEL: ["REQUESTED", "REVISION_REQUESTED"],
  };
  if (!allowed[action]?.includes(state)) {
    throw new BoomerangError(409, "INVALID_TRANSITION", `Cannot ${action} a ${state} request`);
  }
  if (drifted && (action === "RETURN" || action === "ACCEPT")) {
    throw new BoomerangError(409, "SOURCE_CHANGED", "The origin baseline changed. Create a new request against the current source; the original remains in history.");
  }
}
