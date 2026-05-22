import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF2Body } from "@workspace/api-zod";
import { F2_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  certTierForJcse,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const F2OutputSchema = z.object({
  tuple: z.object({
    system: z.string(),
    role: z.string(),
    instruction: z.string(),
    example: z.string(),
    constraint: z.string(),
    format: z.string(),
    data: z.string(),
  }),
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
});

export async function handleF2(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF2Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, tuple, provider: bodyProvider } = parsed.data;
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
  const userPrompt = `Certify this Atomic Prompt 7-tuple.\n\n${JSON.stringify(tuple, null, 2)}`;
  let out: z.infer<typeof F2OutputSchema>;
  try {
    out = await callLlmJson(provider, F2_SYSTEM, userPrompt, F2OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 2,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F2 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const certTier = certTierForJcse(out.jcse.total);
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 2,
    artifactType: "ATOMIC_PROMPT",
    artifactContent: out,
    jcseScore: out.jcse.total,
    certTier,
    provider,
  });
  await advanceFeatureState(sessionId, 2);
  res.json({ ...out, certTier, artifactId: artifact.id });
}
