import { and, desc, eq, sql } from "drizzle-orm";
import { db, harnessArtifactsTable, harnessSessionsTable } from "@workspace/db";
import { z } from "zod/v4";
import { artifactOutputHash } from "./command-deck-capture";
import { evaluateSprintEligibility, sprintEligibilityInputSchema } from "./short-sprint-eligibility";

export const sprintPreflightQuerySchema = z.object({
  circuit: z.enum(["SC_ONE", "SC_TWO"]).default("SC_ONE"),
  target: z.enum(["SOFTWARE", "FIRMWARE"]).default("SOFTWARE"),
  profile: z.enum(["PROTOTYPE_LIGHT", "STANDARD", "REGULATED"]).default("STANDARD"),
}).strict();
type Options = z.infer<typeof sprintPreflightQuerySchema>;
type Facts = z.infer<typeof sprintEligibilityInputSchema>["facts"];
const MAX_PREFLIGHT_SOURCE_BYTES = 512_000;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Presence/JSON-shape check only; semantic conformance needs stage certification. */
function jsonContractPresent(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  const json = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(text)?.[1] ?? text;
  try {
    const parsed: unknown = JSON.parse(json);
    return object(parsed) && Object.keys(parsed).length > 0;
  } catch { return false; }
}

export class SprintPreflightError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function unknownFacts(): Facts {
  const missing = () => ({ value: null, evidenceHash: null });
  return {
    sourceStageCertified: missing(), regulatedTracksAdded: missing(),
    toolPermissionsDeclared: missing(), atomicPromptCount: missing(),
    toolCount: missing(), buildElapsedMinutes: missing(),
    interfaceContractPresent: missing(), hasCodebase: missing(),
    openCriticalCount: missing(), f2Certified: missing(),
    jsonIoContractsValid: missing(), hostDeployableByConfiguration: missing(),
    singleAgent: missing(),
  };
}

/**
 * Read-only, owner-scoped diagnostic. No model calls or release/route mutations.
 * A recorded artifact is not automatically a certified artifact. We resolve
 * only facts the stored output can demonstrate; missing adapters stay unknown.
 */
export async function shortSprintPreflight(ownerId: string, sessionId: string, rawOptions: unknown) {
  const options: Options = sprintPreflightQuerySchema.parse(rawOptions);
  const [session] = await db.select({ id: harnessSessionsTable.id }).from(harnessSessionsTable)
    .where(and(eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, ownerId))).limit(1);
  if (!session) throw new SprintPreflightError(404, "Session not found");
  const stage = options.circuit === "SC_ONE" ? 4 : 5;
  const type = options.circuit === "SC_ONE" ? "MICRO_PDD" : "SPC";
  const [artifact] = await db.select({
    id: harnessArtifactsTable.id, name: harnessArtifactsTable.name,
    artifactType: harnessArtifactsTable.artifactType, createdAt: harnessArtifactsTable.createdAt,
    // Bound before transporting JSON out of PostgreSQL; never load an oversized
    // source just to discover that it cannot be evaluated.
    content: sql<unknown>`CASE WHEN octet_length(${harnessArtifactsTable.artifactContent}::text) <= ${MAX_PREFLIGHT_SOURCE_BYTES} THEN ${harnessArtifactsTable.artifactContent} ELSE NULL END`,
  }).from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.userId, ownerId), eq(harnessArtifactsTable.sessionId, sessionId),
    eq(harnessArtifactsTable.featureId, stage), eq(harnessArtifactsTable.artifactType, type),
  )).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(1);

  const sourceHash = artifact?.content != null ? artifactOutputHash(artifact.content) : null;
  const facts = unknownFacts();
  if (stage === 4 && sourceHash && object(artifact.content)) {
    facts.interfaceContractPresent = {
      value: jsonContractPresent(artifact.content.interfaceContract), evidenceHash: sourceHash,
    };
  }
  const notes = [
    artifact ? `Selected the latest owner-held F${stage} ${type} by recorded creation time and ID.` :
      `No owner-held F${stage} ${type} is available in this session.`,
    "Full F4/F5 stage certification is not established by legacy VERIFIED/forgeVerified flags, model scores, or an advisory XVL contract PASS.",
    "Selected-source prompt/tool lineage, MA build-clock boundaries, absence of CRITICAL findings and governed configuration require dedicated trusted records. Session totals, model-call duration and missing rows are not substitutes.",
    "This is a fresh read-only preflight. It does not persist a gate decision, select a circuit, skip stages, publish, or authorize release.",
  ];
  if (artifact && sourceHash === null) notes.push("The selected output is null or exceeds the bounded source size; its facts and content hash remain unknown.");
  if (stage === 4 && sourceHash) notes.push("Interface Contract checks JSON-object presence only, including a single JSON code fence; semantic contract validation remains unproven.");
  if (options.profile === "REGULATED") notes.push("Tracks H and C have not been established by a governed profile record; selecting Regulated here does not add those tracks.");
  const source = artifact ? {
    id: artifact.id, name: artifact.name, artifactType: artifact.artifactType,
    createdAt: artifact.createdAt.toISOString(), hash: sourceHash,
    certification: "NOT_ESTABLISHED" as const,
  } : null;
  const assessment = evaluateSprintEligibility({ ...options, sourceArtifactHash: sourceHash, facts });
  return {
    sessionId, ...options, source, assessment, evidenceNotes: notes,
    evidenceHash: artifactOutputHash({ sessionId, ...options, source, assessment }),
    checkedAt: new Date().toISOString(),
  };
}
