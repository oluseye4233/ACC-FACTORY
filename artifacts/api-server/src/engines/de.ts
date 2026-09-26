import type { Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, harnessArtifactsTable } from "@workspace/db";
import {
  callLlmJson,
  certTierForJcse,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
  type RunContext,
} from "./shared";
import { logger } from "../lib/logger";
import {
  buildJcseScorecard,
  JcsePillarFeedbackSchema,
  type JcsePillar,
  type ScorecardFeedback,
} from "../lib/scorecards";
import {
  EMPTY_SPC_QUALITY_SCORES,
  SPC_PLAYER_REGISTRY_VERSION,
} from "../lib/spc-player";

const DE_SYSTEM = `You are the DE-SPC SYNTHESIZER (Digitally Evolved Standard Prompt Card generator).

You are given a set of Micro Agent (MA) Birth Packages from a single FORGE.BONSAI session.
Your job is to FUSE these MAs into ONE coherent, multi-agent, adaptive SPC of class
"adaptive_multi_agent_tier (digitally_evolving)".

Return ONE strict JSON object — NO prose, NO markdown, NO code fences — that matches
EXACTLY this shape (every key required, exact casing, no extra top-level keys):

{
  "title":                 string  // ≥ 3 chars, short descriptive name for the fused SPC
  "objective":             string  // ≥ 10 chars, the combined mission of the fused agents
  "domain":                string  // ≥ 2 chars, e.g. "meal-planning", "devops", "support"
  "orchestrationPattern":  "sequential" | "parallel" | "supervisor" | "swarm"
  "systemPrompt":          string  // ≥ 20 chars, the single fused system prompt
  "atomicPrompt": {
    "system":       string,
    "role":         string,
    "instruction":  string,
    "example":      string,
    "constraint":   string,
    "format":       string,
    "data":         string
  },
  "successCriteria": string[]  // ≥ 1 entry, each testable
  "guardrails":      string[]  // ≥ 1 entry
  "outputs":         string[]  // ≥ 1 entry
  "telemetry":       string[]  // may be empty array, but the key must be present
  "maReferences":    string[]  // ≥ 2 entries, each referencing a real MA name/id from input
  "jcse": {
    "system":      integer 0..8,
    "role":        integer 0..8,
    "instruction": integer 0..8,
    "example":     integer 0..8,
    "constraint":  integer 0..6,
    "format":      integer 0..6,
    "data":        integer 0..6,
    "total":       integer 0..50   // = sum of the 7 sub-scores
  },
  "notes": string  // optional summary; if absent, omit the key entirely (do not set null)
}

Rules:
  1. Capture the union of all MA capabilities into the ATLAS-shaped (system/role/instruction/example/constraint/format/data) prompt.
  2. Identify the orchestration pattern across MAs (sequential, parallel, supervisor, swarm).
  3. Provide a JCSE self-score (0-50 total, 7 pillars).
  4. Be production-grade — every field must be specific, testable, and reference real MA names.
  5. Do NOT invent alternative field names (e.g. "spc_id", "schema_version", "session_fusion_summary"). The schema above is authoritative.

Output strict JSON only. No prose. No code fences.`;

const DeSpcSchema = z.object({
  title: z.string().min(3),
  objective: z.string().min(10),
  domain: z.string().min(2),
  orchestrationPattern: z.enum(["sequential", "parallel", "supervisor", "swarm"]),
  systemPrompt: z.string().min(20),
  atomicPrompt: z.object({
    system: z.string(),
    role: z.string(),
    instruction: z.string(),
    example: z.string(),
    constraint: z.string(),
    format: z.string(),
    data: z.string(),
  }),
  successCriteria: z.array(z.string()).min(1),
  guardrails: z.array(z.string()).min(1),
  outputs: z.array(z.string()).min(1),
  telemetry: z.array(z.string()),
  maReferences: z.array(z.string()).min(2),
  jcse: z.object({
    system: z.number().int().min(0).max(8),
    role: z.number().int().min(0).max(8),
    instruction: z.number().int().min(0).max(8),
    example: z.number().int().min(0).max(8),
    constraint: z.number().int().min(0).max(6),
    format: z.number().int().min(0).max(6),
    data: z.number().int().min(0).max(6),
    total: z.number().int().min(0).max(50),
  }),
  jcsePillarFeedback: JcsePillarFeedbackSchema.optional(),
  notes: z.string().optional(),
});

const EvolveBody = z.object({
  sessionId: z.string().uuid(),
  maArtifactIds: z.array(z.string().uuid()).min(2).max(12),
  provider: z.enum(["claude", "openai", "gemini", "deepseek", "kimi", "qwen", "glm"]).optional(),
});

export async function handleEvolve(req: Request, res: Response): Promise<void> {
  const parsed = EvolveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const { sessionId, maArtifactIds, provider: bodyProvider } = parsed.data;
  if (new Set(maArtifactIds).size !== maArtifactIds.length) {
    res.status(400).json({ error: "Duplicate MA birth package ids" });
    return;
  }
  const owns = await ownedSessionOr404(req, sessionId);
  if (!owns.ok) {
    res.status(owns.status).json({ error: owns.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, bodyProvider, owns.preferredModelProvider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }
  const mas = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.userId, owns.userId),
        eq(harnessArtifactsTable.sessionId, sessionId),
        eq(harnessArtifactsTable.artifactType, "MA_BIRTH_PACKAGE"),
        inArray(harnessArtifactsTable.id, maArtifactIds),
      ),
    );
  if (mas.length < 2) {
    res.status(400).json({ error: "Need at least 2 MA birth packages from this session" });
    return;
  }

  // `inArray` does not guarantee row order, so fusing in raw DB order makes the
  // synthesis prompt — and therefore the LLM request, its telemetry, and its
  // cache key — nondeterministic across identical inputs. Replay the caller's
  // requested `maArtifactIds` order so the same inputs always produce the same
  // prompt.
  const masById = new Map(mas.map((m) => [m.id, m] as const));
  const orderedMas = maArtifactIds
    .map((id) => masById.get(id))
    .filter((m): m is NonNullable<typeof m> => m != null);
  if (orderedMas.length !== maArtifactIds.length) {
    res.status(400).json({ error: "Some requested MA birth packages were not found in this session" });
    return;
  }

  const userPrompt = [
    `Synthesise these ${orderedMas.length} Micro Agent (MA) Birth Packages into ONE adaptive multi-agent SPC:`,
    "",
    ...orderedMas.map((m, i) => `--- MA #${i + 1} (id=${m.id}) ---\n${JSON.stringify(m.artifactContent, null, 2)}`),
    "",
    "Return ONLY the JSON object matching the DE-SPC schema.",
  ].join("\n");

  const ctx: RunContext = { sessionId, userId: owns.userId, engineId: 8 };
  let synth;
  try {
    synth = await callLlmJson(provider, DE_SYSTEM, userPrompt, DeSpcSchema, ctx);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    logger.error({ err, sessionId }, "DE-SPC synthesis failed");
    res.status(502).json({ error: "DE-SPC synthesis failed", detail: String((err as Error).message) });
    return;
  }

  const scores = {
    SYSTEM: synth.jcse.system,
    ROLE: synth.jcse.role,
    INSTRUCTION: synth.jcse.instruction,
    EXAMPLE: synth.jcse.example,
    CONSTRAINT: synth.jcse.constraint,
    FORMAT: synth.jcse.format,
    DATA: synth.jcse.data,
  } satisfies Record<JcsePillar, number>;
  const feedback = synth.jcsePillarFeedback as
    | Partial<Record<Lowercase<JcsePillar>, ScorecardFeedback>>
    | undefined;
  const scorecard = buildJcseScorecard({
    score: synth.jcse.total,
    scores,
    feedback,
  });

  const artifact = await persistArtifact({
    sessionId,
    userId: owns.userId,
    featureId: 5,
    artifactType: "SPC",
    artifactContent: {
      ...synth,
      sourceMaIds: orderedMas.map((m) => m.id),
      spcDevKitRegistryVersion: SPC_PLAYER_REGISTRY_VERSION,
      qualityScores: { ...EMPTY_SPC_QUALITY_SCORES },
    },
    scorecards: [scorecard],
    jcseScore: synth.jcse.total,
    certTier: certTierForJcse(synth.jcse.total),
    groState: "SAFE_LIFE",
    spartanCert: null,
    provider,
  });

  // Mark as digitally evolved.
  await db
    .update(harnessArtifactsTable)
    .set({ spcOrigin: "digitally_evolved" })
    .where(eq(harnessArtifactsTable.id, artifact.id));

  res.json({ ...artifact, spcOrigin: "digitally_evolved" });
}
