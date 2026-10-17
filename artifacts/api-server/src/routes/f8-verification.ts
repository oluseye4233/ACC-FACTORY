import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  codeBundleVerificationEvidenceTable,
  harnessArtifactsTable,
  harnessSessionsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { captureArtifactPersisted } from "../lib/command-deck-capture";
import { z } from "zod/v4";

const router: IRouter = Router();
const evidenceBody = z.object({
  evidenceKind: z.enum(["CI", "IDE_TEST"]),
  passed: z.literal(true),
  runReference: z.string().trim().min(1).max(500),
  command: z.string().trim().min(1).max(1000),
  summary: z.string().trim().min(1).max(4000),
  evidencePayload: z.record(z.string(), z.unknown()).optional(),
});
const finalizeBody = z.object({}).strict();

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function hash(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

async function ownedCodeBundle(userId: string, artifactId: string) {
  const [row] = await db.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.id, artifactId),
    eq(harnessArtifactsTable.userId, userId),
  )).limit(1);
  return row;
}

router.get("/harness/f8/:artifactId/verification-evidence", requireAuth, async (req, res): Promise<void> => {
  const source = await ownedCodeBundle(req.localUser!.id, String(req.params.artifactId));
  if (!source || source.artifactType !== "CODEBASE_BUNDLE" || source.featureId !== 8) {
    res.status(404).json({ error: "F8 CODEBASE_BUNDLE source artifact not found" });
    return;
  }
  const rows = await db.select().from(codeBundleVerificationEvidenceTable)
    .where(and(
      eq(codeBundleVerificationEvidenceTable.sourceArtifactId, source.id),
      eq(codeBundleVerificationEvidenceTable.userId, req.localUser!.id),
    ))
     .orderBy(
       asc(codeBundleVerificationEvidenceTable.createdAt),
       asc(codeBundleVerificationEvidenceTable.id),
     );
  res.json(rows);
});

router.post("/harness/f8/:artifactId/verification-evidence", requireAuth, async (req, res): Promise<void> => {
  const parsed = evidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "INVALID_VERIFICATION_EVIDENCE" });
    return;
  }
  const source = await ownedCodeBundle(req.localUser!.id, String(req.params.artifactId));
  if (!source || source.artifactType !== "CODEBASE_BUNDLE" || source.featureId !== 8) {
    res.status(404).json({ error: "F8 CODEBASE_BUNDLE source artifact not found" });
    return;
  }
  const [session] = await db.select({ id: harnessSessionsTable.id }).from(harnessSessionsTable).where(and(
    eq(harnessSessionsTable.id, source.sessionId),
    eq(harnessSessionsTable.userId, req.localUser!.id),
  )).limit(1);
  if (!session) {
    res.status(404).json({ error: "Source session not found" });
    return;
  }
  const evidenceHash = hash({
    sourceArtifactId: source.id,
    sessionId: source.sessionId,
    ...parsed.data,
  });
  const [row] = await db.insert(codeBundleVerificationEvidenceTable).values({
    sourceArtifactId: source.id,
    sessionId: source.sessionId,
    userId: req.localUser!.id,
    ...parsed.data,
    evidenceHash,
  }).returning();
  res.status(201).json(row);
});

router.post("/harness/f8/:artifactId/verify", requireAuth, async (req, res): Promise<void> => {
  if (!finalizeBody.safeParse(req.body ?? {}).success) {
    res.status(400).json({ error: "Finalize request must be an empty object" });
    return;
  }
  const userId = req.localUser!.id;
  const artifactId = String(req.params.artifactId);
  const result = await db.transaction(async (tx) => {
    const [source] = await tx.select().from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.id, artifactId),
      eq(harnessArtifactsTable.userId, userId),
      eq(harnessArtifactsTable.artifactType, "CODEBASE_BUNDLE"),
      eq(harnessArtifactsTable.featureId, 8),
    )).for("update").limit(1);
    if (!source) return { status: 404 as const, error: "F8 CODEBASE_BUNDLE source artifact not found" };
    const evidence = await tx.select().from(codeBundleVerificationEvidenceTable)
      .where(and(
        eq(codeBundleVerificationEvidenceTable.sourceArtifactId, source.id),
        eq(codeBundleVerificationEvidenceTable.userId, userId),
      ))
       .orderBy(
         asc(codeBundleVerificationEvidenceTable.createdAt),
         asc(codeBundleVerificationEvidenceTable.id),
       );
    if (evidence.length === 0) {
      return { status: 409 as const, error: "Passing CI or IDE test evidence is required", code: "CODE_BUNDLE_EVIDENCE_REQUIRED" };
    }
    const contentHash = hash(source.artifactContent);
    const evidenceHash = hash(evidence.map((row) => row.evidenceHash));
    const [existing] = await tx.select().from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.parentArtifactId, source.id),
      eq(harnessArtifactsTable.artifactType, "VERIFIED_CODEBASE_BUNDLE"),
      eq(harnessArtifactsTable.userId, userId),
    )).limit(1);
    if (existing) {
      return { source, evidence, child: existing, contentHash, evidenceHash };
    }
    const [child] = await tx.insert(harnessArtifactsTable).values({
      sessionId: source.sessionId,
      userId,
      featureId: 8,
      artifactType: "VERIFIED_CODEBASE_BUNDLE",
      parentArtifactId: source.id,
      contentHash,
      verificationStatus: "VERIFIED",
      verificationEvidenceHash: evidenceHash,
      name: `${source.name ?? "F8 code bundle"} · verified`,
      artifactContent: {
        ...(source.artifactContent as Record<string, unknown>),
        verification: {
          status: "VERIFIED",
          stage: "F8",
          sourceArtifactId: source.id,
          contentHash,
          evidenceHash,
          evidenceIds: evidence.map((row) => row.id),
        },
      },
      scorecards: [],
    }).returning();
    if (!child) throw new Error("Verified code bundle insert returned no row");
    await captureArtifactPersisted(tx, child);
    return { source, evidence, child, contentHash, evidenceHash };
  });
  if ("status" in result && typeof result.status === "number") {
    res.status(result.status).json({ error: result.error, ...(result.code ? { code: result.code } : {}) });
    return;
  }
  res.json({
    sourceArtifactId: result.source.id,
    verifiedArtifactId: result.child.id,
    status: "VERIFIED",
    contentHash: result.contentHash,
    evidenceHash: result.evidenceHash,
    evidence: result.evidence,
  });
});

export default router;