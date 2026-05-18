import type { Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, harnessArtifactsTable } from "@workspace/db";
import {
  callClaudeJson,
  certTierForJcse,
  ownedSessionOr404,
  persistArtifact,
  type RunContext,
} from "./shared";
import { logger } from "../lib/logger";

const DE_SYSTEM = `You are the DE-SPC SYNTHESIZER (Digitally Evolved Standard Prompt Card generator).

You are given a set of Molecular Agent (MA) Birth Packages from a single FORGE.BONSAI session.
Your job is to FUSE these MAs into ONE coherent, multi-agent, adaptive SPC of class
"adaptive_multi_agent_tier (digitally_evolving)".

This SPC must:
  1. Capture the union of all MA capabilities into a single ATLAS-shaped (system/role/instruction/example/constraint/format/data) prompt.
  2. Identify the orchestration pattern across MAs (sequential, parallel, supervisor, swarm).
  3. Provide a JCSE self-score (0-50, 7 pillars: system/role/instruction/example/constraint/format/data).
  4. Be production-grade — every field must be specific, testable, and reference real MA names.

Output strict JSON only. No prose.`;

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
  notes: z.string().optional(),
});

const EvolveBody = z.object({
  sessionId: z.string().uuid(),
  maArtifactIds: z.array(z.string().uuid()).min(2).max(12),
});

export async function handleEvolve(req: Request, res: Response): Promise<void> {
  const parsed = EvolveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const { sessionId, maArtifactIds } = parsed.data;
  const owns = await ownedSessionOr404(req, sessionId);
  if (!owns.ok) {
    res.status(owns.status).json({ error: owns.error });
    return;
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

  const userPrompt = [
    `Synthesise these ${mas.length} Molecular Agent Birth Packages into ONE adaptive multi-agent SPC:`,
    "",
    ...mas.map((m, i) => `--- MA #${i + 1} (id=${m.id}) ---\n${JSON.stringify(m.artifactContent, null, 2)}`),
    "",
    "Return ONLY the JSON object matching the DE-SPC schema.",
  ].join("\n");

  const ctx: RunContext = { sessionId, userId: owns.userId, engineId: 8 };
  let synth;
  try {
    synth = await callClaudeJson(DE_SYSTEM, userPrompt, DeSpcSchema, ctx);
  } catch (err) {
    logger.error({ err, sessionId }, "DE-SPC synthesis failed");
    res.status(502).json({ error: "DE-SPC synthesis failed", detail: String((err as Error).message) });
    return;
  }

  const artifact = await persistArtifact({
    sessionId,
    userId: owns.userId,
    featureId: 5,
    artifactType: "SPC",
    artifactContent: { ...synth, sourceMaIds: mas.map((m) => m.id) },
    jcseScore: synth.jcse.total,
    certTier: certTierForJcse(synth.jcse.total),
    groState: "SAFE_LIFE",
    spartanCert: null,
  });

  // Mark as digitally evolved.
  await db
    .update(harnessArtifactsTable)
    .set({ spcOrigin: "digitally_evolved" })
    .where(eq(harnessArtifactsTable.id, artifact.id));

  res.json({ ...artifact, spcOrigin: "digitally_evolved" });
}
