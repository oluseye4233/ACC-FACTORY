import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF1Body } from "@workspace/api-zod";
import { F1_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  certTierForJcse,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const Pillar = z.enum(["SYSTEM", "ROLE", "INSTRUCTION", "EXAMPLE", "CONSTRAINT", "FORMAT", "DATA"]);

const F1OutputSchema = z.object({
  jcse: z.object({
    system: z.number().int(),
    role: z.number().int(),
    instruction: z.number().int(),
    example: z.number().int(),
    constraint: z.number().int(),
    format: z.number().int(),
    data: z.number().int(),
    total: z.number().int(),
  }),
  certTier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM", "NONE"]),
  pillars: z.array(
    z.object({
      pillar: Pillar,
      score: z.number().int(),
      max: z.number().int(),
      notes: z.string(),
      gapHints: z.array(z.string()).default([]),
    }),
  ),
  atomicPrompt: z.object({
    system: z.string(),
    role: z.string(),
    instruction: z.string(),
    example: z.string(),
    constraint: z.string(),
    format: z.string(),
    data: z.string(),
  }),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export async function handleF1(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF1Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, prompt, provider: bodyProvider } = parsed.data;
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
  const userPrompt = `Diagnose this user prompt against the 7 Context Craft pillars.\n\n<<<USER_PROMPT>>>\n${prompt}\n<<<END_USER_PROMPT>>>`;
  let out: z.infer<typeof F1OutputSchema>;
  try {
    out = await callLlmJson(provider, F1_SYSTEM, userPrompt, F1OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 1,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F1 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  // Trust deterministic cert mapping over LLM-stated tier.
  const certTier = certTierForJcse(out.jcse.total);
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 1,
    artifactType: "PROMPT_DIAGNOSTIC",
    artifactContent: out,
    jcseScore: out.jcse.total,
    certTier,
  });
  await advanceFeatureState(sessionId, 1);
  res.json({ ...out, certTier, artifactId: artifact.id });
}
