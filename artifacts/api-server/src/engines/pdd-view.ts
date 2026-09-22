import { z } from "zod/v4";
import type { Request, Response } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  harnessSessionsTable,
  type LlmProvider,
} from "@workspace/db";
import { JSON_ONLY_GUARDRAIL } from "./prompts";
import {
  callLlmJson,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

/**
 * This is deliberately a view-level disclosure, rather than a claim about the
 * source PDD. It is fixed in application code so a model cannot omit or soften
 * the certification status.
 */
export const ATLAS_360_PLAN_DISCLOSURE =
  "ATLAS 360 PLAN host framework's JCSE/certification is WITHHELD/self-declared uncertified.";

const SOURCE_TYPES = ["ATLAS_PDD", "MVP_PDD"] as const;
const VIEW_FORMATS = ["plan", "scan"] as const;

const ViewPartSchema = z.object({
  part: z.number().int().min(0).max(11),
  title: z.string().min(1),
  content: z.string(),
});

export const Atlas360PlanViewSchema = z.object({
  schemaVersion: z.literal("atlas-360-plan-v1"),
  view: z.literal("PLAN"),
  title: z.string().min(1),
  parts: z.array(ViewPartSchema).length(12),
});
export type Atlas360PlanView = z.infer<typeof Atlas360PlanViewSchema>;

const ScanStageSchema = z.object({
  stage: z.number().int().min(1).max(8),
  name: z.string().min(1),
  evidence: z.array(z.string()),
  assessment: z.string(),
  actions: z.array(z.string()),
});

export const Atlas360ScanViewSchema = z.object({
  schemaVersion: z.literal("atlas-360-scan-v1"),
  view: z.literal("SCAN"),
  title: z.string().min(1),
  stages: z.array(ScanStageSchema).length(8),
});
export type Atlas360ScanView = z.infer<typeof Atlas360ScanViewSchema>;

const PLAN_SYSTEM = `${JSON_ONLY_GUARDRAIL}
You are the ATLAS 360 PLAN document-view engine. Re-render only the supplied
F6/F7 PDD; do not run or propose running any F1-F8 stage and do not invent
facts. Return exactly one JSON object matching this schema:
{"schemaVersion":"atlas-360-plan-v1","view":"PLAN","title":"string",
"parts":[{"part":0,"title":"string","content":"string"}]}
parts must contain exactly one entry for every integer 0 through 11, in that
order. Part 10 title MUST be "Security & Governance". Part 11 title MUST be
"Regulatory Conformity". Those two parts are mandatory even when the source
PDD has no corresponding section; state that evidence is not present rather
than fabricating controls or compliance. Keep content concise and traceable
to the source.`;

const SCAN_SYSTEM = `${JSON_ONLY_GUARDRAIL}
You are the ATLAS 360 SCAN assurance document-view engine. Re-render only the
supplied F6/F7 PDD and optional same-session evidence. Do not run or propose
running any F1-F8 stage and do not invent facts. Return exactly one JSON object
matching this schema:
{"schemaVersion":"atlas-360-scan-v1","view":"SCAN","title":"string",
"stages":[{"stage":1,"name":"Freeze-stage Evidence Manifest","evidence":["string"],
"assessment":"string","actions":["string"]}]}
stages must contain exactly eight entries, numbered 1 through 8, in order.
Stage 1 MUST be named "Freeze-stage Evidence Manifest". Evidence may mention
that optional CODEBASE_BUNDLE or PFP_REPORT was not available.`;

async function latestSource(sessionId: string, userId: string) {
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.sessionId, sessionId),
        eq(harnessArtifactsTable.userId, userId),
        or(
          eq(harnessArtifactsTable.artifactType, "ATLAS_PDD"),
          eq(harnessArtifactsTable.artifactType, "MVP_PDD"),
        ),
      ),
    )
    .orderBy(desc(harnessArtifactsTable.createdAt))
    .limit(1);
  return rows[0];
}

async function latestEvidence(
  sessionId: string,
  userId: string,
  artifactType: "CODEBASE_BUNDLE" | "PFP_REPORT",
) {
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.sessionId, sessionId),
        eq(harnessArtifactsTable.userId, userId),
        eq(harnessArtifactsTable.artifactType, artifactType),
      ),
    )
    .orderBy(desc(harnessArtifactsTable.createdAt))
    .limit(1);
  return rows[0];
}

function normalizePlan(out: Atlas360PlanView): Atlas360PlanView {
  const byPart = new Map(out.parts.map((part) => [part.part, part]));
  const titles = [
    "Title & Contents / Authorship & Provenance",
    "Statement of Requirements",
    "Business Case",
    "SPC Roster",
    "Platform Specifics",
    "Atomic Prompt / Feature Traceability",
    "Implementation, CI/CD & Deployment",
    "Summary of Sources",
    "Definition of Terms",
    "Styling & Layout",
    "Security & Governance",
    "Regulatory Conformity",
  ];
  return {
    ...out,
    parts: titles.map((title, part) => ({
      part,
      title:
        part === 10 || part === 11 ? title : byPart.get(part)?.title || title,
      content:
        part === 10 || part === 11
          ? byPart.get(part)?.content ||
            "No source evidence supplied; assessment is deferred."
          : byPart.get(part)?.content || "No source evidence supplied.",
    })),
  };
}

function normalizeScan(out: Atlas360ScanView): Atlas360ScanView {
  const names = [
    "Freeze-stage Evidence Manifest",
    "Baseline and Scope",
    "Evidence Mapping",
    "Assurance Assessment",
    "Drift and Reconciliation",
    "Risk and Control Gaps",
    "Conformity Decision",
    "Release and Monitoring",
  ];
  const byStage = new Map(out.stages.map((stage) => [stage.stage, stage]));
  return {
    ...out,
    stages: names.map((name, index) => ({
      stage: index + 1,
      name,
      evidence: byStage.get(index + 1)?.evidence ?? [],
      assessment:
        byStage.get(index + 1)?.assessment ?? "No source evidence supplied.",
      actions: byStage.get(index + 1)?.actions ?? [],
    })),
  };
}

export async function handlePddView(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = typeof req.params.id === "string" ? req.params.id : "";
  const requestedFormat = req.query.format;
  if (
    requestedFormat !== undefined &&
    (typeof requestedFormat !== "string" ||
      !VIEW_FORMATS.includes(requestedFormat as (typeof VIEW_FORMATS)[number]))
  ) {
    res
      .status(400)
      .json({ error: "Invalid format", detail: "format must be plan or scan" });
    return;
  }

  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const sessionRows = await db
    .select({ origin: harnessSessionsTable.origin })
    .from(harnessSessionsTable)
    .where(eq(harnessSessionsTable.id, sessionId))
    .limit(1);
  const origin = sessionRows[0]?.origin;
  const format =
    (requestedFormat as "plan" | "scan" | undefined) ??
    (origin === "ingested" ? "scan" : "plan");
  const source = await latestSource(sessionId, guard.userId);
  if (
    !source ||
    !SOURCE_TYPES.includes(source.artifactType as (typeof SOURCE_TYPES)[number])
  ) {
    res
      .status(404)
      .json({ error: "Source F6/F7 PDD not found in this session" });
    return;
  }

  let provider: LlmProvider;
  try {
    provider = resolveProvider(req, undefined, guard.preferredModelProvider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }

  const evidence =
    format === "scan"
      ? {
          codebaseBundle: await latestEvidence(
            sessionId,
            guard.userId,
            "CODEBASE_BUNDLE",
          ),
          pfpReport: await latestEvidence(
            sessionId,
            guard.userId,
            "PFP_REPORT",
          ),
        }
      : { codebaseBundle: undefined, pfpReport: undefined };
  const userPrompt = [
    `Render the source artifact as the ${format.toUpperCase()} view.`,
    "This is a read-only side-step. Never modify or rerun F1-F8.",
    "=== SOURCE ARTIFACT ===",
    JSON.stringify(source.artifactContent, null, 2),
    ...(format === "scan"
      ? [
          "=== OPTIONAL CODEBASE_BUNDLE (may be absent) ===",
          JSON.stringify(
            evidence.codebaseBundle?.artifactContent ?? null,
            null,
            2,
          ),
          "=== OPTIONAL PFP_REPORT (may be absent) ===",
          JSON.stringify(evidence.pfpReport?.artifactContent ?? null, null, 2),
        ]
      : []),
  ].join("\n");

  try {
    if (format === "plan") {
      const raw = await callLlmJson(
        provider,
        PLAN_SYSTEM,
        userPrompt,
        Atlas360PlanViewSchema,
        {
          sessionId,
          userId: guard.userId,
          engineId: 6,
        },
      );
      const out = normalizePlan(raw);
      const artifact = await persistArtifact({
        sessionId,
        userId: guard.userId,
        featureId: 6,
        artifactType: "ATLAS_360_PLAN_VIEW",
        artifactContent: {
          ...out,
          disclosure: ATLAS_360_PLAN_DISCLOSURE,
          sourceArtifactId: source.id,
          sourceArtifactType: source.artifactType,
        },
        provider,
      });
      res.json({
        artifactId: artifact.id,
        sourceArtifactId: source.id,
        sourceArtifactType: source.artifactType,
        disclosure: ATLAS_360_PLAN_DISCLOSURE,
        ...out,
      });
      return;
    }

    const raw = await callLlmJson(
      provider,
      SCAN_SYSTEM,
      userPrompt,
      Atlas360ScanViewSchema,
      {
        sessionId,
        userId: guard.userId,
        engineId: 6,
      },
    );
    const out = normalizeScan(raw);
    const artifact = await persistArtifact({
      sessionId,
      userId: guard.userId,
      featureId: 6,
      artifactType: "ATLAS_360_SCAN_VIEW",
      artifactContent: {
        ...out,
        sourceArtifactId: source.id,
        sourceArtifactType: source.artifactType,
        sourceCodebaseBundleArtifactId: evidence.codebaseBundle?.id ?? null,
        sourcePfpReportArtifactId: evidence.pfpReport?.id ?? null,
      },
      provider,
    });
    res.json({
      artifactId: artifact.id,
      sourceArtifactId: source.id,
      sourceArtifactType: source.artifactType,
      sourceCodebaseBundleArtifactId: evidence.codebaseBundle?.id ?? null,
      sourcePfpReportArtifactId: evidence.pfpReport?.id ?? null,
      ...out,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "PDD view engine call failed");
    res
      .status(502)
      .json({ error: "Engine call failed", detail: (err as Error).message });
  }
}
