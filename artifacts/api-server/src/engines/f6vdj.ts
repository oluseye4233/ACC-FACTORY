import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF6VdjBody } from "@workspace/api-zod";
import { F6_VDJ_SYSTEM } from "./prompts";
import {
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const VdjOutputSchema = z.object({
  recommendedIde: z.string(),
  recommendedVibe: z.string(),
  rationale: z.string(),
  alternatives: z
    .array(z.object({ name: z.string(), fit: z.number() }))
    .default([]),
});

export async function handleF6Vdj(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF6VdjBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, pddArtifactId, provider: bodyProvider } = parsed.data;
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
  const pdd = await loadArtifact(pddArtifactId, guard.userId);
  if (!pdd || pdd.sessionId !== sessionId || pdd.artifactType !== "ATLAS_PDD") {
    res.status(404).json({ error: "ATLAS PDD artifact not found in this session" });
    return;
  }
  const userPrompt = `Recommend a VIBE for this ATLAS PDD:\n${JSON.stringify(pdd.artifactContent, null, 2)}`;
  let out: z.infer<typeof VdjOutputSchema>;
  try {
    out = await callLlmJson(provider, F6_VDJ_SYSTEM, userPrompt, VdjOutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 6,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F6-VDJ engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  // VDJ is advisory — does not produce a stored artifact and does not advance feature state.
  res.json(out);
}
