import { z } from "zod/v4";
import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, harnessArtifactsTable } from "@workspace/db";
import { PFP_SYSTEM } from "./prompts";
import {
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const FINDING_CODES = [
  "SPEC_DRIFT",
  "PDD_ORPHAN",
  "UNAUTHORIZED_EXTENSION",
  "CIRCULAR_DEPENDENCY",
  "SEMANTIC_DRIFT",
  "OVER_SPECIFICATION",
  "AMBIGUOUS_OUTPUT",
] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const PfpReportSchema = z.object({
  verdict: z.enum(["pass", "pass_with_notes", "fail"]),
  fci: z.number().int().min(0).max(100),
  summary: z.string().max(400),
  findings: z
    .array(
      z.object({
        code: z.enum(FINDING_CODES),
        severity: z.enum(SEVERITIES),
        pddRef: z.string(),
        codeRef: z.string(),
        detail: z.string().max(400),
      }),
    )
    .max(60),
  counts: z.object({
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
});

export type PfpReport = z.infer<typeof PfpReportSchema>;

const Body = z.object({
  sessionId: z.string().uuid(),
  mvpPddArtifactId: z.string().uuid(),
  codebaseBundleArtifactId: z.string().uuid(),
  provider: z.enum(["claude", "openai", "gemini"]).optional(),
});

export async function handlePfp(req: Request, res: Response): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const { sessionId, mvpPddArtifactId, codebaseBundleArtifactId, provider: bodyProvider } =
    parsed.data;

  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, bodyProvider, guard.preferredModelProvider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }

  const mvp = await loadArtifact(mvpPddArtifactId, guard.userId);
  if (!mvp || mvp.sessionId !== sessionId || mvp.artifactType !== "MVP_PDD") {
    res.status(404).json({ error: "Source MVP PDD not found in this session" });
    return;
  }
  if (!mvp.spartanCert) {
    res.status(409).json({
      error: "Source MVP PDD is not SPARTAN-certified",
      detail: "PFP refuses to run drift checks on uncertified artefacts.",
    });
    return;
  }

  const bundle = await loadArtifact(codebaseBundleArtifactId, guard.userId);
  if (
    !bundle ||
    bundle.sessionId !== sessionId ||
    bundle.artifactType !== "CODEBASE_BUNDLE"
  ) {
    res.status(404).json({ error: "Codebase bundle not found in this session" });
    return;
  }

  const userPrompt = [
    "Cross-reference the CERTIFIED MVP PDD against the CODEBASE BUNDLE. Report all drift findings using the fixed taxonomy.",
    "",
    "=== CERTIFIED MVP PDD ===",
    JSON.stringify(mvp.artifactContent, null, 2),
    "",
    "=== CODEBASE BUNDLE ===",
    JSON.stringify(bundle.artifactContent, null, 2),
  ].join("\n");

  let out: PfpReport;
  try {
    out = await callLlmJson(provider, PFP_SYSTEM, userPrompt, PfpReportSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 11,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "PFP engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }

  // HARD GATE: never trust the model's self-reported counts. Recompute from
  // findings server-side so a contradictory output (findings list a critical
  // but counts.critical = 0) cannot bypass the F8 drift gate downstream.
  const recomputed = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of out.findings) recomputed[f.severity] += 1;
  out.counts = recomputed;
  // Re-derive verdict from authoritative counts + FCI so it stays self-consistent.
  if (recomputed.critical > 0 || recomputed.high > 3 || out.fci < 90) {
    out.verdict = "fail";
  } else if (recomputed.high > 0 || recomputed.medium > 0) {
    out.verdict = "pass_with_notes";
  } else {
    out.verdict = "pass";
  }

  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 8,
    artifactType: "PFP_REPORT",
    artifactContent: {
      ...out,
      sourceMvpPddArtifactId: mvpPddArtifactId,
      sourceCodebaseBundleArtifactId: codebaseBundleArtifactId,
    },
    provider,
  });

  res.json({ artifactId: artifact.id, ...out });
}

/**
 * Find the most recent PFP report for a given (session, MVP PDD) pair. Used
 * by F8 Code DJ as a drift gate — if the latest report has critical findings
 * and the caller hasn't acknowledged, F8 refuses to scaffold further bundles.
 */
export async function latestPfpForMvp(
  sessionId: string,
  userId: string,
  mvpPddArtifactId: string,
): Promise<PfpReport | null> {
  // Filter by the JSON link directly (sourceMvpPddArtifactId is persisted into
  // artifact_content) so a busy session can't push the relevant report past
  // any arbitrary row-limit window and silently bypass the drift gate.
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.sessionId, sessionId),
        eq(harnessArtifactsTable.userId, userId),
        eq(harnessArtifactsTable.artifactType, "PFP_REPORT"),
        sql`${harnessArtifactsTable.artifactContent}->>'sourceMvpPddArtifactId' = ${mvpPddArtifactId}`,
      ),
    )
    .orderBy(desc(harnessArtifactsTable.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const parsed = PfpReportSchema.safeParse(row.artifactContent);
  return parsed.success ? parsed.data : null;
}
